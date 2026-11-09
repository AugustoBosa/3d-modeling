// Corpos de referência: malhas importadas só para guiar o desenho. Ficam num grupo da cena, fora do documento e do export.
import * as THREE from 'three'
import { normaliza, type Malha } from '@3dm/core/malha'
import type { Vista } from '../viewport/vista.ts'

const ANGULO_ARESTA = 30
const COR_MALHA = 0xd0d0d0
const COR_ARESTA = 0x6b7078

export interface Referencias {
  /** Devolve o número de triângulos da malha adicionada. */
  adiciona(nome: string, malha: Malha): number
  limpa(): void
  quantidade(): number
  dispose(): void
}

interface Item { malha: THREE.Mesh; arestas: THREE.LineSegments }

export function criaReferencias(vista: Pick<Vista, 'cena' | 'pedeRender'>): Referencias {
  const grupo = new THREE.Group()
  grupo.name = 'referencias'
  vista.cena.add(grupo)
  const itens: Item[] = []

  function descarta(i: Item) {
    grupo.remove(i.malha, i.arestas)
    i.malha.geometry.dispose(); (i.malha.material as THREE.Material).dispose()
    i.arestas.geometry.dispose(); (i.arestas.material as THREE.Material).dispose()
  }

  return {
    adiciona(nome, malha) {
      const { pos, idx } = normaliza(malha)
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      geo.setIndex(new THREE.BufferAttribute(idx, 1))
      geo.computeVertexNormals()
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color: COR_MALHA, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide,
      }))
      mesh.name = nome
      const arestas = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo, ANGULO_ARESTA),
        new THREE.LineBasicMaterial({ color: COR_ARESTA }),
      )
      grupo.add(mesh, arestas)
      itens.push({ malha: mesh, arestas })
      vista.pedeRender()
      return idx.length / 3
    },
    limpa() {
      for (const i of itens.splice(0)) descarta(i)
      vista.pedeRender()
    },
    quantidade: () => itens.length,
    dispose() {
      for (const i of itens.splice(0)) descarta(i)
      vista.cena.remove(grupo)
      vista.pedeRender()
    },
  }
}
