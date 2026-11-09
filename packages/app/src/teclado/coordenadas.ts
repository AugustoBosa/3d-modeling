// Parser puro de entrada de coordenadas estilo AutoCAD (sem DOM).
// Formatos: "x,y" (abs), "@dx,dy" (rel), "@d<ang" (polar, graus), "d" (distancia direta).

export interface Pt { x: number; y: number }
export type Entrada =
  | { tipo: 'abs'; x: number; y: number }
  | { tipo: 'rel'; dx: number; dy: number }
  | { tipo: 'polar'; d: number; ang: number }
  | { tipo: 'dist'; d: number }

import { T } from '../textos.ts'
const ERRO_DIST = T.teclado.erroDistancia
const ORIGEM: Pt = { x: 0, y: 0 }

/** Divide `s` no separador `sep` apenas fora de parenteses (nivel 0). */
function dividirNivel0(s: string, sep: string): string[] {
  const partes: string[] = []
  let nivel = 0
  let atual = ''
  for (const c of s) {
    if (c === '(') nivel++
    else if (c === ')') nivel--
    if (c === sep && nivel === 0) {
      partes.push(atual)
      atual = ''
    } else {
      atual += c
    }
  }
  partes.push(atual)
  return partes
}

/** Avalia cada parte; devolve null se alguma estiver vazia ou invalida. */
function avaliaTodos(partes: string[], avalia: (s: string) => number | null): number[] | null {
  const valores: number[] = []
  for (const p of partes) {
    const t = p.trim()
    if (t === '') return null
    const v = avalia(t)
    if (v === null || !Number.isFinite(v)) return null
    valores.push(v)
  }
  return valores
}

/** Converte texto digitado em uma Entrada; null = nao e coordenada valida. */
export function parseCoord(texto: string, avalia: (s: string) => number | null): Entrada | null {
  const t = texto.trim()
  if (t === '') return null
  const rel = t.startsWith('@')
  const corpo = rel ? t.slice(1) : t

  const angulo = dividirNivel0(corpo, '<')
  if (angulo.length > 2) return null
  if (angulo.length === 2) {
    if (!rel) return null
    if (dividirNivel0(corpo, ',').length > 1) return null
    const v = avaliaTodos(angulo, avalia)
    return v === null ? null : { tipo: 'polar', d: v[0], ang: v[1] }
  }

  const comps = dividirNivel0(corpo, ',')
  if (comps.length > 2) return null
  if (rel) {
    if (comps.length !== 2) return null
    const v = avaliaTodos(comps, avalia)
    return v === null ? null : { tipo: 'rel', dx: v[0], dy: v[1] }
  }
  if (comps.length === 2) {
    const v = avaliaTodos(comps, avalia)
    return v === null ? null : { tipo: 'abs', x: v[0], y: v[1] }
  }
  const v = avaliaTodos(comps, avalia)
  return v === null ? null : { tipo: 'dist', d: v[0] }
}

/** Arredonda a 1e-9 e normaliza -0 para 0. */
function arred(v: number): number {
  return Math.round(v * 1e9) / 1e9 + 0
}

/** Converte a entrada em ponto absoluto. `ultimo` e a base; `cursor` define a direcao da distancia. */
export function resolveCoord(e: Entrada, ultimo: Pt | null, cursor: Pt | null): Pt | { erro: string } {
  switch (e.tipo) {
    case 'abs':
      return { x: arred(e.x), y: arred(e.y) }
    case 'rel': {
      const b = ultimo ?? ORIGEM
      return { x: arred(b.x + e.dx), y: arred(b.y + e.dy) }
    }
    case 'polar': {
      const b = ultimo ?? ORIGEM
      const r = (e.ang * Math.PI) / 180
      return { x: arred(b.x + e.d * Math.cos(r)), y: arred(b.y + e.d * Math.sin(r)) }
    }
    case 'dist': {
      if (ultimo === null || cursor === null) return { erro: ERRO_DIST }
      const dx = cursor.x - ultimo.x
      const dy = cursor.y - ultimo.y
      const len = Math.hypot(dx, dy)
      if (len === 0) return { erro: ERRO_DIST }
      return { x: arred(ultimo.x + (e.d * dx) / len), y: arred(ultimo.y + (e.d * dy) / len) }
    }
  }
}
