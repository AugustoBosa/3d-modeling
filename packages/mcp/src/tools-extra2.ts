// Tools MCP de sólido e projeto que faltavam: transformar, corte, cor por corpo e parâmetros expostos.
import { z } from 'zod'
import { adicionaFeature, idLivre, valoresParametros } from '@3dm/core/features'
import type { Exposto, Feature } from '@3dm/core/doc'
import { comandoDoc, executaChecando, regenera, resumo } from './modelo.ts'
import type { Sessao } from './sessao.ts'
import type { Tool } from './tool.ts'

const Num = z.union([z.number(), z.string()])
const Vec3 = z.tuple([Num, Num, Num])
const Plano = z.object({
  origem: Vec3.describe('origem do plano, em mm'),
  normal: Vec3.describe('normal do plano; o lado da normal é o "acima"'),
  eixoX: Vec3.describe('direção do eixo X local do plano'),
})
const ALVO = z.string().optional().describe('corpo afetado; omitido = o corpo mais recente')
const ExpostoZ = z.object({
  parametro: z.string().describe('nome do parâmetro do projeto'),
  rotulo: z.string().describe('texto mostrado no modo customizar'),
  tipo: z.enum(['numero', 'lista', 'sim-nao']).describe('numero, lista de opções ou sim/não'),
  min: z.number().optional(),
  max: z.number().optional(),
  passo: z.number().optional(),
  opcoes: z.array(z.object({ rotulo: z.string(), valor: z.number() })).optional().describe('opções, obrigatórias no tipo lista'),
  grupo: z.string().optional(),
})

type Numero = number | string
type V3 = [Numero, Numero, Numero]

const semVazios = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))

/** Próximo id de corpo copia1, copia2... que não colide com features nem corpos. */
function copiaLivre(s: Sessao): string {
  const corpos = regenera(s).corpos
  let n = 1
  while (s.doc.features.some(f => f.id === `copia${n}`) || corpos.has(`copia${n}`)) n++
  return `copia${n}`
}

/** Valida um exposto antes de gravar: parâmetro existente, min <= max, lista com opções. */
function validaExposto(s: Sessao, e: Exposto) {
  if (!Object.hasOwn(s.doc.parametros, e.parametro)) {
    throw new Error(`parâmetro desconhecido: ${e.parametro}. Correção: defina-o antes com parametro_definir (existentes: ${Object.keys(s.doc.parametros).join(', ') || 'nenhum'}).`)
  }
  if (e.min !== undefined && e.max !== undefined && e.min > e.max) {
    throw new Error(`min (${e.min}) maior que max (${e.max}) em "${e.parametro}". Correção: troque os valores.`)
  }
  if (e.tipo === 'lista' && !e.opcoes?.length) {
    throw new Error(`"${e.parametro}" é do tipo lista e precisa de opcoes. Correção: informe opcoes com rotulo e valor.`)
  }
}

