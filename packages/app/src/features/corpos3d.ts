// Corpos sólidos na vista three.js: uma malha + arestas por corpo, num grupo `corpos` da cena (Z para cima, mm).
// Só THREE e a cena: nada de DOM. Geometria é recriada só quando a referência de `pos` muda.
import * as THREE from 'three'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { CorpoInfo } from './contrato.ts'
import type { Vista } from '../viewport/vista.ts'

export interface AcertoCorpo { corpoId: string; ponto: [number, number, number]; tri: number }

export interface Corpos3d {
  atualiza(corpos: Iterable<CorpoInfo>, cores: Record<string, string>, ocultos: ReadonlySet<string>, selecionados: ReadonlySet<string>): void
  pega(clientX: number, clientY: number): AcertoCorpo | null
  triangulosVisiveis(): number
  dispose(): void
}

const LIMITE_ARESTAS = 300000 // PROJETO §4.3 item 7: acima disso, arestas somem para manter o quadro
const ANGULO_ARESTA = 20
const COR_PADRAO = '#b8b4ac'
const COR_ARESTA = '#15171a'
const COR_ARESTA_SEL = '#ff8c00'
const EMISSIVA_SEL = 0x3a2400

interface Entrada {
  pos: Float32Array
  tri: number
  grupo: THREE.Group
  malha: THREE.Mesh
  arestas: THREE.LineSegments
  matMalha: THREE.MeshStandardMaterial
  matArestas: THREE.LineBasicMaterial
  geoMalha: THREE.BufferGeometry
  geoArestas: THREE.BufferGeometry
}

export function criaCorpos3d(vista: Pick<Vista, 'cena' | 'pedeRender' | 'raio'>): Corpos3d {
  const raiz = new THREE.Group()
  raiz.name = 'corpos'
  vista.cena.add(raiz)
  const entradas = new Map<string, Entrada>()

  function cria(c: CorpoInfo): Entrada {
    const indexada = new THREE.BufferGeometry()
    indexada.setAttribute('position', new THREE.BufferAttribute(c.pos, 3))
    indexada.setIndex(new THREE.BufferAttribute(c.idx, 1))
    const geoArestas = new THREE.EdgesGeometry(indexada, ANGULO_ARESTA)
    // Normais com vinco: quina viva fica plana, curva fica suave. Sai não indexada; faceIndex do raycast segue = triângulo.
    const geoMalha = toCreasedNormals(indexada, THREE.MathUtils.degToRad(ANGULO_ARESTA))
    const matMalha = new THREE.MeshStandardMaterial({
      color: COR_PADRAO, flatShading: false, side: THREE.FrontSide,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, // a malha recua um pouco para as arestas aparecerem
    })
    const matArestas = new THREE.LineBasicMaterial({ color: COR_ARESTA })
    const malha = new THREE.Mesh(geoMalha, matMalha)
    malha.userData.corpoId = c.id
    const arestas = new THREE.LineSegments(geoArestas, matArestas)
    const grupo = new THREE.Group()
    grupo.name = `corpo:${c.id}`
    grupo.add(malha, arestas)
    raiz.add(grupo)
    return { pos: c.pos, tri: c.tri, grupo, malha, arestas, matMalha, matArestas, geoMalha, geoArestas }
  }

  function descarta(e: Entrada) {
    raiz.remove(e.grupo)
    e.geoMalha.dispose(); e.geoArestas.dispose()
    e.matMalha.dispose(); e.matArestas.dispose()
  }

  function atualiza(corpos: Iterable<CorpoInfo>, cores: Record<string, string>, ocultos: ReadonlySet<string>, selecionados: ReadonlySet<string>) {
    const lista = [...corpos]
    const total = lista.reduce((s, c) => s + c.tri, 0)
    const semArestas = total > LIMITE_ARESTAS
    const ids = new Set<string>()
    for (const c of lista) {
      ids.add(c.id)
      let e = entradas.get(c.id)
      if (e && e.pos !== c.pos) { descarta(e); e = undefined } // geometria nova: recria o corpo inteiro
      if (!e) { e = cria(c); entradas.set(c.id, e) }
      e.tri = c.tri
      const sel = selecionados.has(c.id)
      e.grupo.visible = !ocultos.has(c.id)
      e.matMalha.color.set(cores[c.id] ?? COR_PADRAO)
      e.matMalha.emissive.setHex(sel ? EMISSIVA_SEL : 0)
      e.matArestas.color.set(sel ? COR_ARESTA_SEL : COR_ARESTA)
      e.arestas.visible = !semArestas
    }
    for (const [id, e] of entradas) {
      if (!ids.has(id)) { descarta(e); entradas.delete(id) }
    }
    vista.pedeRender()
  }

  function pega(clientX: number, clientY: number): AcertoCorpo | null {
    const r = vista.raio(clientX, clientY)
    const alvos: THREE.Object3D[] = []
    for (const e of entradas.values()) if (e.grupo.visible) alvos.push(e.malha)
    const hit = new THREE.Raycaster(r.origin, r.direction).intersectObjects(alvos, false)[0]
    if (!hit) return null
    return { corpoId: String(hit.object.userData.corpoId), ponto: [hit.point.x, hit.point.y, hit.point.z], tri: hit.faceIndex ?? -1 }
  }

  function triangulosVisiveis(): number {
    let n = 0
    for (const e of entradas.values()) if (e.grupo.visible) n += e.tri
    return n
  }

  function dispose() {
    for (const e of entradas.values()) descarta(e)
    entradas.clear()
    vista.cena.remove(raiz)
    vista.pedeRender()
  }

  return { atualiza, pega, triangulosVisiveis, dispose }
}
