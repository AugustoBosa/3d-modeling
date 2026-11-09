import { test } from 'node:test'
import assert from 'node:assert/strict'
import { distancia, angulo, raioCirculo, areaFace, volumeMalha } from '../src/medir/medir.ts'
import type { V3 } from '../src/medir/medir.ts'
import { caixa } from './malha-fixtures.ts'

const perto = (x: number, esperado: number, tol = 0.01) => assert.ok(Math.abs(x - esperado) <= tol, `${x} != ${esperado}`)
const pertoV = (a: V3, b: V3) => { perto(a[0], b[0]); perto(a[1], b[1]); perto(a[2], b[2]) }

// Rotação fixa: X depois Z (plano inclinado).
const girar = (p: V3): V3 => {
  const [x, y, z] = p
  const y1 = y * Math.cos(0.6) - z * Math.sin(0.6), z1 = y * Math.sin(0.6) + z * Math.cos(0.6)
  const x2 = x * Math.cos(0.9) - y1 * Math.sin(0.9), y2 = x * Math.sin(0.9) + y1 * Math.cos(0.9)
  return [x2, y2, z1]
}

const circulo = (raio: number, centro: V3, n = 12): V3[] =>
  Array.from({ length: n }, (_, i) => {
    const t = (i * 2 * Math.PI) / n + 0.3
    return [centro[0] + raio * Math.cos(t), centro[1] + raio * Math.sin(t), centro[2]] as V3
  })

test('distancia((0,0,0),(3,4,12)) = 13', () => {
  perto(distancia([0, 0, 0], [3, 4, 12]), 13)
})

test('angulo: 90, 45 e 180 graus; vetor zero lança erro', () => {
  perto(angulo([1, 0, 0], [0, 0, 0], [0, 1, 0]), 90)
  perto(angulo([1, 0, 0], [0, 0, 0], [1, 1, 0]), 45)
  perto(angulo([1, 0, 0], [0, 0, 0], [-1, 0, 0]), 180)
  assert.throws(() => angulo([0, 0, 0], [0, 0, 0], [0, 1, 0]))
})

test('raioCirculo: círculo raio 12.345 centro (10,-5,7) no plano z=7', () => {
  const { raio, centro } = raioCirculo(circulo(12.345, [10, -5, 7]))
  perto(raio, 12.345)
  pertoV(centro, [10, -5, 7])
})

test('raioCirculo: mesmo círculo num plano inclinado', () => {
  const { raio, centro } = raioCirculo(circulo(12.345, [10, -5, 7]).map(girar))
  perto(raio, 12.345)
  pertoV(centro, girar([10, -5, 7]))
})

test('raioCirculo: menos de 3 pontos ou colineares lança erro', () => {
  assert.throws(() => raioCirculo([[0, 0, 0], [1, 0, 0]]))
  assert.throws(() => raioCirculo([[0, 0, 0], [1, 0, 0], [2, 0, 0]]))
})

test('areaFace: topo 200 mm², lateral 600 mm² na caixa 10x20x30', () => {
  const m = caixa(10, 20, 30)
  for (const t of [2, 3]) perto(areaFace(m, t), 200)
  for (const t of [10, 11]) perto(areaFace(m, t), 600)
})

test('volumeMalha da caixa 10x20x30 = 6000', () => {
  perto(volumeMalha(caixa(10, 20, 30)), 6000)
})
