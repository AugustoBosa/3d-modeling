// Medição 3D em mm: snap (vértice, aresta viva, centro de face) e acumulação de pontos por modo.
// Só lógica pura: sem DOM, sem three. Textos vêm de medir-textos.ts.
import { angulo, areaFace, distancia, faceDoTriangulo, raioCirculo } from '@3dm/core/medir'
import type { CorpoInfo, V3 } from './contrato.ts'
import { T } from '../textos.ts'
import { textoAngulo, textoArea, textoDistancia, textoRaio, textoVolume } from './medir-formato.ts'

export type Snap = { tipo: 'vertice' | 'aresta' | 'centro'; p: V3 }
export type ModoMedir = 'distancia' | 'angulo' | 'raio' | 'area' | 'volume'
export interface ResultadoMedida {
  modo: ModoMedir
  valor: number
  unidade: 'mm' | '°' | 'mm²' | 'mm³'
  pontos: V3[]
  extra?: { dx?: number; dy?: number; dz?: number; centro?: V3; corpoId?: string; tri?: number }
  texto: string
}
export interface Medicao {
  inicia(modo: ModoMedir): void
  ponto(p: V3): ResultadoMedida | null
  face(corpo: CorpoInfo, tri: number): ResultadoMedida | null
  corpo(c: CorpoInfo): ResultadoMedida | null
  /** Encerra o raio em curso e guarda o último ajuste. */
  encerra(): void
  /** Esc: zera resultados, pontos pendentes e modo. */
  limpa(): void
  readonly resultados: readonly ResultadoMedida[]
  readonly modo: ModoMedir | null
  readonly pendentes: V3[]
  readonly prompt: string
}

const ANGULO_ARESTA = 20 // graus: arestas com normais mais abertas que isso são "vivas"

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const comp = (a: V3): number => Math.hypot(a[0], a[1], a[2])

const vertice = (pos: Float32Array, i: number): V3 => [pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]]

/** Ponto mais próximo de p no segmento ab. */
function noSegmento(p: V3, a: V3, b: V3): V3 {
  const ab = sub(b, a)
  const l2 = dot(ab, ab)
  const t = l2 === 0 ? 0 : Math.min(1, Math.max(0, dot(sub(p, a), ab) / l2))
  return [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t]
}

/** Distância de p ao triângulo abc (com o interior): plano se a projeção cai dentro, senão a menor distância às arestas. */
function distTri(p: V3, a: V3, b: V3, c: V3): number {
  const n = cross(sub(b, a), sub(c, a))
  const nn = dot(n, n)
  if (nn > 0) {
    const h = dot(sub(p, a), n) / nn
    const q: V3 = [p[0] - h * n[0], p[1] - h * n[1], p[2] - h * n[2]]
    const dentro = dot(cross(sub(b, a), sub(q, a)), n) >= 0
      && dot(cross(sub(c, b), sub(q, b)), n) >= 0
      && dot(cross(sub(a, c), sub(q, c)), n) >= 0
    if (dentro) return distancia(p, q)
  }
  return Math.min(distancia(p, noSegmento(p, a, b)), distancia(p, noSegmento(p, b, c)), distancia(p, noSegmento(p, c, a)))
}

/** Centroide (ponderado por área) da face plana que contém o triângulo `tri`. */
function centroDaRegiao(corpo: CorpoInfo, tri: number): V3 {
  const { pos, idx } = corpo
  const tres = (t: number): V3[] => [0, 1, 2].map((e) => vertice(pos, idx[3 * t + e]))
  let sx = 0, sy = 0, sz = 0, w = 0
  for (const t of faceDoTriangulo({ posicoes: pos, indices: idx }, tri, 1)) {
    const [a, b, c] = tres(t)
    const area = comp(cross(sub(b, a), sub(c, a))) / 2
    sx += area * (a[0] + b[0] + c[0]) / 3
    sy += area * (a[1] + b[1] + c[1]) / 3
    sz += area * (a[2] + b[2] + c[2]) / 3
    w += area
  }
  if (w === 0) {
    const [a, b, c] = tres(tri)
    return [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3]
  }
  return [sx / w, sy / w, sz / w]
}

