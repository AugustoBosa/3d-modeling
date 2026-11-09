import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CrossSection, Manifold, criaLixo, malhaDe, matrizPlano, noPlano, secao, secaoDe, segmentosCirculo } from '../src/kernel/index.ts'
import { bbox, fechada, volume } from '../src/malha/index.ts'

test('cubo 10x20x30 vira malha fechada, volume 6000 e bbox correto', () => {
  const malha = malhaDe(Manifold.cube([10, 20, 30]))
  assert.equal(fechada(malha), true)
  assert.ok(Math.abs(volume(malha) - 6000) <= 0.01)
  assert.deepEqual(bbox(malha), { min: [0, 0, 0], max: [10, 20, 30] })
})

test('quadrado 20x20 com furo 10x10: área 300 e extrusão 5 com volume 1500', () => {
  const lixo = criaLixo()
  const perfil = {
    externo: [[0, 0], [20, 0], [20, 20], [0, 20]] as [number, number][],
    furos: [[[5, 5], [15, 5], [15, 15], [5, 15]] as [number, number][]],
  }
  const cs = secao(perfil, lixo)
  assert.ok(Math.abs(cs.area() - 300) <= 0.01)
  const solido = Manifold.extrude(cs, 5)
  assert.ok(Math.abs(solido.volume() - 1500) <= 0.01)
  lixo.limpa()
})

test('matrizPlano leva cubo e quadrado extrudado aos planos corretos', () => {
  const cubo = Manifold.cube([1, 1, 1])
  const b1 = bbox(malhaDe(noPlano(cubo, { origem: [1, 2, 3], normal: [0, 0, 1], eixoX: [1, 0, 0] })))
  assert.deepEqual(b1, { min: [1, 2, 3], max: [2, 3, 4] })

  const barra = Manifold.extrude(CrossSection.square(2), 5)
  const b2 = bbox(malhaDe(noPlano(barra, { origem: [0, 0, 0], normal: [1, 0, 0], eixoX: [0, 1, 0] })))
  assert.deepEqual(b2, { min: [0, 0, 0], max: [5, 2, 2] })

  assert.deepEqual(matrizPlano({ origem: [0, 0, 0], normal: [1, 0, 0], eixoX: [0, 1, 0] }), [0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1])
})

test('segmentosCirculo(10, 0.05): múltiplo de 4, ≥ 8, flecha ≤ tol', () => {
  const n = segmentosCirculo(10, 0.05)
  assert.equal(n % 4, 0)
  assert.ok(n >= 8)
  assert.ok(10 * (1 - Math.cos(Math.PI / n)) <= 0.05)
})

test('criaLixo: limpa() libera tudo e pode ser chamado duas vezes', () => {
  const lixo = criaLixo()
  for (let i = 0; i < 3; i++) lixo.add(Manifold.cube(1))
  assert.equal(lixo.tamanho, 3)
  lixo.limpa()
  assert.equal(lixo.tamanho, 0)
  assert.doesNotThrow(() => lixo.limpa())
})
