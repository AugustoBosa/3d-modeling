// Tools MCP de impressão: filamento do projeto, tabela de slots AMS e apoiar uma face na mesa.
import { z } from 'zod'
import { slotValido } from '@3dm/core/doc'
import type { Feature } from '@3dm/core/doc'
import { TOL_EXPORT } from '@3dm/core/kernel'
import { idLivre, adicionaFeature } from '@3dm/core/features'
import { filamentos, filamentoPorId } from '@3dm/core/filaments'
import { definirFilamento, definirSlotTabela, orientacaoParaFeature } from '@3dm/core/imprimir'
import { normaliza } from '@3dm/core/malha'
import type { Malha } from '@3dm/core/malha'
import { impressoraPorId } from '@3dm/core/printers'
import { executaChecando, regenera, resumo } from './modelo.ts'
import type { Sessao } from './sessao.ts'
import type { Tool } from './tool.ts'

type Vet = [number, number, number]

const COS_TOL = Math.cos(10 * Math.PI / 180)
const vetor = (v: number[]) => `[${v.map(x => Math.round(x * 1000) / 1000).join(', ')}]`
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

function validaFilamento(id: string): void {
  if (!filamentoPorId(id)) {
    throw new Error(`filamento desconhecido: ${id}. Correção: use um destes ids: ${filamentos.map(f => f.id).join(', ')}.`)
  }
}

/** Normal unitária e área de cada triângulo não degenerado. */
function facesDe(m: Malha): { tri: number; n: Vet; area: number }[] {
  const { pos, idx } = normaliza(m)
  const saida: { tri: number; n: Vet; area: number }[] = []
  for (let t = 0; t < idx.length / 3; t++) {
    const [a, b, c] = [idx[3 * t], idx[3 * t + 1], idx[3 * t + 2]].map(v => v * 3)
    const u = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]]
    const v = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]]
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    const len = Math.hypot(n[0], n[1], n[2])
    if (len > 0) saida.push({ tri: t, n: [n[0] / len, n[1] / len, n[2] / len], area: len / 2 })
  }
  return saida
}

export const toolsF3b: Tool[] = [
  {
    nome: 'filamento_definir',
    descricao: 'Define o filamento ativo do projeto (ex.: pla, petg). null remove e volta ao filamento da impressora. Desfazível.',
    entrada: {
      filamento: z.string().nullable().describe('id do filamento, ou null para voltar ao da impressora'),
    },
    exemplo: { filamento: 'pla' },
    executa(s: Sessao, { filamento }: { filamento: string | null }) {
      if (filamento !== null) validaFilamento(filamento)
      s.executa(definirFilamento(filamento))
      return { ok: true, filamento: s.doc.filamento ?? null }
    },
  },
  {
    nome: 'slots_definir',
    descricao: 'Define a linha de um slot do AMS/extrusora (1 a 16) na tabela do projeto: filamento e cor (#RRGGBB) juntos. Sem filamento nem cor, remove o slot. Desfazível.',
    entrada: {
      slot: z.number().int().min(1).max(16).describe('slot do AMS/extrusora, de 1 a 16'),
      filamento: z.string().optional().describe('id do filamento do slot (ex.: petg)'),
      cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe('cor em #RRGGBB'),
    },
    exemplo: { slot: 2, filamento: 'petg', cor: '#ff0000' },
    executa(s: Sessao, { slot, filamento, cor }: { slot: number; filamento?: string; cor?: string }) {
      if (!slotValido(slot)) throw new Error(`slot inválido: ${slot}. Correção: use um inteiro de 1 a 16.`)
      if (filamento === undefined && cor === undefined) {
        s.executa(definirSlotTabela(slot, null))
      } else {
        if (filamento === undefined || cor === undefined) {
          throw new Error(`slots_definir precisa de filamento e cor juntos. Correção: informe os dois, ou nenhum para remover o slot ${slot}.`)
        }
        validaFilamento(filamento)
        s.executa(definirSlotTabela(slot, { filamento, cor }))
      }
      return { ok: true, slots: s.doc.slots ?? {} }
    },
  },
  {
    nome: 'apoiar_na_face',
    descricao: 'Gira e solta o corpo para apoiar na mesa a face plana cuja normal é a informada (a face que deve ficar EMBAIXO, normal apontando para fora). Tolerância de 10°. Cria uma transformação; desfazível.',
    entrada: {
      corpo: z.string().optional().describe('id do corpo; omitido = o mais recente'),
      normal: z.tuple([z.number(), z.number(), z.number()]).describe('normal da face que deve ficar embaixo, [x, y, z]'),
    },
    exemplo: { corpo: 'cx1', normal: [0, 0, -1] },
    executa(s: Sessao, { corpo, normal }: { corpo?: string; normal: Vet }) {
      const r = regenera(s, TOL_EXPORT)
      const ids = [...r.corpos.keys()]
      if (ids.length === 0) throw new Error('O projeto ainda não tem sólidos. Correção: crie uma primitiva ou extrude um sketch antes.')
      const id = corpo ?? ids.at(-1)!
      if (!r.corpos.has(id)) throw new Error(`corpo desconhecido: ${id}. Correção: use um destes ids: ${ids.join(', ')}.`)
      const malha = r.corpos.get(id)!

      const k = Math.hypot(normal[0], normal[1], normal[2])
      if (!(k > 0)) throw new Error('normal nula. Correção: informe um vetor não nulo, ex.: [0, 0, -1].')
      const want = normal.map(x => x / k) as Vet

      const faces = facesDe(malha)
      const bons = faces.filter(f => dot(f.n, want) >= COS_TOL)
      if (bons.length === 0) {
        const grupos: { n: Vet; area: number }[] = []
        for (const f of faces) {
          const g = grupos.find(g => dot(g.n, f.n) >= COS_TOL)
          if (g) g.area += f.area
          else grupos.push({ n: f.n, area: f.area })
        }
        grupos.sort((a, b) => b.area - a.area)
        const disponiveis = grupos.slice(0, 12).map(g => `${vetor(g.n)} (área ${Math.round(g.area)} mm²)`).join(', ')
        throw new Error(`Nenhuma face plana do corpo ${id} tem normal perto de ${vetor(want)} (tolerância 10°). Normais disponíveis: ${disponiveis || '(nenhuma)'}. Correção: use uma delas.`)
      }
      const escolhido = bons.reduce((a, b) => (b.area > a.area ? b : a))

      const fid = idLivre(s.doc, 'tr')
      const volume = impressoraPorId(s.doc.impressora)?.volume ?? { x: 256, y: 256 }
      const f = orientacaoParaFeature(fid, malha, escolhido.tri, volume, true, id)
      const r2 = executaChecando(s, adicionaFeature(f as Feature))
      return { ok: true, id: fid, triangulo: escolhido.tri, normalEscolhida: vetor(escolhido.n), ...resumo(r2) }
    },
  },
]
