// Rastreamento de objeto (OTRACK, F11): guarda pontos "adquiridos" (o cursor passou perto de extremidade, centro ou
// ponto médio) e oferece guias horizontais/verticais que passam por eles. Funções puras, mm.
import type { Pt, SketchFeature } from './tipos.ts'
import { candidatosOsnap } from './snap.ts'

export interface Guia { de: Pt; dir: 'H' | 'V'; ref: string } // linha infinita horizontal (y = de.y) ou vertical (x = de.x) passando por um ponto adquirido
export interface ResultadoOtrack { p: Pt; guias: Guia[] }

const MAX_ADQUIRIDOS = 5
const TIPOS_ADQUIRIVEIS = ['extremidade', 'centro', 'medio']

/** Pontos "adquiridos": o cursor passou perto (<= tol) de um ponto de snap (extremidade/centro/médio) — o chamador guarda a lista (máx. 5, os mais recentes). */
export function adquire(sk: SketchFeature, cursor: Pt, tol: number, atuais: { p: Pt; ref: string }[]): { p: Pt; ref: string }[] {
  const alvo = candidatosOsnap(sk, cursor, { tol, osnap: true, ortho: false, polar: false, grade: false, passoGrade: 1, polarGraus: 15 })
    .find(a => TIPOS_ADQUIRIVEIS.includes(a.tipo))
  if (!alvo) return atuais.slice()
  const ref = alvo.ref ?? alvo.tipo
  const ja = atuais.some(a => a.ref === ref && a.p.x === alvo.p.x && a.p.y === alvo.p.y)
  if (ja) return atuais.slice()
  return [...atuais, { p: { x: alvo.p.x, y: alvo.p.y }, ref }].slice(-MAX_ADQUIRIDOS)
}

/** Se o cursor está a <= tol de uma guia H/V de algum ponto adquirido, devolve o cursor ajustado a ela; se perto de DUAS guias (uma H e uma V) devolve a interseção. Sem guia: null. */
export function aplicaOtrack(cursor: Pt, adquiridos: { p: Pt; ref: string }[], tol: number): ResultadoOtrack | null {
  let h: Guia | null = null, v: Guia | null = null
  for (const a of adquiridos) {
    const dy = Math.abs(cursor.y - a.p.y), dx = Math.abs(cursor.x - a.p.x)
    if (dy <= tol && (!h || dy < Math.abs(cursor.y - h.de.y))) h = { de: a.p, dir: 'H', ref: a.ref }
    if (dx <= tol && (!v || dx < Math.abs(cursor.x - v.de.x))) v = { de: a.p, dir: 'V', ref: a.ref }
  }
  if (h && v) return { p: { x: v.de.x, y: h.de.y }, guias: [h, v] }
  if (h) return { p: { x: cursor.x, y: h.de.y }, guias: [h] }
  if (v) return { p: { x: v.de.x, y: cursor.y }, guias: [v] }
  return null
}
