// Esquemas das features para o painel de edição (lógica pura, sem DOM). Campos planos (chave = controle do painel)
// viram a estrutura do Feature em toFeature; fromFeature faz a volta. Testado em test/features-esquemas.test.ts.
import type { Feature } from '@3dm/core/doc'
import { T } from '../textos.ts'

export type Campo = {
  chave: string
  rotulo: string
  tipo: 'num' | 'vec2' | 'vec3' | 'select' | 'bool' | 'alvo' | 'sketch' | 'corpos' | 'plano' | 'listaVec2' | 'perfis'
  opcoes?: [valor: string, rotulo: string][]
  padrao?: unknown
  dica?: string
  mostraSe?: (f: Feature) => boolean
}

export interface Esquema { rotulo: string; campos: Campo[]; geradora: boolean }

export type PlanoCampo = {
  origem: [string | number, string | number, string | number]
  normal: [number, number, number]
  eixoX: [number, number, number]
}

type Base = 'XY' | 'XZ' | 'YZ'

const opc = (...vs: string[]): [string, string][] => vs.map((v): [string, string] => [v, T.painel.opcoes[v]])
const naoNova = (f: Feature) => (f.operacao ?? 'nova') !== 'nova'
const circular = (f: Feature) => f.modo === 'circular'
const num = (chave: string, rotulo: string, padrao: string, mostraSe?: (f: Feature) => boolean): Campo =>
  ({ chave, rotulo, tipo: 'num', padrao, mostraSe })
const bool = (chave: string, rotulo: string, padrao: boolean): Campo => ({ chave, rotulo, tipo: 'bool', padrao })
const PLANO = (chave = 'plano'): Campo => ({ chave, rotulo: T.painel.campos[chave], tipo: 'plano', padrao: planoDe('XY', '0') })

const SKETCH: Campo = { chave: 'sketch', rotulo: T.painel.campos.sketch, tipo: 'sketch' }
const PERFIS: Campo = { chave: 'perfis', rotulo: T.painel.campos.perfis, tipo: 'perfis', padrao: [] }
const POS: Campo = { chave: 'pos', rotulo: T.painel.campos.pos, tipo: 'vec3', padrao: ['0', '0', '0'] }
const ALVO: Campo = { chave: 'alvo', rotulo: T.painel.campos.alvo, tipo: 'alvo' }
const ALVO_OP: Campo = { ...ALVO, mostraSe: naoNova }
const OPERACAO: Campo = {
  chave: 'operacao', rotulo: T.painel.campos.operacao, tipo: 'select',
  opcoes: opc('nova', 'unir', 'subtrair', 'interseccao'), padrao: 'nova',
}

