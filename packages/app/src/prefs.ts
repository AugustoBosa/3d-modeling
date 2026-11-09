// Preferências do usuário (localStorage). Tudo em try/catch: modo privado ou bloqueio não pode quebrar o app.
import type { PrefTema } from './tema.ts'
import type { Preset } from './viewport/nav.ts'

export interface Prefs {
  tema: PrefTema
  navegacao: Preset
  teclasBlender: boolean // teclas imediatas G/R/S etc. (usadas a partir da F1)
  pixels: 1 | 1.5 | 2 // teto da densidade de pixels da vista
}

export const PADRAO: Prefs = { tema: 'auto', navegacao: 'blender', teclasBlender: true, pixels: 2 }
const CHAVE = '3dm.prefs'

const em = <T>(v: unknown, ok: readonly T[], pad: T): T => ok.includes(v as T) ? (v as T) : pad

/** Valida campo a campo: valor desconhecido volta ao padrão. */
export function normaliza(x: unknown): Prefs {
  const o = (typeof x === 'object' && x !== null ? x : {}) as Record<string, unknown>
  return {
    tema: em(o.tema, ['auto', 'claro', 'escuro'], PADRAO.tema),
    navegacao: em(o.navegacao, ['blender', 'autocad'], PADRAO.navegacao),
    teclasBlender: typeof o.teclasBlender === 'boolean' ? o.teclasBlender : PADRAO.teclasBlender,
    pixels: em(o.pixels, [1, 1.5, 2], PADRAO.pixels),
  }
}

type Armazem = Pick<Storage, 'getItem' | 'setItem'>

export function lePrefs(a?: Armazem): Prefs {
  try { return normaliza(JSON.parse((a ?? localStorage).getItem(CHAVE) ?? 'null')) } catch { return { ...PADRAO } }
}

export function salvaPrefs(p: Prefs, a?: Armazem) {
  try { (a ?? localStorage).setItem(CHAVE, JSON.stringify(p)) } catch { /* sem armazenamento: vale só nesta sessão */ }
}
