import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apoiarNaFace, bboxGirada, centralizar, orientacaoParaFeature, soltarNaMesa } from '../src/imprimir/orientacao.ts'
import { novoDocumento } from '../src/doc/index.ts'
import type { Feature } from '../src/doc/index.ts'
import { entradaDe } from '../src/features/index.ts'
import { Regenerador } from '../src/regen/index.ts'
import { bbox, volume } from '../src/malha/index.ts'
import type { MalhaPosicoes } from '../src/malha/index.ts'
import { caixa } from './malha-fixtures.ts'

const CAIXA = caixa(10, 20, 30)
const MESA = { x: 210, y: 210 }
const perto = (a: number, b: number, tol = 1e-6) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`)

test('soltarNaMesa: caixa em z = 5 vai para z = 0', () => {
  const c = caixa(10, 10, 10, 0, 0, 5)
  const m = soltarNaMesa(bbox(c))
  assert.deepEqual(m, [0, 0, -5])
  perto(bbox(c).min[2] + m[2], 0)
})

test('centralizar: centro XY da caixa vai para o meio da mesa 210x210', () => {
  const c = caixa(20, 30, 10)
  const m = centralizar(bbox(c), MESA)
  assert.equal(m[2], 0)
  perto(10 + m[0], 105)
  perto(15 + m[1], 105)
})

const faces: [number, string, number][] = [
  [0, '-Z', 30], [2, '+Z', 30], [4, '-Y', 20], [6, '+Y', 20], [8, '-X', 10], [10, '+X', 10],
]
// Sub-malha com só os dois triângulos da face (pares de triângulos do caixa(); `t` é o índice do 1º).
const faceDe = (m: typeof CAIXA, t: number): MalhaPosicoes => ({ posicoes: m.vertProps, indices: m.triVerts.slice(3 * t, 3 * t + 6) })

for (const [tri, nome, espessura] of faces) {
  test(`apoiarNaFace ${nome}: face fica no chão e a altura é ${espessura}`, () => {
    const { girar, pivo } = apoiarNaFace(CAIXA, tri)
    const corpo = bboxGirada(CAIXA, girar, pivo)
    const face = bboxGirada(faceDe(CAIXA, tri), girar, pivo)
    perto(corpo.max[2] - corpo.min[2], espessura, 1e-4)
    perto(face.max[2] - face.min[2], 0, 1e-4) // face plana: normal em ±Z
    perto(face.min[2], corpo.min[2], 1e-4) // e embaixo
  })
}

test('apoiarNaFace: face já voltada para -Z não gira; face +Z gira 180 em X', () => {
  const baixo = apoiarNaFace(CAIXA, 0).girar
  assert.ok(baixo.every((g) => Math.abs(g) < 1e-9))
  assert.deepEqual(apoiarNaFace(CAIXA, 2).girar, [180, 0, 0])
})

test('apoiarNaFace: face inclinada (normal diagonal) fica plana no chão e embaixo', () => {
  // tetraedro convexo; triângulo 1 = [0,1,3] tem normal para fora diagonal
  const tet: MalhaPosicoes = {
    posicoes: new Float32Array([0, 0, 0, 3, 0, 0, 0, 2, 0, 1, 1, 4]),
    indices: new Uint32Array([0, 2, 1, 0, 1, 3, 1, 2, 3, 0, 3, 2]),
  }
  const { girar, pivo } = apoiarNaFace(tet, 1)
  const corpo = bboxGirada(tet, girar, pivo)
  const face = bboxGirada({ posicoes: tet.posicoes, indices: tet.indices.slice(3, 6) }, girar, pivo)
  perto(face.max[2] - face.min[2], 0, 1e-4)
  perto(face.min[2], corpo.min[2], 1e-4)
})

test('orientacaoParaFeature: monta transformação com alvo, girar, pivô e mover', () => {
  const f = orientacaoParaFeature('t1', CAIXA, 10, MESA, true, 'c1')
  assert.equal(f.tipo, 'transformacao')
  assert.equal(f.id, 't1')
  assert.equal(f.alvo, 'c1')
  assert.ok(f.girar && f.pivo && f.mover)
  assert.equal(f.mover![2], -bboxGirada(CAIXA, f.girar!, f.pivo!).min[2])
})

test('integrado com o kernel: caixa + transformação regenera no chão, centrada, com o mesmo volume', () => {
  const doc = novoDocumento()
  const t = orientacaoParaFeature('t1', CAIXA, 10, MESA, true, 'c1')
  doc.features = [
    { id: 'c1', tipo: 'caixa', pos: [0, 0, 0], dim: [10, 20, 30] },
    { ...t },
  ] as Feature[]
  const reg = new Regenerador()
  try {
    const r = reg.regenera(entradaDe(doc))
    assert.equal(r.status.get('t1')?.estado, 'ok')
    const m = r.corpos.get('c1')!
    const b = bbox(m)
    perto(b.min[2], 0, 1e-3)
    perto((b.min[0] + b.max[0]) / 2, 105, 1e-3)
    perto((b.min[1] + b.max[1]) / 2, 105, 1e-3)
    perto(volume(m), 6000, 0.01)
  } finally {
    reg.dispose()
  }
})