export const ESQUEMAS: Record<string, Esquema> = {
  extrude: {
    rotulo: T.painel.esquemas.extrude, geradora: true, campos: [
      SKETCH, PERFIS,
      num('distancia', T.painel.campos.distancia, '10', f => f.modo !== 'ate'),
      { chave: 'modo', rotulo: T.painel.campos.modo, tipo: 'select', opcoes: opc('normal', 'simetrica', 'duas', 'ate'), padrao: 'normal' },
      num('distancia2', T.painel.campos.distancia2, '5', f => f.modo === 'duas'),
      { chave: 'ate', rotulo: T.painel.campos.ate, tipo: 'plano', padrao: planoDe('XY', '0'), mostraSe: f => f.modo === 'ate' },
      num('taper', T.painel.campos.taper, '0', f => (f.modo ?? 'normal') === 'normal'),
      OPERACAO, ALVO_OP,
      { chave: 'bordaModo', rotulo: T.painel.campos.bordaModo, tipo: 'select', opcoes: opc('nenhuma', 'chanfro', 'fillet'), padrao: 'nenhuma' },
      num('bordaTamanho', T.painel.campos.bordaTamanho, '1', f => (f.bordaModo ?? 'nenhuma') !== 'nenhuma'),
      {
        chave: 'bordaOnde', rotulo: T.painel.campos.bordaOnde, tipo: 'select', opcoes: opc('topo', 'base', 'ambas'), padrao: 'topo',
        mostraSe: f => (f.bordaModo ?? 'nenhuma') !== 'nenhuma',
      },
    ],
  },
  revolve: {
    rotulo: T.painel.esquemas.revolve, geradora: true, campos: [
      SKETCH, PERFIS,
      { chave: 'eixoPonto', rotulo: T.painel.campos.eixoPonto, tipo: 'vec2', padrao: ['0', '0'] },
      { chave: 'eixoDir', rotulo: T.painel.campos.eixoDir, tipo: 'vec2', padrao: ['1', '0'] },
      num('graus', T.painel.campos.graus, '360'),
      bool('simetrico', T.painel.campos.simetrico, false),
      OPERACAO, ALVO_OP,
    ],
  },
  caixa: {
    rotulo: T.painel.esquemas.caixa, geradora: true, campos: [
      POS, { chave: 'dim', rotulo: T.painel.campos.dim, tipo: 'vec3', padrao: ['10', '10', '10'] }, OPERACAO, ALVO_OP,
    ],
  },
  cilindro: {
    rotulo: T.painel.esquemas.cilindro, geradora: true, campos: [
      POS, num('raio', T.painel.campos.raio, '5'), num('altura', T.painel.campos.altura, '10'), OPERACAO, ALVO_OP,
    ],
  },
  esfera: {
    rotulo: T.painel.esquemas.esfera, geradora: true, campos: [POS, num('raio', T.painel.campos.raio, '5'), OPERACAO, ALVO_OP],
  },
  cone: {
    rotulo: T.painel.esquemas.cone, geradora: true, campos: [
      POS, num('rBase', T.painel.campos.rBase, '5'), num('rTopo', T.painel.campos.rTopo, '2'), num('altura', T.painel.campos.altura, '10'),
      OPERACAO, ALVO_OP,
    ],
  },
  toro: {
    rotulo: T.painel.esquemas.toro, geradora: true, campos: [
      POS, num('raioMaior', T.painel.campos.raioMaior, '10'), num('raioMenor', T.painel.campos.raioMenor, '2'), OPERACAO, ALVO_OP,
    ],
  },
  booleana: {
    rotulo: T.painel.esquemas.booleana, geradora: false, campos: [
      { chave: 'op', rotulo: T.painel.campos.op, tipo: 'select', opcoes: opc('unir', 'subtrair', 'interseccao'), padrao: 'subtrair' },
      ALVO,
      { chave: 'ferramentas', rotulo: T.painel.campos.ferramentas, tipo: 'corpos', padrao: [] },
      bool('manter', T.painel.campos.manter, false),
    ],
  },
  shell: {
    rotulo: T.painel.esquemas.shell, geradora: false, campos: [
      ALVO, num('espessura', T.painel.campos.espessura, '1'),
      bool('abrirTopo', T.painel.campos.abrirTopo, true), bool('abrirBase', T.painel.campos.abrirBase, false),
    ],
  },
  furo: {
    rotulo: T.painel.esquemas.furo, geradora: false, campos: [
      ALVO, PLANO(),
      { chave: 'posicoes', rotulo: T.painel.campos.posicoes, tipo: 'listaVec2', padrao: [['0', '0']] },
      { chave: 'tipoFuro', rotulo: T.painel.campos.tipoFuro, tipo: 'select', opcoes: opc('simples', 'escareado', 'rebaixado'), padrao: 'simples' },
      {
        chave: 'preset', rotulo: T.painel.campos.preset, tipo: 'select', padrao: '',
        opcoes: [['', T.painel.nenhum], ...opc('M2', 'M3', 'M4', 'M5', 'M6', 'M8')],
      },
      num('diametro', T.painel.campos.diametro, '5', f => !f.preset),
      bool('inserto', T.painel.campos.inserto, false),
      num('profundidade', T.painel.campos.profundidade, ''),
      num('compensacao', T.painel.campos.compensacao, '0'),
    ],
  },
  padrao: {
    rotulo: T.painel.esquemas.padrao, geradora: false, campos: [
      ALVO,
      { chave: 'modo', rotulo: T.painel.campos.modo, tipo: 'select', opcoes: opc('linear', 'circular'), padrao: 'linear' },
      num('n', T.painel.campos.n, '3'),
      { chave: 'dir', rotulo: T.painel.campos.dir, tipo: 'vec3', padrao: ['1', '0', '0'], mostraSe: f => !circular(f) },
      num('passo', T.painel.campos.passo, '10', f => !circular(f)),
      { chave: 'eixoPonto', rotulo: T.painel.campos.eixoPonto, tipo: 'vec3', padrao: ['0', '0', '0'], mostraSe: circular },
      { chave: 'eixoDir', rotulo: T.painel.campos.eixoDir, tipo: 'vec3', padrao: ['0', '0', '1'], mostraSe: circular },
      num('graus', T.painel.campos.graus, '360', circular),
    ],
  },
  espelho: {
    rotulo: T.painel.esquemas.espelho, geradora: false, campos: [ALVO, PLANO(), bool('manter', T.painel.campos.manter, true)],
  },
  corte: {
    rotulo: T.painel.esquemas.corte, geradora: false, campos: [
      ALVO, PLANO(),
      { chave: 'manter', rotulo: T.painel.campos.manter, tipo: 'select', opcoes: opc('acima', 'abaixo', 'ambos'), padrao: 'acima' },
    ],
  },
  transformacao: {
    rotulo: T.painel.esquemas.transformacao, geradora: false, campos: [
      ALVO,
      { chave: 'mover', rotulo: T.painel.campos.mover, tipo: 'vec3', padrao: ['0', '0', '0'] },
      { chave: 'girar', rotulo: T.painel.campos.girar, tipo: 'vec3', padrao: ['0', '0', '0'] },
      { chave: 'pivo', rotulo: T.painel.campos.pivo, tipo: 'vec3', padrao: ['0', '0', '0'] },
      num('escala', T.painel.campos.escala, '1'),
    ],
  },
}

