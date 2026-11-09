import { test } from 'node:test'
import assert from 'node:assert/strict'
import { coresOverhang } from '../src/imprimir/overhang.ts'
import { cubo } from '../../core/test/malha-fixtures.ts'

const VERDE = [0x3f / 255, 0xae / 255, 0x5b / 255]
const VERMELHO = [0xd6 / 255, 0x3c / 255, 0x3c / 255]
const AMARELO = [0xf2 / 255, 0xd3 / 255, 0x2e / 255]
const LARANJA = [0xf0 / 255, 0x8a / 255, 0x24 / 255]
const perto = (a: ArrayLike<number>, b: number[]) => b.every((v, i) => Math.abs(a[i] - v) < 1e-5)
const triCor = (cor: Float32Array, t: number) => cor.subarray(t * 9, t * 9 + 9)
const repete3 = (c: number[]) => [...c, ...c, ...c]

// Pirâmide invertida fechada: base 2R x 2R em z = H (em cima), ponta em (0,0,0) (embaixo).
// Faces laterais a 60 graus da vertical; normais para fora (laterais 0..3, topo 4..5).
const H = 10
const R = H * Math.sqrt(3)
const piramide = () => ({
  vertProps: new Float32Array([R, -R, H, R, R, H, -R, R, H, -R, -R, H, 0, 0, 0]),
  triVerts: new Uint32Array([4, 1, 0, 4, 2, 1, 4, 3, 2, 4, 0, 3, 0, 1, 2, 0, 2, 3]),
})

test('caixa 10 mm com limiar 45: area 0 e todas as cores verdes', () => {
  const m = cubo(10)
  const r = coresOverhang(m.vertProps, m.triVerts, 45)
  const nTri = m.triVerts.length / 3
  assert.equal(nTri, 12)
  assert.equal(r.pos.length, 9 * nTri)
  assert.equal(r.cor.length, 9 * nTri)
  assert.equal(r.areaMm2, 0)
  for (let t = 0; t < nTri; t++) assert.ok(perto(triCor(r.cor, t), repete3(VERDE)), `triangulo ${t}`)
})

test('piramide invertida a 60 graus com limiar 45: area > 0 e laterais vermelhas', () => {
  const m = piramide()
  const r = coresOverhang(m.vertProps, m.triVerts, 45)
  assert.equal(r.pos.length, 9 * 6)
  assert.equal(r.cor.length, 9 * 6)
  const esperada = 4 * 0.5 * (2 * R) * Math.hypot(R, H)
  assert.ok(Math.abs(r.areaMm2 - esperada) < 1e-3 * esperada, `area ${r.areaMm2} != ${esperada}`)
  for (let t = 0; t < 4; t++) assert.ok(perto(triCor(r.cor, t), repete3(VERMELHO)), `lateral ${t}`)
  for (let t = 4; t < 6; t++) assert.ok(perto(triCor(r.cor, t), repete3(VERDE)), `topo ${t}`)
})

test('mesma piramide com limiar 70: area 0 e laterais em amarelo/laranja, nunca vermelho', () => {
  const m = piramide()
  const r = coresOverhang(m.vertProps, m.triVerts, 70)
  assert.equal(r.areaMm2, 0)
  // 60 graus com limiar 70: entre a parada amarela (35) e a laranja (70), fracao 25/35
  const t = 25 / 35
  const esperada = AMARELO.map((v, i) => v + (LARANJA[i] - v) * t)
  for (let i = 0; i < 4; i++) {
    assert.ok(!perto(triCor(r.cor, i), repete3(VERMELHO)), `lateral ${i} nao pode ser vermelha`)
    assert.ok(perto(triCor(r.cor, i), repete3(esperada)), `lateral ${i} fora da escala`)
  }
})
