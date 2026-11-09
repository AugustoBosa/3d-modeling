// Orientação para impressão: funções puras que devolvem os campos de uma feature de transformação
// (gira em torno de `pivo` e depois move). Giro igual ao do kernel: manifold `rotate` aplica Rz·Ry·Rx.
import { bbox, normaliza } from '../malha/index.ts'
import type { EntradaMalha } from '../malha/index.ts'
import type { FTransformacao } from '../features/tipos.ts'
import type { Vec3 } from '../kernel/tipos.ts'

type Caixa = { min: Vec3; max: Vec3 }
type Mat = number[] // 3x3 por linha: índice r*3+c

const RAD = Math.PI / 180
const DEG = 180 / Math.PI

const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

function mul(a: Mat, b: Mat): Mat {
  const o: Mat = new Array(9).fill(0)
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) for (let k = 0; k < 3; k++) o[r * 3 + c] += a[r * 3 + k] * b[k * 3 + c]
  return o
}

/** Matriz de giro para graus em X, Y, Z (nessa ordem). */
function matRot([gx, gy, gz]: Vec3): Mat {
  const [ax, ay, az] = [gx, gy, gz].map((g) => g * RAD)
  const rx: Mat = [1, 0, 0, 0, Math.cos(ax), -Math.sin(ax), 0, Math.sin(ax), Math.cos(ax)]
  const ry: Mat = [Math.cos(ay), 0, Math.sin(ay), 0, 1, 0, -Math.sin(ay), 0, Math.cos(ay)]
  const rz: Mat = [Math.cos(az), -Math.sin(az), 0, Math.sin(az), Math.cos(az), 0, 0, 0, 1]
  return mul(rz, mul(ry, rx))
}

/** Ângulos (X, Y, Z) em graus de uma matriz Rz·Ry·Rx. */
function eulerDe(R: Mat): Vec3 {
  const b = Math.asin(Math.max(-1, Math.min(1, -R[6])))
  let a: number, c: number
  if (Math.abs(Math.cos(b)) > 1e-9) {
    a = Math.atan2(R[7], R[8])
    c = Math.atan2(R[3], R[0])
  } else {
    // trava de cardan: com a = 0, R = Rz·Ry
    a = 0
    c = Math.atan2(-R[1], R[4])
  }
  return [a * DEG, b * DEG, c * DEG]
}

/** Normal unitária do triângulo `tri` (anti-horário visto de fora). */
function normalDe(m: EntradaMalha, tri: number): Vec3 {
  const { pos, idx } = normaliza(m)
  const [a, b, c] = [0, 1, 2].map((k) => idx[3 * tri + k] * 3)
  const n = cross([pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]], [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]])
  const len = Math.hypot(n[0], n[1], n[2])
  if (!(len > 0)) throw new Error('Triângulo degenerado: escolha outra face.')
  return [n[0] / len, n[1] / len, n[2] / len]
}

/** Giro mínimo (Rodrigues) que leva `n` a -Z, em graus (X, Y, Z). */
function giroParaBaixo(n: Vec3): Vec3 {
  if (n[2] <= -1 + 1e-12) return [0, 0, 0]
  if (n[2] >= 1 - 1e-12) return [180, 0, 0]
  const [vx, vy, vz] = cross(n, [0, 0, -1])
  const K: Mat = [0, -vz, vy, vz, 0, -vx, -vy, vx, 0]
  const K2 = mul(K, K)
  const k = 1 / (1 - n[2]) // 1/(1+cos): cos = n·(0,0,-1) = -nz
  return eulerDe(K.map((v, i) => (i % 4 === 0 ? 1 : 0) + v + K2[i] * k))
}

/** Caixa envolvente da malha depois de girar cada vértice em torno de `pivo` (igual ao kernel, antes de `mover`). */
export function bboxGirada(m: EntradaMalha, girar: Vec3, pivo: Vec3): Caixa {
  const { pos, idx } = normaliza(m)
  const R = matRot(girar)
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (const v of idx) {
    const x = pos[v * 3] - pivo[0], y = pos[v * 3 + 1] - pivo[1], z = pos[v * 3 + 2] - pivo[2]
    for (let r = 0; r < 3; r++) {
      const p = R[r * 3] * x + R[r * 3 + 1] * y + R[r * 3 + 2] * z + pivo[r]
      if (p < min[r]) min[r] = p
      if (p > max[r]) max[r] = p
    }
  }
  return { min, max }
}

/** `mover` que põe o menor z da caixa em 0 (encosta na mesa). */
export function soltarNaMesa(bb: Caixa): Vec3 {
  return [0, 0, -bb.min[2]]
}

/** `mover` que leva o centro XY da caixa ao centro da mesa. z = 0. */
export function centralizar(bb: Caixa, volume: { x: number; y: number }): Vec3 {
  return [volume.x / 2 - (bb.min[0] + bb.max[0]) / 2, volume.y / 2 - (bb.min[1] + bb.max[1]) / 2, 0]
}

/** Giro que põe a face `tri` virada para -Z, em torno do centro da bbox. */
export function apoiarNaFace(malha: EntradaMalha, tri: number): { girar: Vec3; pivo: Vec3 } {
  const b = bbox(malha)
  const pivo: Vec3 = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2]
  return { girar: giroParaBaixo(normalDe(malha, tri)), pivo }
}

/** Feature `transformacao` que apoia a face `tri` na mesa, solta e (opcional) centraliza. `malha` é o corpo atual do alvo. */
export function orientacaoParaFeature(id: string, malha: EntradaMalha, tri: number, volume: { x: number; y: number }, centraliza = true, alvo?: string): FTransformacao {
  const { girar, pivo } = apoiarNaFace(malha, tri)
  const b = bboxGirada(malha, girar, pivo)
  const c: Vec3 = centraliza ? centralizar(b, volume) : [0, 0, 0]
  const s = soltarNaMesa(b)
  return { id, tipo: 'transformacao', girar, pivo, mover: [c[0], c[1], s[2]], alvo }
}
