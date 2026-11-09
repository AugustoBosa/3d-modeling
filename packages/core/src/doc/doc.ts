import type { Documento, Feature } from './tipos.ts'

export const IMPRESSORA_PADRAO = 'bambu-p2s'

export function novoDocumento(impressora: string = IMPRESSORA_PADRAO): Documento {
  return {
    formato: '3d-modeling', versao: 1, unidade: 'mm', impressora,
    parametros: {}, features: [], marcadorHistorico: null, aparencia: {},
  }
}

const objeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Slot AMS/extrusora: inteiro de 1 a 16. */
export const slotValido = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 16

const TIPOS_EXPOSTO = ['numero', 'lista', 'sim-nao']

/** Nome de parâmetro: letra ou _, depois letras, dígitos ou _ (precisa caber numa expressão). */
export const NOME_PARAMETRO = /^[A-Za-z_][A-Za-z0-9_]*$/

/** Valida um JSON desconhecido contra o schema v1. Devolve a lista de erros (vazia = válido). Nunca executa nada. */
export function valida(x: unknown): string[] {
  const e: string[] = []
  if (!objeto(x)) return ['o documento precisa ser um objeto']
  if (x.formato !== '3d-modeling') e.push('formato deve ser "3d-modeling"')
  if (x.versao !== 1) e.push(`versão ${String(x.versao)} não suportada (esperado 1)`)
  if (x.unidade !== 'mm') e.push('unidade deve ser "mm"')
  if (x.nome !== undefined && typeof x.nome !== 'string') e.push('nome deve ser texto')
  if (typeof x.impressora !== 'string' || !x.impressora) e.push('impressora deve ser o id de um perfil')
  if (!objeto(x.parametros)) e.push('parametros deve ser um objeto')
  else for (const [k, p] of Object.entries(x.parametros)) {
    if (!NOME_PARAMETRO.test(k)) e.push(`parâmetro "${k}": nome inválido`)
    if (!objeto(p) || typeof p.expr !== 'string') e.push(`parâmetro "${k}": expr deve ser texto`)
  }
  if (!Array.isArray(x.features)) e.push('features deve ser uma lista')
  else {
    const ids = new Set<string>()
    x.features.forEach((f: unknown, i: number) => {
      if (!objeto(f) || typeof f.id !== 'string' || !f.id || typeof f.tipo !== 'string' || !f.tipo) return void e.push(`features[${i}]: precisa de id e tipo`)
      if (ids.has(f.id)) e.push(`features[${i}]: id "${f.id}" repetido`)
      ids.add(f.id)
    })
    if (x.marcadorHistorico !== null && (typeof x.marcadorHistorico !== 'string' || !ids.has(x.marcadorHistorico))) e.push('marcadorHistorico deve ser null ou o id de uma feature')
  }
  if (!objeto(x.aparencia)) e.push('aparencia deve ser um objeto')
  else for (const [k, a] of Object.entries(x.aparencia)) if (!objeto(a) || typeof a.cor !== 'string') e.push(`aparencia "${k}": cor deve ser texto`)
  if (x.filamento !== undefined && typeof x.filamento !== 'string') e.push('filamento deve ser texto')
  if (x.slots !== undefined) {
    if (!objeto(x.slots)) e.push('slots deve ser um objeto')
    else for (const [k, s] of Object.entries(x.slots)) if (!objeto(s) || typeof s.filamento !== 'string' || typeof s.cor !== 'string') e.push(`slots "${k}": filamento e cor devem ser texto`)
  }
  if (x.expostos !== undefined) {
    if (!Array.isArray(x.expostos)) e.push('expostos deve ser uma lista')
    else x.expostos.forEach((s: unknown, i: number) => {
      if (!objeto(s) || typeof s.parametro !== 'string' || typeof s.rotulo !== 'string' || typeof s.tipo !== 'string' || !TIPOS_EXPOSTO.includes(s.tipo)) e.push(`expostos[${i}]: precisa de parametro, rotulo e tipo (numero, lista ou sim-nao)`)
    })
  }
  if (objeto(x.aparencia)) for (const [k, a] of Object.entries(x.aparencia)) if (objeto(a) && a.slot !== undefined && !slotValido(a.slot)) e.push(`aparencia "${k}": slot deve ser inteiro de 1 a 16`)
  return e
}

/** Texto JSON → Documento válido. Lança Error com todos os erros juntos. */
export function lerDocumento(texto: string): Documento {
  let x: unknown
  try { x = JSON.parse(texto) } catch (err) { throw new Error(`JSON inválido: ${(err as Error).message}`) }
  const erros = valida(x)
  if (erros.length) throw new Error(erros.join('; '))
  return x as Documento
}

export const textoDocumento = (d: Documento) => JSON.stringify(d, null, 2)
