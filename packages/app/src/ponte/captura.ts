// Captura PNG das vistas (iso/frente/topo/direita) renderizando a cena do app offscreen, para a ponte MCP.
// Não mexe na câmera nem no estado da vista do usuário: usa um renderer e uma câmera próprios.
import * as THREE from 'three'
import type { Vista } from '../viewport/vista.ts'

export type NomeVista = 'iso' | 'frente' | 'topo' | 'direita'
type Vec3 = [number, number, number]
const COR_ARESTA = '#15171a' // igual à de features/corpos3d.ts (sem seleção)

// Z para cima. `dir` vai do alvo para a câmera. Na iso, o up é Z sem a parte paralela a `dir` (é o up de fato da vista).
const isoDir = new THREE.Vector3(1, -1, 1).normalize()
const isoUp = new THREE.Vector3(0, 0, 1).addScaledVector(isoDir, -isoDir.z).normalize()
const DIRECOES: Record<NomeVista, { dir: Vec3; up: Vec3 }> = {
  iso: { dir: isoDir.toArray() as Vec3, up: isoUp.toArray() as Vec3 },
  frente: { dir: [0, -1, 0], up: [0, 0, 1] },
  topo: { dir: [0, 0, 1], up: [0, 1, 0] },
  direita: { dir: [1, 0, 0], up: [0, 0, 1] },
}

/** Parte pura (testável no Node): direção da câmera (do alvo para a câmera, unitária) e vetor "up" por vista. Z para cima. */
export function direcaoDaVista(v: NomeVista): { dir: [number, number, number]; up: [number, number, number] } {
  const e = DIRECOES[v]
  return { dir: [...e.dir], up: [...e.up] }
}

/** Meia-altura ortográfica que enquadra uma caixa (min/max) vista nessa direção, com margem de 15 %. */
export function metadeOrtografica(min: [number, number, number], max: [number, number, number], v: NomeVista, aspecto: number): number {
  const { dir, up } = DIRECOES[v]
  const d = new THREE.Vector3(...dir)
  const cima = new THREE.Vector3(...up)
  const direita = new THREE.Vector3().crossVectors(cima, d).normalize()
  const centro = new THREE.Vector3(...min).add(new THREE.Vector3(...max)).multiplyScalar(0.5)
  let meiaAltura = 0, meiaLargura = 0
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
    const p = new THREE.Vector3(x, y, z).sub(centro)
    meiaAltura = Math.max(meiaAltura, Math.abs(p.dot(cima)))
    meiaLargura = Math.max(meiaLargura, Math.abs(p.dot(direita)))
  }
  return Math.max(meiaAltura, meiaLargura / aspecto) * 1.1
}

export function criaCapturador(vista: Vista, tamanho = { w: 800, h: 600 }): (vistas: string[], opc?: { mostrarVolume?: boolean }) => Promise<{ vista: string; png: string }[]> {
  let renderer: THREE.WebGLRenderer | null = null // criado na primeira captura, reaproveitado nas seguintes

  return async (vistas: string[], opc: { mostrarVolume?: boolean } = {}) => {
    renderer ??= new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(1)
    renderer.setSize(tamanho.w, tamanho.h, false)
    const aspecto = tamanho.w / tamanho.h

    // Esconde mesa/volume/grade/eixos (a menos que peçam) e tira a seleção: a imagem é do modelo, não da interface.
    const acessorios = ['impressora', 'grade', 'eixos'].map(n => vista.cena.getObjectByName(n)).filter((o): o is THREE.Object3D => !!o)
    const visiveis = acessorios.map(o => o.visible)
    const restauros: (() => void)[] = []
    if (!opc.mostrarVolume) acessorios.forEach(o => { o.visible = false })
    const corpos = vista.cena.getObjectByName('corpos')
    corpos?.traverse(o => {
      const m = (o as THREE.Mesh).material
      if (m instanceof THREE.MeshStandardMaterial) { const e = m.emissive.getHex(); m.emissive.setHex(0); restauros.push(() => m.emissive.setHex(e)) }
      else if (m instanceof THREE.LineBasicMaterial) { const c = m.color.getHex(); m.color.set(COR_ARESTA); restauros.push(() => m.color.setHex(c)) }
    })

    // Enquadra os corpos visíveis (com margem em metadeOrtografica); sem corpos, a cena visível; vazia, caixa padrão.
    const caixa = new THREE.Box3()
    for (const g of corpos?.children ?? []) if (g.visible) caixa.expandByObject(g)
    if (caixa.isEmpty()) for (const o of vista.cena.children) if (o.visible && !(o as THREE.Light).isLight) caixa.expandByObject(o)
    if (caixa.isEmpty()) caixa.set(new THREE.Vector3(-50, -50, -50), new THREE.Vector3(50, 50, 50))
    const centro = caixa.getCenter(new THREE.Vector3())
    const diametro = caixa.getSize(new THREE.Vector3()).length()
    const fundo = vista.cena.background
    renderer.setClearColor(fundo instanceof THREE.Color ? fundo : 0x1b1d21)

    const saida: { vista: string; png: string }[] = []
    try {
    for (const nome of vistas) {
      if (!Object.hasOwn(DIRECOES, nome)) throw new Error(`Vista desconhecida: ${nome}. Use iso, frente, topo ou direita.`)
      const v = nome as NomeVista
      const { dir, up } = DIRECOES[v]
      const meia = metadeOrtografica(caixa.min.toArray() as Vec3, caixa.max.toArray() as Vec3, v, aspecto)
      const cam = new THREE.OrthographicCamera(-meia * aspecto, meia * aspecto, meia, -meia, diametro * 0.1, diametro * 10)
      cam.up.set(...up)
      cam.position.copy(centro).addScaledVector(new THREE.Vector3(...dir), diametro * 3)
      cam.lookAt(centro)
      cam.updateProjectionMatrix()

      renderer.render(vista.cena, cam)
      // Sem await entre render e toDataURL: o buffer do canvas ainda é o desta renderização.
      const url = renderer.domElement.toDataURL('image/png')
      saida.push({ vista: v, png: url.replace(/^data:image\/png;base64,/, '') })
    }
    } finally {
      acessorios.forEach((o, i) => { o.visible = visiveis[i] })
      restauros.forEach(f => f())
    }
    return saida
  }
}
