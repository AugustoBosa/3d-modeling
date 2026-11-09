import type { Manifold } from 'manifold-3d'
import type { Malha } from '../malha/tipos.ts'

/** Copia a malha de um Manifold para o formato do projeto. Não deleta `m`. */
export function malhaDe(m: Manifold): Malha {
  const mesh = m.getMesh()
  return {
    vertProps: mesh.vertProperties.slice(),
    triVerts: mesh.triVerts.slice(),
    numProp: mesh.numProp,
  }
}