/** Campos planos que viram parte de uma estrutura do Feature (dims, eixo, borda, abrir). */
const PLANOS_POR_TIPO: Record<string, string[]> = {
  extrude: ['bordaModo', 'bordaTamanho', 'bordaOnde'],
  revolve: ['eixoPonto', 'eixoDir'],
  padrao: ['eixoPonto', 'eixoDir'],
  cilindro: ['raio', 'altura'],
  esfera: ['raio'],
  cone: ['rBase', 'rTopo', 'altura'],
  toro: ['raioMaior', 'raioMenor'],
  shell: ['abrirTopo', 'abrirBase'],
}
/** Listas que, vazias, somem do Feature (não são obrigatórias). */
const VAZIO_OMITE = new Set(['perfis', 'mover', 'girar', 'pivo'])

/** Converte o rascunho plano (com valores do painel) na estrutura do Feature. Campo vazio ('') some. */
export function toFeature(flat: Feature): Feature {
  const f: Feature = { id: flat.id, tipo: flat.tipo }
  for (const [k, v] of Object.entries(flat)) {
    if (k === 'id' || k === 'tipo' || v === '') continue
    if (VAZIO_OMITE.has(k) && Array.isArray(v) && v.length === 0) continue
    f[k] = v
  }
  for (const k of PLANOS_POR_TIPO[flat.tipo] ?? []) delete f[k]
  switch (flat.tipo) {
    case 'extrude':
      if (flat.bordaModo === 'chanfro' || flat.bordaModo === 'fillet')
        f.borda = { modo: flat.bordaModo, tamanho: flat.bordaTamanho, onde: flat.bordaOnde }
      break
    case 'revolve':
    case 'padrao':
      if (flat.eixoPonto !== undefined && flat.eixoDir !== undefined) f.eixo = { ponto: flat.eixoPonto, dir: flat.eixoDir }
      break
    case 'cilindro': f.dim = [flat.raio, flat.altura]; break
    case 'esfera': f.dim = [flat.raio]; break
    case 'cone': f.dim = [flat.rBase, flat.rTopo, flat.altura]; break
    case 'toro': f.dim = [flat.raioMaior, flat.raioMenor]; break
    case 'shell':
      f.abrir = [...(flat.abrirTopo === true ? ['topo'] : []), ...(flat.abrirBase === true ? ['base'] : [])]
      break
  }
  return f
}

