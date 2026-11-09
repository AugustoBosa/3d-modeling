// Malhas feitas à mão para os testes (cubo, cubo aberto, dois corpos).
import type { Malha } from '../src/malha/tipos.ts'

/** Caixa sx × sy × sz com canto mínimo em (ox, oy, oz). Fechada, anti-horário visto de fora, 8 vértices, 12 triângulos. */
export function caixa(sx: number, sy: number, sz: number, ox = 0, oy = 0, oz = 0): Malha {
  const vertProps = new Float32Array([
    ox, oy, oz, ox + sx, oy, oz, ox + sx, oy + sy, oz, ox, oy + sy, oz,
    ox, oy, oz + sz, ox + sx, oy, oz + sz, ox + sx, oy + sy, oz + sz, ox, oy + sy, oz + sz,
  ])
  const triVerts = new Uint32Array([
    0, 2, 1, 0, 3, 2, // base (-z)
    4, 5, 6, 4, 6, 7, // topo (+z)
    0, 1, 5, 0, 5, 4, // frente (-y)
    2, 3, 7, 2, 7, 6, // fundo (+y)
    0, 4, 7, 0, 7, 3, // esquerda (-x)
    1, 2, 6, 1, 6, 5, // direita (+x)
  ])
  return { vertProps, triVerts }
}
export const cubo = (lado: number, ox = 0, oy = 0, oz = 0) => caixa(lado, lado, lado, ox, oy, oz)

/** Cubo sem o último triângulo (malha aberta). */
export function cuboAberto(lado: number): Malha {
  const m = cubo(lado)
  return { vertProps: m.vertProps, triVerts: m.triVerts.slice(0, m.triVerts.length - 3) }
}

/** Cubo com todos os triângulos invertidos (volume negativo). */
export function cuboInvertido(lado: number): Malha {
  const m = cubo(lado)
  const t = m.triVerts.slice()
  for (let i = 0; i < t.length; i += 3) { const a = t[i + 1]; t[i + 1] = t[i + 2]; t[i + 2] = a }
  return { vertProps: m.vertProps, triVerts: t }
}

export const doisCorpos = () => [
  { nome: 'Base', malha: cubo(20), cor: '#FF0000', slot: 1 },
  { nome: 'Tampa', malha: cubo(20, 40, 0, 0), cor: '#0000FF', slot: 2 },
]
