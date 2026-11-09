// Arquivo de aliases editável (PROJETO_BASE §7.6): texto no formato do acad.pgp, `ALIAS, *COMANDO`. Lógica pura, sem DOM.
import type { Registro } from './registro.ts'

export interface DefAlias { alias: string; comando: string }

/** Texto do tipo acad.pgp: uma definição por linha `L, *LINHA`; `;` inicia comentário; linhas vazias ignoradas; alias e comando são normalizados em maiúsculas; erro em linha inválida (sem vírgula, sem *, alias com espaço) é devolvido, as válidas são aplicadas. */
export function parseAliases(texto: string): { defs: DefAlias[]; erros: { linha: number; texto: string }[] } {
  const defs: DefAlias[] = [], erros: { linha: number; texto: string }[] = []
  texto.split('\n').forEach((bruta, i) => {
    const l = bruta.split(';')[0].trim()
    if (!l) return
    const v = l.indexOf(',')
    const alias = v < 0 ? '' : l.slice(0, v).trim()
    const resto = v < 0 ? '' : l.slice(v + 1).trim()
    const comando = resto.startsWith('*') ? resto.slice(1).trim() : ''
    if (!alias || /\s/.test(alias) || !comando || /\s/.test(comando)) return void erros.push({ linha: i + 1, texto: l })
    defs.push({ alias: alias.toUpperCase(), comando: comando.toUpperCase() })
  })
  return { defs, erros }
}

export function serializaAliases(defs: DefAlias[]): string {
  return defs.map(d => `${d.alias}, *${d.comando}`).join('\n')
}

/** Última definição vale: remove repetições do mesmo alias mantendo a última. */
export function resolveDefs(defs: DefAlias[]): DefAlias[] {
  const ult = new Map<string, DefAlias>()
  for (const d of defs) { const k = d.alias.toUpperCase(); ult.delete(k); ult.set(k, d) }
  return [...ult.values()]
}

/** Aplica no registro (usa `defineAlias`). Comando inexistente vira erro devolvido, não lança. */
export function aplicaAliases(reg: Registro, defs: DefAlias[]): { aplicados: number; erros: DefAlias[] } {
  let aplicados = 0
  const erros: DefAlias[] = []
  for (const d of resolveDefs(defs)) {
    if (reg.defineAlias(d.alias, d.comando)) aplicados++
    else erros.push(d)
  }
  return { aplicados, erros }
}

export const CHAVE_ALIASES = '3dm.aliases'

/** Texto salvo ('' se não há). Armazenamento bloqueado ou inválido vira ''. */
export function leAliases(a?: Pick<Storage, 'getItem'>): string {
  try { return (a ?? localStorage).getItem(CHAVE_ALIASES) ?? '' } catch { return '' }
}

export function salvaAliases(texto: string, a?: Pick<Storage, 'setItem'>): void {
  try { (a ?? localStorage).setItem(CHAVE_ALIASES, texto) } catch { /* sem armazenamento: vale só nesta sessão */ }
}
