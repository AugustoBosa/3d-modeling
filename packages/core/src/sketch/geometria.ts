// Geometria 2D pura do sketch (mm). Sem DOM, sem dependência. Ângulos em radianos.
import type { Pt } from './tipos.ts'

export const EPS = 1e-9
const TAU = 2 * Math.PI

export const dist = (p: Pt, q: Pt): number => Math.hypot(q.x - p.x, q.y - p.y)

/** Projeção ortogonal de p na reta a→b. t = 0 em a, 1 em b (fora de [0,1] = fora do segmento). */
export function projetaNaLinha(p: Pt, a: Pt, b: Pt): { pt: Pt; t: number } {
  const dx = b.x - a.x, dy = b.y - a.y
  const l2 = dx * dx + dy * dy
  const t = l2 < EPS * EPS ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2
  return { pt: { x: a.x + t * dx, y: a.y + t * dy }, t }
}

/** Interseção de a1→b1 com a2→b2. Paralelas (ou degeneradas) -> null. */
export function interSegmentos(a1: Pt, b1: Pt, a2: Pt, b2: Pt, so_segmentos = true): Pt | null {
  const d1x = b1.x - a1.x, d1y = b1.y - a1.y, d2x = b2.x - a2.x, d2y = b2.y - a2.y
  const den = d1x * d2y - d1y * d2x
  if (Math.abs(den) <= EPS * Math.hypot(d1x, d1y) * Math.hypot(d2x, d2y)) return null
  const ex = a2.x - a1.x, ey = a2.y - a1.y
  const t = (ex * d2y - ey * d2x) / den
  const u = (ex * d1y - ey * d1x) / den
  if (so_segmentos && (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS)) return null
  return { x: a1.x + t * d1x, y: a1.y + t * d1y }
}

/** Interseção de a→b (reta, ou segmento se so_segmento) com o círculo c,r. 0, 1 (tangente) ou 2 pontos. */
export function interLinhaCirculo(a: Pt, b: Pt, c: Pt, r: number, so_segmento = false): Pt[] {
  const dx = b.x - a.x, dy = b.y - a.y
  const fx = a.x - c.x, fy = a.y - c.y
  const A = dx * dx + dy * dy
  if (A < EPS * EPS) return []
  const B = 2 * (fx * dx + fy * dy)
  const C = fx * fx + fy * fy - r * r
  const disc = B * B - 4 * A * C
  const tolD = 1e-12 * (B * B + 4 * A * Math.abs(C))
  if (disc < -tolD) return []
  const ts = Math.abs(disc) <= tolD
    ? [-B / (2 * A)]
    : [(-B - Math.sqrt(disc)) / (2 * A), (-B + Math.sqrt(disc)) / (2 * A)]
  return ts
    .filter(t => !so_segmento || (t >= -EPS && t <= 1 + EPS))
    .map(t => ({ x: a.x + t * dx, y: a.y + t * dy }))
}

/** Interseção de dois círculos: 0, 1 (tangente) ou 2 pontos. Concêntricos -> []. */
export function interCirculoCirculo(c1: Pt, r1: number, c2: Pt, r2: number): Pt[] {
  const d = dist(c1, c2)
  const tol = 1e-9 * (r1 + r2 + d)
  if (d < EPS || d > r1 + r2 + tol || d < Math.abs(r1 - r2) - tol) return []
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d)
  const h2 = r1 * r1 - a * a
  const ux = (c2.x - c1.x) / d, uy = (c2.y - c1.y) / d
  const px = c1.x + a * ux, py = c1.y + a * uy
  if (h2 <= 1e-12 * r1 * r1) return [{ x: px, y: py }]
  const h = Math.sqrt(h2)
  return [{ x: px - h * uy, y: py + h * ux }, { x: px + h * uy, y: py - h * ux }]
}

/** Ângulo de c até p, em radianos no intervalo [0, 2pi). */
export function anguloDe(c: Pt, p: Pt): number {
  const a = Math.atan2(p.y - c.y, p.x - c.x)
  return a < 0 ? (a + TAU) % TAU : a
}

/** Varredura anti-horária de a até b, em (0, 2pi]. a == b = círculo inteiro. */
export function varreduraArco(c: Pt, a: Pt, b: Pt): number {
  const d = (anguloDe(c, b) - anguloDe(c, a) + TAU) % TAU
  return d < EPS ? TAU : d
}

/** p está angularmente no arco anti-horário de a até b (tol em rad, inclusive nos extremos). */
export function noArco(p: Pt, c: Pt, a: Pt, b: Pt, tol = EPS): boolean {
  const dp = (anguloDe(c, p) - anguloDe(c, a) + TAU) % TAU
  return dp <= varreduraArco(c, a, b) + tol || dp >= TAU - tol
}

/** Amostra o arco anti-horário de a até b; inclui a e b. Flecha de cada corda <= tolCorda. */
export function discretizaArco(c: Pt, a: Pt, b: Pt, tolCorda = 0.05): Pt[] {
  const r = dist(c, a)
  const V = varreduraArco(c, a, b)
  const passo = 2 * Math.acos(Math.max(-1, 1 - tolCorda / r))
  const n = Math.max(1, Math.ceil(V / passo))
  const t0 = anguloDe(c, a)
  const pts: Pt[] = [a]
  for (let i = 1; i < n; i++) {
    const t = t0 + (V * i) / n
    pts.push({ x: c.x + r * Math.cos(t), y: c.y + r * Math.sin(t) })
  }
  pts.push(b)
  return pts
}

/** Amostra o círculo inteiro sem repetir o primeiro ponto no fim. Mínimo 12 pontos. */
export function discretizaCirculo(c: Pt, r: number, tolCorda = 0.05): Pt[] {
  const passo = 2 * Math.acos(Math.max(-1, 1 - tolCorda / r))
  const n = Math.max(12, Math.ceil(TAU / passo))
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) {
    const t = (TAU * i) / n
    pts.push({ x: c.x + r * Math.cos(t), y: c.y + r * Math.sin(t) })
  }
  return pts
}

/** Área com sinal (shoelace). > 0 = anti-horário. */
export function areaAssinada(poly: Pt[]): number {
  let s = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length]
    s += p.x * q.y - q.x * p.y
  }
  return s / 2
}

/** Ray casting (even-odd). Ponto sobre a borda: resultado indefinido. */
export function pontoNoPoligono(p: Pt, poly: Pt[]): boolean {
  let dentro = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j]
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) dentro = !dentro
  }
  return dentro
}