export const toolsExtra2: Tool[] = [
  {
    nome: 'transformar',
    descricao: 'Move, gira e/ou escala um corpo. mover em mm; girar em graus em torno dos eixos X, Y, Z globais, pela ordem; pivo é o centro (padrão: origem). copiar=true deixa o original e cria um corpo novo (copia1, copia2...). Precisa de mover, girar ou escala. Desfazível.',
    entrada: {
      alvo: ALVO,
      mover: Vec3.optional().describe('translação em mm, [x, y, z]'),
      girar: Vec3.optional().describe('rotação em graus em torno de X, Y e Z globais'),
      pivo: Vec3.optional().describe('centro da rotação e da escala, em mm. Padrão: origem.'),
      escala: z.union([Num, Vec3]).optional().describe('fator de escala: número (uniforme) ou [x, y, z]'),
      copiar: z.boolean().optional().describe('true = o original fica e o resultado vira um corpo novo'),
    },
    exemplo: { alvo: 'cx1', mover: [10, 0, 0] },
    executa(s: Sessao, a: { alvo?: string; mover?: V3; girar?: V3; pivo?: V3; escala?: Numero | V3; copiar?: boolean }) {
      if (a.mover === undefined && a.girar === undefined && a.escala === undefined) {
        throw new Error('transformar precisa de mover, girar ou escala. Correção: informe ao menos um deles.')
      }
      const id = idLivre(s.doc, 'tr')
      const copia = a.copiar ? copiaLivre(s) : undefined
      const f = semVazios({ id, tipo: 'transformacao', alvo: a.alvo, mover: a.mover, girar: a.girar, pivo: a.pivo, escala: a.escala, copiaId: copia })
      const r = executaChecando(s, adicionaFeature(f as Feature))
      return { ok: true, id, copia, ...resumo(r) }
    },
  },
  {
    nome: 'corte',
    descricao: 'Corta o corpo com um plano e mantém o lado: acima (lado da normal), abaixo ou ambos (ambos divide em <alvo> e <alvo>_b). Desfazível.',
    entrada: {
      alvo: ALVO,
      plano: Plano.describe('plano de corte, em mm'),
      manter: z.enum(['acima', 'abaixo', 'ambos']).describe('lado do plano que fica'),
    },
    exemplo: { plano: { origem: [0, 0, 10], normal: [0, 0, 1], eixoX: [1, 0, 0] }, manter: 'acima' },
    executa(s: Sessao, a: { alvo?: string; plano: { origem: V3; normal: V3; eixoX: V3 }; manter: 'acima' | 'abaixo' | 'ambos' }) {
      const id = idLivre(s.doc, 'ct')
      const r = executaChecando(s, adicionaFeature(semVazios({ ...a, id, tipo: 'corte' }) as Feature))
      return { ok: true, id, ...resumo(r) }
    },
  },
  {
    nome: 'cor_definir',
    descricao: 'Define a cor (#RRGGBB) e o slot de AMS/extrusora de um corpo para a exportação. Sem slot, usa 1. Desfazível.',
    entrada: {
      corpo: z.string().describe('id do corpo, ex.: cx1'),
      cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).describe('cor em #RRGGBB'),
      slot: z.number().int().min(1).optional().describe('slot do AMS/extrusora, inteiro a partir de 1. Padrão: 1.'),
    },
    exemplo: { corpo: 'cx1', cor: '#d9b36c', slot: 2 },
    executa(s: Sessao, { corpo, cor, slot }: { corpo: string; cor: string; slot?: number }) {
      const corpos = [...regenera(s).corpos.keys()]
      if (!corpos.includes(corpo)) {
        throw new Error(`corpo desconhecido: ${corpo}. Correção: use um destes ids: ${corpos.join(', ') || '(nenhum)'}.`)
      }
      s.executa(comandoDoc(`COR ${corpo}`, d => { d.aparencia[corpo] = { cor, ...(slot ? { slot } : {}) } }))
      return { ok: true, corpo, cor, slot: slot ?? 1 }
    },
  },
  {
    nome: 'parametros_expostos',
    descricao: 'Lista, define ou remove os parâmetros expostos (modo customizar). definir substitui a entrada do mesmo parâmetro; remover tira pelo nome do parâmetro. Sem argumentos, só lista. Desfazível quando altera.',
    entrada: {
      definir: z.array(ExpostoZ).optional().describe('parâmetros a expor ou atualizar'),
      remover: z.array(z.string()).optional().describe('nomes dos parâmetros a deixar de expor'),
    },
    exemplo: { definir: [{ parametro: 'H', rotulo: 'Altura', tipo: 'numero', min: 10, max: 100 }] },
    executa(s: Sessao, { definir, remover }: { definir?: Exposto[]; remover?: string[] }) {
      if (definir !== undefined || remover !== undefined) {
        for (const e of definir ?? []) validaExposto(s, e)
        const saem = new Set([...(remover ?? []), ...(definir ?? []).map(e => e.parametro)])
        s.executa(comandoDoc('EXPOSTOS', d => {
          d.expostos = [...(d.expostos ?? []).filter(e => !saem.has(e.parametro)), ...(definir ?? [])]
        }))
      }
      const valores = valoresParametros(s.doc)
      const expostos = (s.doc.expostos ?? []).map(e => ({
        ...e,
        expr: s.doc.parametros[e.parametro]?.expr,
        valor: valores[e.parametro],
      }))
      return { ok: true, expostos }
    },
  },
]
