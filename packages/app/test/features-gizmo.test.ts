import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import type { V3 } from '../src/features/contrato.ts'
import { arrastaAnel, arrastaSeta, pegaAlca, tamanhoGizmo } from '../src/features/gizmo.ts'
import type { Raio } from '../src/features/gizmo.ts'
import { criaGizmo3d } from '../src/features/gizmo3d.ts'

const perto = (actual: number[], esperado: number[]) => {
  assert.equal(actual.length, esperado.length)
  esperado.forEach((x, i) => assert.ok(Math.abs(actual[i] - x) < 1e-9, `posição ${i}: ${actual[i]} != ${x}`))
}
// raio que parte de o e passa por alvo (direção normalizada)
const raioDe = (o: V3, alvo: V3): Raio => {
  const v: V3 = [alvo[0] - o[0], alvo[1] - o[1], alvo[2] - o[2]]
  const n = Math.hypot(...v)
  return { origem: o, dir: [v[0] / n, v[1] / n, v[2] / n] }
}
const de = (x: number, y: number, z: number): Raio => ({ origem: [x, y, z], dir: [0, 0, -1] })

test('pegaAlca: seta X sob o raio vertical', () => {
  assert.deepEqual(pegaAlca(de(10, 0, 50), [0, 0, 0], 20, 2), { tipo: 'seta', eixo: 'X' })
})

test('pegaAlca: raio que erra tudo devolve null', () => {
  assert.equal(pegaAlca(de(60, 60, 50), [0, 0, 0], 20, 2), null)
})

test('pegaAlca: anel Z a 45 graus (raio 14), longe das setas', () => {
  const c = 14 * Math.SQRT1_2
  assert.deepEqual(pegaAlca(de(c, c, 50), [0, 0, 0], 20, 2), { tipo: 'anel', eixo: 'Z' })
})

test('arrastaSeta: X de x=5 para x=12 da 7 mm', () => {
  perto(arrastaSeta('X', [0, 0, 0], de(5, 0, 50), de(12, 0, 50)), [7, 0, 0])
})

test('arrastaSeta: raios oblíquos que cruzam o eixo X em 5 e 12', () => {
  const ini = raioDe([0, -100, 50], [5, 0, 0])
  const atual = raioDe([30, -70, 40], [12, 0, 0])
  perto(arrastaSeta('X', [0, 0, 0], ini, atual), [7, 0, 0])
})

test('arrastaSeta: raio paralelo ao eixo devolve zero', () => {
  const paralelo: Raio = { origem: [3, 4, 50], dir: [1, 0, 0] }
  perto(arrastaSeta('X', [0, 0, 0], paralelo, de(5, 0, 50)), [0, 0, 0])
})

test('arrastaAnel: Z de (10,0) para (0,10) gira 90 graus; ao contrário, -90', () => {
  const p10 = de(10, 0, 50), p0_10 = de(0, 10, 50), p0_m10 = de(0, -10, 50)
  assert.ok(Math.abs(arrastaAnel('Z', [0, 0, 0], p10, p0_10) - 90) < 1e-9)
  assert.ok(Math.abs(arrastaAnel('Z', [0, 0, 0], p10, p0_m10) + 90) < 1e-9)
})

test('arrastaAnel: raio paralelo ao plano devolve zero', () => {
  const paralelo: Raio = { origem: [0, 0, 50], dir: [1, 0, 0] }
  assert.equal(arrastaAnel('Z', [0, 0, 0], de(10, 0, 50), paralelo), 0)
})

test('tamanhoGizmo: 0.6 da maior dimensão, mínimo 10', () => {
  assert.ok(Math.abs(tamanhoGizmo({ min: [0, 0, 0], max: [100, 50, 30] }) - 60) < 1e-9)
  assert.equal(tamanhoGizmo({ min: [0, 0, 0], max: [5, 2, 1] }), 10)
})

test('criaGizmo3d: mostra adiciona o grupo, esconde só oculta, dispose remove da cena', () => {
  let renders = 0
  const cena = new THREE.Scene()
  const g = criaGizmo3d({ cena, pedeRender: () => { renders++ }, mmPorPixel: () => 1 })
  assert.equal(g.visivel, false)
  g.mostra([0, 0, 0], 20)
  assert.equal(cena.children.length, 1)
  assert.equal(g.visivel, true)
  g.destaca({ tipo: 'anel', eixo: 'Z' })
  g.destaca(null)
  g.esconde()
  assert.equal(g.visivel, false)
  assert.equal(cena.children.length, 1)
  g.dispose()
  assert.equal(cena.children.length, 0)
  assert.ok(renders > 0)
})
