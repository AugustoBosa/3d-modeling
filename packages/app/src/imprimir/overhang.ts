// Vista "overhang": cor por triangulo conforme a inclinacao em relacao a vertical (mesma regra de core/imprimir/verificar.ts).
// coresOverhang e puro (sem THREE); criaOverhang monta um Mesh por corpo num grupo `overhang` da cena.
import * as THREE from 'three'
import type { Vista } from '../viewport/vista.ts'

type RGB = [number, number, number]
export interface CorOverhang { pos: Float32Array; cor: Float32Array; areaMm2: number }
export interface Overhang {
  mostra(corpos: Iterable<{ id: string; pos: Float32Array; idx: Uint32Array }>, limiarGraus: number, ocultos: ReadonlySet<string>): { areaMm2: number }
  esconde(): void
  readonly ligado: boolean
  dispose(): void
}

const VERDE: RGB = [0x3f / 255, 0xae / 255, 0x5b / 255]
const AMARELO: RGB = [0xf2 / 255, 0xd3 / 255, 0x2e / 255]
const LARANJA: RGB = [0xf0 / 255, 0x8a / 255, 0x24 / 255]
const VERMELHO: RGB = [0xd6 / 255, 0x3c / 255, 0x3c / 255]
const SUPORTE = 1e-3 // mesma tolerancia de apoio de verificar.ts

const mistura = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

// 0 verde -> 50% do limiar amarelo -> limiar laranja; acima do limiar vermelho puro
function corPorAlpha(alpha: number, limiar: number): RGB {
  if (alpha <= 0) return VERDE
  if (alpha > limiar) return VERMELHO
  if (alpha <= limiar / 2) return mistura(VERDE, AMARELO, alpha / (limiar / 2))
  return mistura(AMARELO, LARANJA, (alpha - limiar / 2) / (limiar / 2))
}

/** Geometria sem indice (9 floats por triangulo) e cor por triangulo; areaMm2 = area acima do limiar fora da mesa. */
export function coresOverhang(pos: Float32Array, idx: Uint32Array, limiarGraus: number): CorOverhang {
  let zMin = Infinity
  for (let i = 2; i < pos.length; i += 3) if (pos[i] < zMin) zMin = pos[i]
  const nTri = idx.length / 3
  const outPos = new Float32Array(nTri * 9)
  const cor = new Float32Array(nTri * 9)
  let areaMm2 = 0
  for (let t = 0; t < nTri; t++) {
    const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2]
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2]
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nzRaw = ux * vy - uy * vx
    const len = Math.hypot(nx, ny, nzRaw)
    const nz = len === 0 ? 0 : nzRaw / len
    const apoio = pos[a + 2] <= zMin + SUPORTE && pos[b + 2] <= zMin + SUPORTE && pos[c + 2] <= zMin + SUPORTE
    const alpha = !apoio && nz < 0 ? Math.asin(Math.min(1, -nz)) * 180 / Math.PI : 0
    if (alpha > limiarGraus) areaMm2 += len / 2
    const rgb = corPorAlpha(alpha, limiarGraus)
    for (let k = 0; k < 3; k++) {
      const v = idx[t * 3 + k] * 3
      for (let j = 0; j < 3; j++) {
        outPos[t * 9 + k * 3 + j] = pos[v + j]
        cor[t * 9 + k * 3 + j] = rgb[j]
      }
    }
  }
  return { pos: outPos, cor, areaMm2 }
}

export function criaOverhang(vista: Pick<Vista, 'cena' | 'pedeRender'>): Overhang {
  const grupo = new THREE.Group()
  grupo.name = 'overhang'
  vista.cena.add(grupo)
  let ligado = false

  function limpa() {
    for (const filho of grupo.children) {
      const malha = filho as THREE.Mesh
      const mat = malha.material as THREE.Material
      malha.geometry.dispose()
      mat.dispose()
    }
    grupo.clear()
    ligado = false
  }

  function esconde() {
    limpa()
    vista.pedeRender()
  }

  function mostra(corpos: Iterable<{ id: string; pos: Float32Array; idx: Uint32Array }>, limiarGraus: number, ocultos: ReadonlySet<string>) {
    limpa()
    let areaMm2 = 0
    for (const c of corpos) {
      if (ocultos.has(c.id)) continue
      const r = coresOverhang(c.pos, c.idx, limiarGraus)
      areaMm2 += r.areaMm2
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(r.pos, 3))
      geo.setAttribute('color', new THREE.BufferAttribute(r.cor, 3))
      // polygonOffset negativo: a face colorida fica na frente da malha normal (que recua com factor +1)
      const mat = new THREE.MeshBasicMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
      const malha = new THREE.Mesh(geo, mat)
      malha.name = `overhang:${c.id}`
      grupo.add(malha)
    }
    ligado = true
    vista.pedeRender()
    return { areaMm2 }
  }

  function dispose() {
    limpa()
    vista.cena.remove(grupo)
    vista.pedeRender()
  }

  return { mostra, esconde, get ligado() { return ligado }, dispose }
}