/** Inverso de toFeature: estrutura do Feature para o rascunho plano que o painel edita. */
export function fromFeature(f: Feature): Feature {
  const g: Feature = { ...f }
  const d = (f.dim as unknown[] | undefined) ?? []
  switch (f.tipo) {
    case 'extrude': {
      const b = f.borda as { modo: unknown; tamanho: unknown; onde: unknown } | undefined
      delete g.borda
      if (b) { g.bordaModo = b.modo; g.bordaTamanho = b.tamanho; g.bordaOnde = b.onde }
      break
    }
    case 'revolve':
    case 'padrao': {
      const e = f.eixo as { ponto: unknown; dir: unknown } | undefined
      delete g.eixo
      if (e) { g.eixoPonto = e.ponto; g.eixoDir = e.dir }
      break
    }
    case 'cilindro': delete g.dim; g.raio = d[0]; g.altura = d[1]; break
    case 'esfera': delete g.dim; g.raio = d[0]; break
    case 'cone': delete g.dim; g.rBase = d[0]; g.rTopo = d[1]; g.altura = d[2]; break
    case 'toro': delete g.dim; g.raioMaior = d[0]; g.raioMenor = d[1]; break
    case 'shell': {
      const a = (f.abrir as string[] | undefined) ?? []
      delete g.abrir
      g.abrirTopo = a.includes('topo')
      g.abrirBase = a.includes('base')
      break
    }
  }
  return g
}

/** Feature nova com os valores padrão do esquema. Alvo: o corpo mais recente (booleana exige; nos demais, omitido). */
export function novaFeature(tipo: string, id: string, ctx: { corpos: string[]; sketches: string[] }): Feature {
  const esq = ESQUEMAS[tipo]
  if (!esq) throw new Error(`Tipo de feature sem esquema: ${tipo}.`)
  const flat: Feature = { id, tipo }
  for (const c of esq.campos) {
    if (c.padrao !== undefined) flat[c.chave] = JSON.parse(JSON.stringify(c.padrao))
    if (c.tipo === 'sketch') flat[c.chave] = ctx.sketches.at(-1) ?? ''
    if (c.tipo === 'alvo' && tipo === 'booleana') flat[c.chave] = ctx.corpos.at(-1) ?? ''
  }
  return toFeature(flat)
}

/** Plano local de uma base (XY, XZ, YZ) deslocado por `offset` (expressão ou número). */
export function planoDe(base: Base, offset: string): PlanoCampo {
  const o = normalizaNum(offset)
  if (base === 'XY') return { origem: [0, 0, o], normal: [0, 0, 1], eixoX: [1, 0, 0] }
  if (base === 'XZ') return { origem: [0, o, 0], normal: [0, -1, 0], eixoX: [1, 0, 0] }
  return { origem: [o, 0, 0], normal: [1, 0, 0], eixoX: [0, 1, 0] }
}

/** Inverso de planoDe: base e deslocamento (como texto) para o campo do painel. */
export function planoParaCampo(p: PlanoCampo): { base: Base; offset: string } {
  const base: Base = p.normal[2] !== 0 ? 'XY' : p.normal[1] !== 0 ? 'XZ' : 'YZ'
  const eixo = base === 'XY' ? 2 : base === 'XZ' ? 1 : 0
  return { base, offset: String(p.origem[eixo]) }
}

/** Texto de número: vazio vira '', número puro vira number, o resto é expressão (ex.: "L/2") e fica como string. */
export function normalizaNum(s: string): string | number {
  const t = s.trim()
  if (t === '') return ''
  return /^[-+]?(\d+(\.\d*)?|\.\d+)$/.test(t) ? Number(t) : t
}

const OPCIONAIS = new Set(['alvo', 'perfis', 'preset', 'profundidade', 'taper', 'compensacao', 'escala', 'mover', 'girar', 'pivo'])
const CHECADOS = new Set(['num', 'vec2', 'vec3', 'sketch', 'listaVec2', 'corpos'])

/** Avisos leves (pt-BR) sobre campos obrigatórios vazios. Recebe o rascunho plano, só com os campos visíveis. */
export function valida(f: Feature): string[] {
  const esq = ESQUEMAS[f.tipo]
  if (!esq) return []
  const out: string[] = []
  for (const c of esq.campos) {
    if (!CHECADOS.has(c.tipo) || OPCIONAIS.has(c.chave) || !(c.mostraSe?.(f) ?? true)) continue
    const v = f[c.chave]
    if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) out.push(T.painel.vazio(c.rotulo))
  }
  return out
}
