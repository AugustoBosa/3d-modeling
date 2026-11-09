// Gizmo de manipulação na vista: 3 setas e 3 anéis (X vermelho, Y verde, Z azul), sempre por cima da malha (depthTest false).
// Geometria em mm, no grupo posicionado no centro. A ponta da seta tem tamanho fixo em pixels (via mmPorPixel no mostra).
import * as THREE from 'three'
import type { V3 } from './contrato.ts'
import type { Alca } from './gizmo.ts'
import type { Vista } from '../viewport/vista.ts'

type Eixo = 'X' | 'Y' | 'Z'

const COR: Record<Eixo, number> = { X: 0xe5484d, Y: 0x46a758, Z: 0x3e63dd }
const COR_DESTAQUE = 0xffd60a
const EIXOS: Eixo[] = ['X', 'Y', 'Z']
const DIR: Record<Eixo, THREE.Vector3> = {
  X: new THREE.Vector3(1, 0, 0), Y: new THREE.Vector3(0, 1, 0), Z: new THREE.Vector3(0, 0, 1),
}
const EIXO_Z = new THREE.Vector3(0, 0, 1)
const PONTA_PX = 12, RAIO_PONTA_PX = 4
const PONTOS_ANEL = 64
const FATOR_ANEL = 0.7

export interface Gizmo3d {
  mostra(centro: V3, tamanho: number): void
  esconde(): void
  destaca(alca: Alca | null): void
  readonly visivel: boolean
  dispose(): void
}

/** Cor-base de uma chave `tipo:eixo`. */
const corBase = (chave: string): number => COR[chave.slice(-1) as Eixo]

export function criaGizmo3d(vista: Pick<Vista, 'cena' | 'pedeRender' | 'mmPorPixel'>): Gizmo3d {
  const grupo = new THREE.Group()
  grupo.name = 'gizmo'
  grupo.visible = false

  // materiais criados uma vez por alça; a geometria é refeita quando tamanho ou escala de pixels mudam
  const mats = new Map<string, THREE.Material[]>()
  for (const eixo of EIXOS) {
    const cor = COR[eixo]
    mats.set(`seta:${eixo}`, [
      new THREE.LineBasicMaterial({ color: cor, depthTest: false }),
      new THREE.MeshBasicMaterial({ color: cor, depthTest: false }),
    ])
    mats.set(`anel:${eixo}`, [new THREE.LineBasicMaterial({ color: cor, depthTest: false })])
  }
  let geos: THREE.BufferGeometry[] = []
  let montadoTam = -1, montadoPx = -1
  let destacado: string | null = null

  function monta(tam: number, px: number): void {
    for (const g of geos) g.dispose()
    geos = []
    grupo.clear()
    const ponta = PONTA_PX * px, raioPonta = RAIO_PONTA_PX * px
    for (const eixo of EIXOS) {
      const eixoGrupo = new THREE.Group()
      eixoGrupo.quaternion.setFromUnitVectors(EIXO_Z, DIR[eixo]) // a geometria é feita em Z e girada para o eixo
      const [matLinha, matCone] = mats.get(`seta:${eixo}`) as [THREE.LineBasicMaterial, THREE.MeshBasicMaterial]

      const linha = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, tam)])
      const cone = new THREE.ConeGeometry(raioPonta, ponta, 12)
      cone.rotateX(Math.PI / 2) // ponta para +Z
      cone.translate(0, 0, tam)
      geos.push(linha, cone)
      const seta = new THREE.Line(linha, matLinha)
      seta.renderOrder = 30
      const ponteiro = new THREE.Mesh(cone, matCone)
      ponteiro.renderOrder = 31
      eixoGrupo.add(seta, ponteiro)

      const pts: THREE.Vector3[] = []
      for (let k = 0; k < PONTOS_ANEL; k++) {
        const th = (2 * Math.PI * k) / PONTOS_ANEL
        pts.push(new THREE.Vector3(tam * FATOR_ANEL * Math.cos(th), tam * FATOR_ANEL * Math.sin(th), 0))
      }
      const anelGeo = new THREE.BufferGeometry().setFromPoints(pts)
      geos.push(anelGeo)
      const anel = new THREE.LineLoop(anelGeo, mats.get(`anel:${eixo}`)![0])
      anel.renderOrder = 30
      eixoGrupo.add(anel)

      grupo.add(eixoGrupo)
    }
    aplicaCores()
  }

  function aplicaCores(): void {
    for (const [chave, ms] of mats) for (const m of ms) (m as THREE.LineBasicMaterial).color.set(chave === destacado ? COR_DESTAQUE : corBase(chave))
  }

  return {
    mostra(centro, tamanho) {
      const px = vista.mmPorPixel()
      if (tamanho !== montadoTam || px !== montadoPx) { monta(tamanho, px); montadoTam = tamanho; montadoPx = px }
      grupo.position.set(centro[0], centro[1], centro[2])
      grupo.visible = true
      if (!grupo.parent) vista.cena.add(grupo)
      vista.pedeRender()
    },
    esconde() {
      grupo.visible = false
      vista.pedeRender()
    },
    destaca(alca) {
      const chave = alca ? `${alca.tipo}:${alca.eixo}` : null
      if (chave === destacado) return
      destacado = chave
      aplicaCores()
      vista.pedeRender()
    },
    get visivel() { return grupo.visible },
    dispose() {
      vista.cena.remove(grupo)
      grupo.clear()
      for (const g of geos) g.dispose()
      geos = []
      for (const ms of mats.values()) for (const m of ms) m.dispose()
      mats.clear()
      vista.pedeRender()
    },
  }
}
