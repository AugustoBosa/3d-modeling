import { test } from 'node:test'
import assert from 'node:assert/strict'
import { geometriaCotas } from '../src/features/cotas3d.ts'
import { numeroPtBr, rotuloCota } from '../src/features/cotas-formato.ts'

const bbox = { min: [0, 0, 0] as [number, number, number], max: [80, 50, 30] as [number, number, number] }
const perto = (a: number, b: number): void => assert.ok(Math.abs(a - b) <= 1e-9, `${a} não está perto de ${b}`)

test('geometriaCotas: 3 cotas L, W, H com valores 80, 50, 30', () => {
  const cotas = geometriaCotas(bbox)
  assert.equal(cotas.length, 3)
  assert.deepEqual(cotas.map(c => c.rotulo), ['L', 'W', 'H'])
  cotas.forEach((c, i) => perto(c.valor, [80, 50, 30][i]))
})

test('geometriaCotas: a para b tem o comprimento do valor', () => {
  for (const c of geometriaCotas(bbox)) {
    const d = Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1], c.b[2] - c.a[2])
    perto(d, c.valor)
  }
})

test('geometriaCotas: cada cota tem linha de cota, duas extensões e dois tracinhos', () => {
  for (const c of geometriaCotas(bbox)) assert.equal(c.linhas.length, 5)
})

test('formatador pt-BR: vírgula e 2 casas; rótulo com mm', () => {
  assert.equal(numeroPtBr(80), '80,00')
  assert.equal(rotuloCota('L', 80), 'L 80,00 mm')
})