/** Snap de p: vértice, depois aresta viva, depois centro da face mais próxima; dentro de tolMm. */
// ponytail: O(n) por chamada (varre triângulos e arestas); índice espacial se a malha ficar grande.
export function snapar(corpo: CorpoInfo, p: V3, tolMm: number): Snap | null {
  const { pos, idx } = corpo
  const nt = idx.length / 3

  let vp: V3 = p
  let dv = Infinity
  for (const i of idx) {
    const q = vertice(pos, i)
    const d = distancia(p, q)
    if (d < dv) { dv = d; vp = q }
  }

  const arestas = new Map<string, { i: number; j: number; tris: number[] }>()
  for (let t = 0; t < nt; t++) {
    for (let e = 0; e < 3; e++) {
      const i = idx[3 * t + e], j = idx[3 * t + ((e + 1) % 3)]
      const k = i < j ? `${i},${j}` : `${j},${i}`
      const ent = arestas.get(k)
      if (ent) ent.tris.push(t)
      else arestas.set(k, { i, j, tris: [t] })
    }
  }
  const normal = (t: number): V3 => {
    const a = vertice(pos, idx[3 * t]), b = vertice(pos, idx[3 * t + 1]), c = vertice(pos, idx[3 * t + 2])
    return cross(sub(b, a), sub(c, a))
  }
  const cosLimite = Math.cos(ANGULO_ARESTA * Math.PI / 180)
  let ea: V3 = p
  let de = Infinity
  for (const { i, j, tris } of arestas.values()) {
    let viva = true // borda ou não-variedade: sempre viva
    if (tris.length === 2) {
      const n1 = normal(tris[0]), n2 = normal(tris[1])
      viva = dot(n1, n2) < cosLimite * comp(n1) * comp(n2)
    }
    if (!viva) continue
    const q = noSegmento(p, vertice(pos, i), vertice(pos, j))
    const d = distancia(p, q)
    if (d < de) { de = d; ea = q }
  }

  let tBest = -1
  let dt = Infinity
  for (let t = 0; t < nt; t++) {
    const d = distTri(p, vertice(pos, idx[3 * t]), vertice(pos, idx[3 * t + 1]), vertice(pos, idx[3 * t + 2]))
    if (d < dt) { dt = d; tBest = t }
  }

  if (dv <= tolMm) return { tipo: 'vertice', p: vp }
  if (de <= tolMm) return { tipo: 'aresta', p: ea }
  if (tBest >= 0 && dt <= tolMm) return { tipo: 'centro', p: centroDaRegiao(corpo, tBest) }
  return null
}

function medDistancia(a: V3, b: V3): ResultadoMedida {
  const valor = distancia(a, b)
  const dx = Math.abs(b[0] - a[0]), dy = Math.abs(b[1] - a[1]), dz = Math.abs(b[2] - a[2])
  return { modo: 'distancia', valor, unidade: 'mm', pontos: [a, b], extra: { dx, dy, dz }, texto: textoDistancia(valor, dx, dy, dz) }
}

function promptDe(modo: ModoMedir | null, n: number): string {
  switch (modo) {
    case 'distancia': return n === 0 ? T.medir.prompt.primeiro : T.medir.prompt.segundo
    case 'angulo': return n === 0 ? T.medir.prompt.pontoA : n === 1 ? T.medir.prompt.vertice : T.medir.prompt.pontoB
    case 'raio': return n < 3 ? T.medir.prompt.tresPontos : T.medir.prompt.maisPontos
    case 'area': return T.medir.prompt.face
    case 'volume': return T.medir.prompt.corpo
    default: return ''
  }
}

export function criaMedicao(): Medicao {
  let modo: ModoMedir | null = null
  let pts: V3[] = []
  let ajuste: ResultadoMedida | null = null
  const resultados: ResultadoMedida[] = []

  const guarda = (r: ResultadoMedida): ResultadoMedida => { resultados.push(r); return r }
  const fechaRaio = (): void => {
    if (ajuste) resultados.push(ajuste)
    ajuste = null
    pts = []
  }

  return {
    inicia(m: ModoMedir): void {
      fechaRaio()
      modo = m
    },
    ponto(p: V3): ResultadoMedida | null {
      if (modo !== 'distancia' && modo !== 'angulo' && modo !== 'raio') return null
      const ult = pts[pts.length - 1]
      if (ult && distancia(ult, p) === 0) return null // clique repetido no mesmo ponto: ignora
      pts.push([p[0], p[1], p[2]])
      if (modo === 'distancia' && pts.length === 2) {
        const [a, b] = pts
        pts = []
        return guarda(medDistancia(a, b))
      }
      if (modo === 'angulo' && pts.length === 3) {
        const [a, v, b] = pts
        pts = []
        const valor = angulo(a, v, b)
        return guarda({ modo: 'angulo', valor, unidade: '°', pontos: [a, v, b], texto: textoAngulo(valor) })
      }
      if (modo === 'raio' && pts.length >= 3) {
        try {
          const { raio, centro } = raioCirculo(pts)
          const r: ResultadoMedida = { modo: 'raio', valor: raio, unidade: 'mm', pontos: pts.slice(), extra: { centro }, texto: textoRaio(raio) }
          ajuste = r
          return r
        } catch {
          pts.pop() // pontos colineares: descarta o último clique
          return null
        }
      }
      return null
    },
    face(corpo: CorpoInfo, tri: number): ResultadoMedida | null {
      if (modo !== 'area') return null
      const valor = areaFace({ posicoes: corpo.pos, indices: corpo.idx }, tri, 1)
      return guarda({ modo: 'area', valor, unidade: 'mm²', pontos: [], extra: { corpoId: corpo.id, tri }, texto: textoArea(valor) })
    },
    corpo(c: CorpoInfo): ResultadoMedida | null {
      if (modo !== 'volume') return null
      return guarda({ modo: 'volume', valor: c.volume, unidade: 'mm³', pontos: [], extra: { corpoId: c.id }, texto: textoVolume(c.volume) })
    },
    encerra(): void {
      fechaRaio()
    },
    limpa(): void {
      resultados.length = 0
      pts = []
      ajuste = null
      modo = null
    },
    get resultados() { return resultados },
    get modo() { return modo },
    get pendentes() { return pts.slice() },
    get prompt() { return promptDe(modo, pts.length) },
  }
}
