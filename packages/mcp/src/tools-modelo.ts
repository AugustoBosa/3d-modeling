// Tools de leitura e saída do modelo (headless): medidas, verificação de impressão, export STL/3MF e capturas SVG.
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { TOL_EXPORT, TOL_PREVIA } from '@3dm/core/kernel'
import { bbox, fechada, normaliza, stl, volume } from '@3dm/core/malha'
import { avisosFilamento, massaGramas, verificar } from '@3dm/core/imprimir'
import type { Achado } from '@3dm/core/imprimir'
import { config3mfDe, escrever3mf, nomeArquivo, saborDe } from '@3dm/core/export'
import { impressoraPorId } from '@3dm/core/printers'
import { filamentoPorId, filamentos } from '@3dm/core/filaments'
import type { Filamento } from '@3dm/core/filaments'
import { entradaDe } from '@3dm/core/features'
import { Regenerador } from '@3dm/core/regen'
import type { ResultadoRegen } from '@3dm/core/regen'
import type { Tool } from './tool.ts'
import type { Sessao } from './sessao.ts'
import { regenera } from './modelo.ts'
import { capturaSvg, VISTAS } from './captura-svg.ts'
import type { Vista } from './captura-svg.ts'

const FILAMENTO_PADRAO = 'pla'
const COR_PADRAO = '#d9b36c'
const r2 = (n: number) => Math.round(n * 100) / 100

function impressoraDe(s: Sessao) {
  const imp = impressoraPorId(s.doc.impressora)
  if (!imp) throw new Error(`impressora do projeto desconhecida: ${s.doc.impressora}. Correção: use impressoras_listar.`)
  return imp
}

/** Filamento pedido, ou o do projeto, ou o padrão. */
function filamentoDe(s: Sessao, id?: string): Filamento {
  const alvo = id ?? s.doc.filamento ?? FILAMENTO_PADRAO
  const fil = filamentoPorId(alvo)
  if (!fil) throw new Error(`filamento desconhecido: ${alvo}. Correção: use um destes ids: ${filamentos.map(f => f.id).join(', ')}.`)
  return fil
}

/** Regenera com valores temporários de parâmetros numa cópia do documento: o projeto não muda. */
function regeneraCom(s: Sessao, tol: number, valores: Record<string, number>): ResultadoRegen {
  const copia = structuredClone(s.doc)
  for (const [nome, v] of Object.entries(valores)) {
    if (!Object.hasOwn(copia.parametros, nome)) {
      throw new Error(`parâmetro desconhecido: ${nome}. Correção: use um destes: ${Object.keys(copia.parametros).join(', ') || 'nenhum'}.`)
    }
    copia.parametros[nome] = { ...copia.parametros[nome], expr: String(v) }
  }
  const reg = new Regenerador()
  try { return reg.regenera(entradaDe(copia, { tol })) } finally { reg.dispose() }
}

/** Malhas regeneradas com a tolerância dada e os ids pedidos (todos, ou só `corpo`). Lança se não há sólido ou o id não existe. */
function corposDe(s: Sessao, tol: number, corpo?: string, valores?: Record<string, number>) {
  const r = valores === undefined ? regenera(s, tol) : regeneraCom(s, tol, valores)
  const todos = [...r.corpos.keys()]
  if (todos.length === 0) throw new Error('O projeto ainda não tem sólidos. Crie uma primitiva ou extrudar um sketch.')
  if (corpo !== undefined && !r.corpos.has(corpo)) {
    throw new Error(`corpo desconhecido: ${corpo}. Correção: use um destes ids: ${todos.join(', ')}.`)
  }
  return { r, ids: corpo !== undefined ? [corpo] : todos }
}

function grava(s: Sessao, caminho: string, bytes: Uint8Array, corpos: string[]) {
  const abs = s.caminhoSaida(caminho)
  mkdirSync(path.dirname(abs), { recursive: true })
  writeFileSync(abs, bytes)
  return { caminho: abs, bytes: bytes.length, corpos }
}

