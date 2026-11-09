// Ligação entre o Documento (.3dm.json) e a regeneração: avalia parâmetros e expressões, resolve sketches e monta a EntradaRegen.
import type { Documento, Feature } from '../doc/index.ts'
import { avalia } from '../expr/expr.ts'
import type { Parametros } from '../expr/expr.ts'
import type { Perfil, PlanoLocal, Vec2 } from '../kernel/tipos.ts'
import type { EntradaRegen, ItemRegen } from '../regen/tipos.ts'
import { achaSketch, sketchResolvido } from '../sketch/comandos.ts'
import type { Plano } from '../sketch/tipos.ts'

/** Campos cujas strings são expressões. Arrays herdam o nome do campo; objetos usam o nome de cada chave. */
const NUMERICOS = new Set([
  'distancia', 'distancia2', 'taper', 'graus', 'espessura', 'passo', 'n', 'diametro', 'profundidade', 'compensacao',
  'escala', 'tamanho', 'pos', 'dim', 'mover', 'girar', 'pivo', 'dir', 'origem', 'normal', 'eixoX', 'posicoes', 'ponto',
  'offset', 'ate',
])

/** Valor de cada parâmetro do documento (número) ou a mensagem de erro (string). */
export function valoresParametros(doc: Documento): Record<string, number | string> {
  const out: Record<string, number | string> = {}
  for (const nome of Object.keys(doc.parametros)) {
    const r = avalia(doc.parametros[nome].expr, doc.parametros)
    out[nome] = r.ok ? r.valor : r.erro
  }
  return out
}

/** Plano local do sketch no mundo. Mesma convenção de planoParaMundo (sketch/tipos.ts). */
export function planoDoSketch(plano: Plano): PlanoLocal {
  const o = plano.offset
  if (plano.base === 'XY') return { origem: [0, 0, o], normal: [0, 0, 1], eixoX: [1, 0, 0] }
  if (plano.base === 'XZ') return { origem: [0, o, 0], normal: [0, -1, 0], eixoX: [1, 0, 0] }
  return { origem: [o, 0, 0], normal: [1, 0, 0], eixoX: [0, 1, 0] }
}

const v2 = (p: { x: number; y: number }): Vec2 => [p.x, p.y]

/** Perfis do sketch prontos para o kernel. Lança Error (pt-BR) se o sketch não fecha um perfil válido. */
export function perfisDoSketch(doc: Documento, sketchId: string): Perfil[] {
  const r = sketchResolvido(doc, sketchId)
  if (!r) throw new Error(`Sketch "${sketchId}" não existe no documento.`)
  const { info, perfis } = r
  if (info.erros.length > 0) throw new Error(`O sketch tem cota inválida: ${info.erros[0].mensagem}`)
  if (info.estado === 'conflito') throw new Error('O sketch tem restrições em conflito.')
  if (perfis.pontasSoltas.length > 0) throw new Error('O sketch tem contorno aberto.')
  if (perfis.autointersecoes.length > 0) throw new Error('O sketch se cruza.')
  if (perfis.perfis.length === 0) throw new Error('O sketch não tem perfil fechado.')
  return perfis.perfis.map((p) => ({ externo: p.poligono.map(v2), furos: p.furos.map((f) => f.map(v2)) }))
}

/** Copia `valor` avaliando as strings de campos numéricos. Lança Error se uma expressão falha. */
function resolveCampos(valor: unknown, params: Parametros, nome: string): unknown {
  if (typeof valor === 'string') {
    if (!NUMERICOS.has(nome)) return valor
    const r = avalia(valor, params)
    if (!r.ok) throw new Error(`Expressão inválida em "${nome}": ${r.erro}`)
    return r.valor
  }
  if (Array.isArray(valor)) return valor.map((v) => resolveCampos(v, params, nome))
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, resolveCampos(v, params, k)]))
  }
  return valor
}

function converteFeature(f: Feature, params: Parametros): ItemRegen {
  const suprimida = f.suprimida === true
  if (f.tipo === 'sketch') return { id: f.id, tipo: 'sketch', suprimida }
  try {
    const campos = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, resolveCampos(v, params, k)]))
    return { ...campos, suprimida } as unknown as ItemRegen
  } catch (err) {
    return {
      id: f.id,
      tipo: 'invalida',
      causa: err instanceof Error ? err.message : String(err),
      correcao: 'Corrija a expressão ou o parâmetro usado.',
      suprimida,
    }
  }
}

/** Entrada da regeneração a partir do documento. Os perfis de cada sketch são resolvidos uma vez por chamada. */
export function entradaDe(doc: Documento, opc: { tol?: number } = {}): EntradaRegen {
  const perfisPorSketch = new Map<string, Perfil[]>()
  return {
    features: doc.features.map((f) => converteFeature(f, doc.parametros)),
    marcador: doc.marcadorHistorico,
    resolvedor: (id) => {
      let perfis = perfisPorSketch.get(id)
      if (!perfis) {
        perfis = perfisDoSketch(doc, id)
        perfisPorSketch.set(id, perfis)
      }
      return perfis
    },
    planoDe: (id) => {
      const sk = achaSketch(doc, id)
      if (!sk) throw new Error(`Sketch "${id}" não existe no documento.`)
      let offset = sk.plano.offset
      if (sk.plano.offsetExpr) {
        const r = avalia(sk.plano.offsetExpr, doc.parametros)
        if (!r.ok) throw new Error(`Offset do plano do sketch "${id}": ${r.erro}`)
        offset = r.valor
      }
      return planoDoSketch({ ...sk.plano, offset })
    },
    tol: opc.tol,
  }
}
