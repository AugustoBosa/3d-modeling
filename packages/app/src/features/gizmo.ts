// Gizmo de manipulação (W): matemática pura do acerto e do arraste (sem three, sem DOM).
// Vetores são V3 [x,y,z] em mm, Z para cima. Raio: origem + direção (normalizada aqui).
import type { V3 } from './contrato.ts'

export interface Raio { origem: V3; dir: V3 }
export type Alca = { tipo: 'seta' | 'anel'; eixo: 'X' | 'Y' | 'Z' }
type Eixo = 'X' | 'Y' | 'Z'

const EIXO: Record<Eixo, V3> = { X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1] }
const EIXOS: Eixo[] = ['X', 'Y', 'Z']
const PONTOS_ANEL = 64
const FATOR_ANEL = 0.7

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norma = (a: V3): number => Math.hypot(a[0], a[1], a[2])
const unit = (a: V3): V3 => mul(a, 1 / norma(a))

/** Distância do raio (meia-reta a partir de o) até o ponto p. */
function distRaioPonto(o: V3, d: V3, p: V3): number {
  const t = Math.max(0, dot(sub(p, o), d))
  return norma(sub(add(o, mul(d, t)), p))
}

/** Distância entre a meia-reta do raio e o segmento a-b: testa as bordas e o ponto interior do par (t, s). */
function distRaioSegmento(r: Raio, a: V3, b: V3): number {
  const o = r.origem, d = unit(r.dir), e = sub(b, a), w = sub(o, a)
  const B = dot(d, e), C = dot(e, e), D = dot(d, w), E = dot(e, w)
  const cand = [distRaioPonto(o, d, a), distRaioPonto(o, d, b)]
  const s0 = C > 0 ? Math.min(1, Math.max(0, E / C)) : 0 // origem do raio contra o segmento
  cand.push(norma(sub(o, add(a, mul(e, s0)))))
  const det = C - B * B // A = 1 (d unitário)
  if (Math.abs(det) > 1e-12) {
    const t = (-D * C + B * E) / det, s = (E - B * D) / det
    if (t >= 0 && s >= 0 && s <= 1) cand.push(norma(sub(add(o, mul(d, t)), add(a, mul(e, s)))))
  }
  return Math.min(...cand)
}

/** Distância do raio ao círculo (plano perpendicular ao eixo, centro c), amostrado em 64 pontos. */
function distRaioAnel(r: Raio, c: V3, eixo: Eixo, rad: number): number {
  const d = unit(r.dir)
  // u × v = eixo: o ângulo cresce pela regra da mão direita
  const [u, v]: [V3, V3] = eixo === 'X' ? [[0, 1, 0], [0, 0, 1]] : eixo === 'Y' ? [[0, 0, 1], [1, 0, 0]] : [[1, 0, 0], [0, 1, 0]]
  let menor = Infinity
  for (let k = 0; k < PONTOS_ANEL; k++) {
    const th = (2 * Math.PI * k) / PONTOS_ANEL
    const p = add(c, add(mul(u, rad * Math.cos(th)), mul(v, rad * Math.sin(th))))
    menor = Math.min(menor, distRaioPonto(r.origem, d, p))
  }
  return menor
}

/** Alça sob o raio (setas: segmentos centro→ponta; anéis: círculos de raio tamanho*0.7). Vence a de menor distância <= tolMm; empate: seta antes do anel. */
export function pegaAlca(raio: Raio, centro: V3, tamanho: number, tolMm: number): Alca | null {
  const cand: { alca: Alca; dist: number }[] = []
  for (const eixo of EIXOS) cand.push({ alca: { tipo: 'seta', eixo }, dist: distRaioSegmento(raio, centro, add(centro, mul(EIXO[eixo], tamanho))) })
  for (const eixo of EIXOS) cand.push({ alca: { tipo: 'anel', eixo }, dist: distRaioAnel(raio, centro, eixo, tamanho * FATOR_ANEL) })
  let melhor: { alca: Alca; dist: number } | null = null
  for (const c of cand) if (c.dist <= tolMm && (!melhor || c.dist < melhor.dist)) melhor = c
  return melhor ? melhor.alca : null
}

/** Parâmetro, sobre o eixo (centro + s*eixo), do ponto mais próximo do raio (retas). null se paralelo. */
function parametroNoEixo(e: V3, c: V3, r: Raio): number | null {
  const d = unit(r.dir), w = sub(c, r.origem), b = dot(e, d)
  const den = 1 - b * b
  if (den < 1e-12) return null
  return (dot(d, w) * b - dot(e, w)) / den
}

/** Delta mundial ao longo do eixo (só a componente do eixo) entre os dois raios. Paralelo ao eixo: zero. */
export function arrastaSeta(eixo: Eixo, centro: V3, raioIni: Raio, raioAtual: Raio): V3 {
  const e = EIXO[eixo]
  const s0 = parametroNoEixo(e, centro, raioIni), s1 = parametroNoEixo(e, centro, raioAtual)
  if (s0 === null || s1 === null) return [0, 0, 0]
  return mul(e, s1 - s0)
}

/** Ponto em que o raio cruza o plano de normal n que passa por c; null se paralelo. */
function pontoNoPlano(n: V3, c: V3, r: Raio): V3 | null {
  const d = unit(r.dir), den = dot(d, n)
  if (Math.abs(den) < 1e-12) return null
  return add(r.origem, mul(d, dot(sub(c, r.origem), n) / den))
}

/** Ângulo (graus, anti-horário olhando contra o eixo, intervalo (-180,180]) do arraste sobre o anel. Raio paralelo ao plano: zero. */
export function arrastaAnel(eixo: Eixo, centro: V3, raioIni: Raio, raioAtual: Raio): number {
  const n = EIXO[eixo]
  const a = pontoNoPlano(n, centro, raioIni), b = pontoNoPlano(n, centro, raioAtual)
  if (!a || !b) return 0
  const u = sub(a, centro), v = sub(b, centro)
  return (Math.atan2(dot(cross(u, v), n), dot(u, v)) * 180) / Math.PI
}

/** Tamanho do gizmo: 0.6 da maior dimensão da bbox, mínimo 10 mm. */
export function tamanhoGizmo(bbox: { min: V3; max: V3 }): number {
  const maior = Math.max(bbox.max[0] - bbox.min[0], bbox.max[1] - bbox.min[1], bbox.max[2] - bbox.min[2])
  return Math.max(10, 0.6 * maior)
}
