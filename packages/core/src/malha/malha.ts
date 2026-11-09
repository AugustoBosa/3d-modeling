// Funções puras sobre malhas triangulares (fechada, stl, bbox, volume, área).
import { normaliza } from './tipos.ts'
import type { EntradaMalha } from './tipos.ts'

/** Malha fechada: cada aresta orientada aparece uma vez e a inversa também; nenhum triângulo degenerado. */
export function fechada(m: EntradaMalha): boolean {
  const { pos, idx } = normaliza(m)
  if (idx.length === 0) return false
  const nv = pos.length / 3, arestas = new Set<number>()
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3
    const u0 = pos[b] - pos[a], u1 = pos[b + 1] - pos[a + 1], u2 = pos[b + 2] - pos[a + 2]
    const w0 = pos[c] - pos[a], w1 = pos[c + 1] - pos[a + 1], w2 = pos[c + 2] - pos[a + 2]
    const area = Math.hypot(u1 * w2 - u2 * w1, u2 * w0 - u0 * w2, u0 * w1 - u1 * w0) / 2
    const d2 = (p: number, q: number) => (pos[p] - pos[q]) ** 2 + (pos[p + 1] - pos[q + 1]) ** 2 + (pos[p + 2] - pos[q + 2]) ** 2
    const lado2 = Math.max(d2(a, b), d2(b, c), d2(c, a))
    if (area < 1e-6 && area < 1e-3 * lado2) return false
    for (let e = 0; e < 3; e++) {
      const k = idx[t + e] * nv + idx[t + (e + 1) % 3]
      if (arestas.has(k)) return false
      arestas.add(k)
    }
  }
  for (const k of arestas) if (!arestas.has((k % nv) * nv + Math.floor(k / nv))) return false
  return true
}

/** STL binário: cabeçalho de 80 bytes zerados, uint32 com nº de triângulos, 50 bytes por triângulo. */
export function stl(m: EntradaMalha): Uint8Array {
  const { pos, idx } = normaliza(m)
  const nt = idx.length / 3
  const buf = new ArrayBuffer(84 + 50 * nt)
  const dv = new DataView(buf)
  dv.setUint32(80, nt, true)
  let off = 84
  for (let t = 0; t < idx.length; t += 3) {
    const vs = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3]
    const [a, b, c] = vs
    const u0 = pos[b] - pos[a], u1 = pos[b + 1] - pos[a + 1], u2 = pos[b + 2] - pos[a + 2]
    const w0 = pos[c] - pos[a], w1 = pos[c + 1] - pos[a + 1], w2 = pos[c + 2] - pos[a + 2]
    const n = [u1 * w2 - u2 * w1, u2 * w0 - u0 * w2, u0 * w1 - u1 * w0]
    const len = Math.hypot(n[0], n[1], n[2])
    const s = len > 0 ? 1 / len : 0
    for (let k = 0; k < 3; k++) dv.setFloat32(off + 4 * k, n[k] * s, true)
    for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) dv.setFloat32(off + 12 + 12 * i + 4 * k, pos[vs[i] + k], true)
    off += 50 // 2 bytes de atributo ficam zerados (buffer já é zerado)
  }
  return new Uint8Array(buf)
}

/** Caixa envolvente dos vértices usados pelos triângulos. Malha vazia: zeros. */
export function bbox(m: EntradaMalha): { min: [number, number, number]; max: [number, number, number] } {
  const { pos, idx } = normaliza(m)
  if (idx.length === 0) return { min: [0, 0, 0], max: [0, 0, 0] }
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (const v of idx) {
    for (let k = 0; k < 3; k++) {
      const x = pos[v * 3 + k]
      if (x < min[k]) min[k] = x
      if (x > max[k]) max[k] = x
    }
  }
  return { min, max }
}

/** Volume com sinal (teorema da divergência). Positivo = faces para fora. */
export function volume(m: EntradaMalha): number {
  const { pos, idx } = normaliza(m)
  let v = 0
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3
    const cx = pos[b + 1] * pos[c + 2] - pos[b + 2] * pos[c + 1]
    const cy = pos[b + 2] * pos[c] - pos[b] * pos[c + 2]
    const cz = pos[b] * pos[c + 1] - pos[b + 1] * pos[c]
    v += pos[a] * cx + pos[a + 1] * cy + pos[a + 2] * cz
  }
  return v / 6
}

/** Soma das áreas dos triângulos. */
export function area(m: EntradaMalha): number {
  const { pos, idx } = normaliza(m)
  let total = 0
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3
    const u0 = pos[b] - pos[a], u1 = pos[b + 1] - pos[a + 1], u2 = pos[b + 2] - pos[a + 2]
    const w0 = pos[c] - pos[a], w1 = pos[c + 1] - pos[a + 1], w2 = pos[c + 2] - pos[a + 2]
    total += Math.hypot(u1 * w2 - u2 * w1, u2 * w0 - u0 * w2, u0 * w1 - u1 * w0) / 2
  }
  return total
}
