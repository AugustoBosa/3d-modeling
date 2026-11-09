// Malha indexada simples. Mesmo formato do `Mesh` do manifold-3d (vertProps + triVerts) ou posicoes + indices.
export interface Malha {
  vertProps: Float32Array // numProp floats por vértice; os 3 primeiros são x, y, z
  triVerts: Uint32Array // 3 índices por triângulo, anti-horário visto de fora
  numProp?: number // padrão 3
}
export interface MalhaPosicoes {
  posicoes: Float32Array // x, y, z por vértice
  indices: Uint32Array
}
export type EntradaMalha = Malha | MalhaPosicoes

/** Posições compactadas (3 floats por vértice) + índices, qualquer que seja a entrada. */
export function normaliza(m: EntradaMalha): { pos: Float32Array; idx: Uint32Array } {
  if ('posicoes' in m) return { pos: m.posicoes, idx: m.indices }
  const n = m.numProp ?? 3
  if (n === 3) return { pos: m.vertProps, idx: m.triVerts }
  const nv = m.vertProps.length / n
  const pos = new Float32Array(nv * 3)
  for (let i = 0; i < nv; i++) for (let c = 0; c < 3; c++) pos[i * 3 + c] = m.vertProps[i * n + c]
  return { pos, idx: m.triVerts }
}
