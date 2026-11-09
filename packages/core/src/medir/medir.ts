// Matemática de medição em mm: distância, ângulo, raio de círculo e área de face plana.
import { normaliza, volume } from '../malha/index.ts'
import type { EntradaMalha } from '../malha/index.ts'

export type V3 = [number, number, number]

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const comp = (a: V3): number => Math.hypot(a[0], a[1], a[2])

export function distancia(a: V3, b: V3): number {
  return comp(sub(a, b))
}

/** Ângulo em graus no vértice, entre vertice→a e vertice→b, em [0, 180]. */
export function angulo(a: V3, vertice: V3, b: V3): number {
  const u = sub(a, vertice), v = sub(b, vertice)
  if (comp(u) === 0 || comp(v) === 0) throw new Error('angulo: vetor de comprimento zero')
  return Math.atan2(comp(cross(u, v)), dot(u, v)) * 180 / Math.PI
}

function det3(m: number[][]): number {
  return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
    - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
    + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
}

/** Círculo ajustado (Kåsa) a pontos coplanares. Plano por PCA: a normal é a maior coluna de adj(covariância). */
export function raioCirculo(pontos: V3[]): { raio: number; centro: V3 } {
  if (pontos.length < 3) throw new Error('raioCirculo: precisa de pelo menos 3 pontos')
  const n = pontos.length
  const c: V3 = [0, 0, 0]
  for (const p of pontos) for (let k = 0; k < 3; k++) c[k] += p[k] / n
  const d = pontos.map((p) => sub(p, c))
  const cov = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
  for (const v of d) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cov[i][j] += v[i] * v[j]
  const col = (j: number): V3 => [cov[0][j], cov[1][j], cov[2][j]]
  const cands = [cross(col(1), col(2)), cross(col(2), col(0)), cross(col(0), col(1))]
  const escala = cov[0][0] + cov[1][1] + cov[2][2]
  const melhor = cands.reduce((m, v) => (comp(v) > comp(m) ? v : m))
  if (comp(melhor) <= 1e-12 * escala * escala) throw new Error('raioCirculo: pontos colineares')
  const nn: V3 = [melhor[0] / comp(melhor), melhor[1] / comp(melhor), melhor[2] / comp(melhor)]
  const eixo = [0, 0, 0]
  eixo[Math.abs(nn[0]) <= Math.abs(nn[1]) && Math.abs(nn[0]) <= Math.abs(nn[2]) ? 0 : Math.abs(nn[1]) <= Math.abs(nn[2]) ? 1 : 2] = 1
  const e1 = cross(nn, eixo as V3)
  const l1 = comp(e1)
  const u1: V3 = [e1[0] / l1, e1[1] / l1, e1[2] / l1]
  const u2 = cross(nn, u1)
  // Kåsa: x²+y² = a·x + b·y + c, mínimos quadrados -> sistema normal 3x3.
  let Sx = 0, Sy = 0, Sxx = 0, Syy = 0, Sxy = 0, Sz = 0, Sxz = 0, Syz = 0
  for (const v of d) {
    const x = dot(v, u1), y = dot(v, u2), z = x * x + y * y
    Sx += x; Sy += y; Sxx += x * x; Syy += y * y; Sxy += x * y
    Sz += z; Sxz += x * z; Syz += y * z
  }
  const M = [[Sxx, Sxy, Sx], [Sxy, Syy, Sy], [Sx, Sy, n]]
  const r = [Sxz, Syz, Sz]
  const det = det3(M)
  if (Math.abs(det) <= 1e-12 * Math.abs(Sxx * Syy * n)) throw new Error('raioCirculo: pontos colineares')
  const resolve = (j: number): number => {
    const Mj = M.map((linha, i) => linha.map((x, k) => (k === j ? r[i] : x)))
    return det3(Mj) / det
  }
  const a = resolve(0), b = resolve(1), cc = resolve(2)
  const cx = a / 2, cy = b / 2
  const raio = Math.sqrt(cc + cx * cx + cy * cy)
  const centro: V3 = [
    c[0] + cx * u1[0] + cy * u2[0],
    c[1] + cx * u1[1] + cy * u2[1],
    c[2] + cx * u1[2] + cy * u2[2],
  ]
  return { raio, centro }
}

function normalTri(pos: Float32Array, idx: Uint32Array, t: number): V3 {
  const a = idx[3 * t] * 3, b = idx[3 * t + 1] * 3, c = idx[3 * t + 2] * 3
  const u: V3 = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]]
  const w: V3 = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]]
  return cross(u, w)
}

/** Triângulos da mesma face plana de `tri` (região conexa por aresta com normal a até anguloMaxGraus do de `tri`). */
export function faceDoTriangulo(malha: EntradaMalha, tri: number, anguloMaxGraus = 1): number[] {
  const { pos, idx } = normaliza(malha)
  const nt = idx.length / 3
  const chave = (a: number, b: number): string => (a < b ? `${a},${b}` : `${b},${a}`)
  const arestas = new Map<string, number[]>()
  for (let t = 0; t < nt; t++) {
    for (let e = 0; e < 3; e++) {
      const k = chave(idx[3 * t + e], idx[3 * t + ((e + 1) % 3)])
      const lista = arestas.get(k)
      if (lista) lista.push(t)
      else arestas.set(k, [t])
    }
  }
  const n0 = normalTri(pos, idx, tri)
  const limite = anguloMaxGraus * Math.PI / 180
  const visto = new Uint8Array(nt)
  visto[tri] = 1
  const fila = [tri]
  for (let i = 0; i < fila.length; i++) {
    const t = fila[i]
    for (let e = 0; e < 3; e++) {
      const k = chave(idx[3 * t + e], idx[3 * t + ((e + 1) % 3)])
      for (const s of arestas.get(k) ?? []) {
        if (visto[s]) continue
        visto[s] = 1
        const ns = normalTri(pos, idx, s)
        if (Math.atan2(comp(cross(n0, ns)), dot(n0, ns)) <= limite) fila.push(s)
      }
    }
  }
  return fila
}

/** Área (mm²) da face plana que contém o triângulo `tri`. */
export function areaFace(malha: EntradaMalha, tri: number, anguloMaxGraus = 1): number {
  const { pos, idx } = normaliza(malha)
  let total = 0
  for (const t of faceDoTriangulo(malha, tri, anguloMaxGraus)) total += comp(normalTri(pos, idx, t)) / 2
  return total
}

/** Volume com sinal (mm³), positivo para malha fechada com faces para fora. */
export function volumeMalha(m: EntradaMalha): number {
  return volume(m)
}

export function arredonda(x: number, casas = 2): number {
  const f = 10 ** casas
  return Math.round(x * f) / f
}