export const toolsModelo: Tool[] = [
  {
    nome: 'modelo_info',
    descricao: 'Mede os corpos do modelo: caixa (bbox), volume em mm³, massa estimada em gramas, triângulos e se a malha é fechada. Regenera com tolerância de exportação.',
    entrada: {
      corpo: z.string().optional().describe('id de um corpo. Sem ele, mede todos.'),
      filamento: z.string().optional().describe('id do filamento para a massa (ver filamentos). Padrão: o do projeto ou pla.'),
    },
    exemplo: { filamento: 'pla' },
    executa(s, { corpo, filamento }: { corpo?: string; filamento?: string }) {
      const fil = filamentoDe(s, filamento)
      const { r, ids } = corposDe(s, TOL_EXPORT, corpo)
      const corpos = ids.map(id => {
        const m = r.corpos.get(id)!
        const bb = bbox(m)
        return {
          id,
          bbox: { min: bb.min.map(r2), max: bb.max.map(r2), tamanho: [0, 1, 2].map(i => r2(bb.max[i] - bb.min[i])) },
          volume_mm3: r2(Math.abs(volume(m))),
          massa_g: r2(massaGramas(m, fil)),
          triangulos: normaliza(m).idx.length / 3,
          fechada: fechada(m),
        }
      })
      const total = {
        volume_mm3: r2(corpos.reduce((a, c) => a + c.volume_mm3, 0)),
        massa_g: r2(corpos.reduce((a, c) => a + c.massa_g, 0)),
        triangulos: corpos.reduce((a, c) => a + c.triangulos, 0),
      }
      return { ok: true, corpos, total, filamento: fil.id }
    },
  },
  {
    nome: 'verificar_impressao',
    descricao: 'Verifica se os corpos imprimem na impressora do projeto com o filamento: malha aberta, fora do volume, overhang, base de apoio e avisos do filamento.',
    entrada: {
      filamento: z.string().optional().describe('id do filamento (ver filamentos). Padrão: o do projeto ou pla.'),
    },
    exemplo: { filamento: 'pla' },
    executa(s, { filamento }: { filamento?: string }) {
      const imp = impressoraDe(s)
      const fil = filamentoDe(s, filamento)
      const { r, ids } = corposDe(s, TOL_EXPORT)
      const corpos = ids.map(nome => ({ nome, malha: r.corpos.get(nome)! }))
      const achados: Achado[] = [
        ...verificar({ impressora: imp, filamento: fil, corpos }),
        ...avisosFilamento({ impressora: imp, filamento: fil, corpos: ids.map(nome => ({ nome })) }),
      ]
      return { ok: !achados.some(a => a.severidade === 'bloqueio' || a.severidade === 'erro'), achados }
    },
  },
  {
    nome: 'exportar',
    descricao: 'Exporta o modelo como STL ou 3MF na pasta do projeto. Recusa malha aberta, salvo forcar=true. Regenera com tolerância de exportação.',
    entrada: {
      formato: z.enum(['stl', '3mf']).describe('formato do arquivo.'),
      caminho: z.string().optional().describe('caminho do arquivo, relativo à pasta do projeto. Padrão: <projeto>-<corpo>-<impressora>.<formato>.'),
      corpo: z.string().optional().describe('id de um corpo. Sem ele, exporta todos: no 3MF num arquivo só; no STL, um arquivo por corpo.'),
      filamento: z.string().optional().describe('id do filamento para o 3MF (ver filamentos). Padrão: o do projeto ou pla.'),
      forcar: z.boolean().optional().describe('exporta mesmo com malha aberta.'),
      valores: z.record(z.string(), z.number()).optional().describe('valores temporários dos parâmetros só para esta exportação; não grava no projeto.'),
    },
    exemplo: { formato: '3mf', caminho: 'peca.3mf' },
    executa(s, { formato, caminho, corpo, filamento, forcar, valores }: { formato: 'stl' | '3mf'; caminho?: string; corpo?: string; filamento?: string; forcar?: boolean; valores?: Record<string, number> }) {
      const imp = impressoraDe(s)
      const fil = filamentoDe(s, filamento)
      const { r, ids } = corposDe(s, TOL_EXPORT, corpo, valores)
      const aberto = ids.find(id => !fechada(r.corpos.get(id)!))
      if (aberto !== undefined && !forcar) {
        throw new Error(`O corpo "${aberto}" tem malha aberta. Correção: corrija a feature ou use forcar=true para exportar mesmo assim.`)
      }
      const padrao = nomeArquivo(s.doc.nome ?? 'projeto', corpo ?? 'todos', s.doc.impressora, formato)
      if (formato === '3mf') {
        const bytes = escrever3mf({
          corpos: ids.map(id => ({ nome: id, malha: r.corpos.get(id)!, cor: s.doc.aparencia[id]?.cor ?? COR_PADRAO, slot: s.doc.aparencia[id]?.slot ?? 1 })),
          sabor: saborDe(imp),
          config: config3mfDe(imp, fil),
        })
        return { ok: true, arquivos: [grava(s, caminho ?? padrao, bytes, ids)] }
      }
      const base = caminho ?? padrao
      if (corpo === undefined && ids.length > 1) {
        const raiz = base.replace(/\.stl$/i, '')
        return { ok: true, arquivos: ids.map(id => grava(s, `${raiz}-${id}.stl`, stl(r.corpos.get(id)!), [id])) }
      }
      return { ok: true, arquivos: [grava(s, base, stl(r.corpos.get(ids[0])!), ids)] }
    },
  },
  {
    nome: 'captura',
    descricao: 'Gera capturas SVG do modelo (iso, frente, topo, direita) e grava <pasta>/<vista>.svg na pasta do projeto. As imagens também voltam na resposta.',
    entrada: {
      vistas: z.array(z.enum(['iso', 'frente', 'topo', 'direita'])).optional().describe('vistas a capturar. Padrão: todas.'),
      pasta: z.string().optional().describe('pasta de saída, relativa à pasta do projeto. Padrão: capturas.'),
      mostrarVolume: z.boolean().optional().describe('com aba conectada (PNG), inclui mesa, volume da impressora, grade e eixos. Padrão: false (a imagem enquadra só os corpos). O SVG headless nunca desenha o volume.'),
    },
    exemplo: { vistas: ['iso'] },
    executa(s, { vistas, pasta }: { vistas?: Vista[]; pasta?: string }) {
      const r = regenera(s, TOL_PREVIA)
      const corpos = [...r.corpos].map(([nome, malha]) => ({ nome, malha, cor: s.doc.aparencia[nome]?.cor }))
      const arquivos: string[] = []
      const _anexos: { nome: string; mime: string; texto: string }[] = []
      for (const v of vistas ?? VISTAS) {
        const svg = capturaSvg(corpos, v)
        const abs = s.caminhoSaida(path.join(pasta ?? 'capturas', `${v}.svg`))
        mkdirSync(path.dirname(abs), { recursive: true })
        writeFileSync(abs, svg, 'utf8')
        arquivos.push(abs)
        _anexos.push({ nome: `${v}.svg`, mime: 'image/svg+xml', texto: svg })
      }
      return { ok: true, arquivos, _anexos }
    },
  },
]
