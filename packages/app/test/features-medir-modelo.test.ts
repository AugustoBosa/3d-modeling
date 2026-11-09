import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { CorpoInfo, V3 } from '../src/features/contrato.ts'
import { criaMedicao, snapar } from '../src/features/medir-modelo.ts'

// caixa 10 x 20 x 30 mm com canto mínimo na origem; 8 vértices, 12 triângulos (faces para fora)
// triângulos: 0-1 base, 2-3 topo, 4-5 frente, 6-7 fundo, 8-9 esquerda, 10-11 direita
const POS = new Float32Array([0, 0, 0, 10, 0, 0, 10, 20, 0, 0, 20, 0, 0, 0, 30, 10, 0, 30, 10, 20, 30, 0, 20, 30])
const IDX = new Uint32Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 2, 3, 7, 2, 7, 6, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5])
const caixa: CorpoInfo = { id: 'c1', pos: POS, idx: IDX, bbox: { min: [0, 0, 0], max: [10, 20, 30] }, volume: 6000, fechada: true, tri: 12 }

const TOL = 0.01
const perto = (a: number, b: number, tol = TOL): void => assert.ok(Math.abs(a - b) <= tol, `${a} não está perto de ${b}`)
const pertoV = (a: V3, b: V3): void => a.forEach((x, i) => perto(x, b[i]))

test('snap: perto de um canto vira vértice exato', () => {
  const s = snapar(caixa, [0.2, 0.1, 0.3], 1)
  assert.ok(s)
  assert.equal(s.tipo, 'vertice')
  assert.deepEqual(s.p, [0, 0, 0])
})

test('snap: perto do meio de uma aresta viva vira aresta sobre a aresta', () => {
  const s = snapar(caixa, [5, 0.5, 0], 1)
  assert.ok(s)
  assert.equal(s.tipo, 'aresta')
  pertoV(s.p, [5, 0, 0])
})

test('snap: no centro da face de topo vira centro da face (5,10,30)', () => {
  const s = snapar(caixa, [5, 10, 30], 3)
  assert.ok(s)
  assert.equal(s.tipo, 'centro')
  pertoV(s.p, [5, 10, 30])
})

test('snap: longe da malha devolve null', () => {
  assert.equal(snapar(caixa, [50, 50, 50], 1), null)
})

test('distância entre (0,0,0) e (3,4,12) = 13 com texto em pt-BR', () => {
  const m = criaMedicao()
  m.inicia('distancia')
  assert.equal(m.ponto([0, 0, 0]), null)
  const r = m.ponto([3, 4, 12])
  assert.ok(r)
  perto(r.valor, 13)
  assert.ok(r.texto.startsWith('Distância 13,00 mm'), r.texto)
  assert.equal(r.unidade, 'mm')
})

test('ângulo (1,0,0)-(0,0,0)-(0,1,0) = 90 graus; vértice é o 2º clicado', () => {
  const m = criaMedicao()
  m.inicia('angulo')
  m.ponto([1, 0, 0])
  m.ponto([0, 0, 0])
  const r = m.ponto([0, 1, 0])
  assert.ok(r)
  perto(r.valor, 90)
  assert.equal(r.texto, 'Ângulo 90,00°')
})

test('raio com 3 pontos de um círculo r = 12,345 (e um 4º ponto refaz o ajuste)', () => {
  const R = 12.345
  const p = (graus: number): V3 => [1 + R * Math.cos(graus * Math.PI / 180), 2 + R * Math.sin(graus * Math.PI / 180), 3]
  const m = criaMedicao()
  m.inicia('raio')
  assert.equal(m.ponto(p(0)), null)
  assert.equal(m.ponto(p(120)), null)
  const r3 = m.ponto(p(240))
  assert.ok(r3)
  perto(r3.valor, R)
  const r4 = m.ponto(p(60))
  assert.ok(r4)
  perto(r4.valor, R)
  m.encerra()
  assert.equal(m.resultados.length, 1)
})

test('área: face de topo = 200 e lateral = 600', () => {
  const m = criaMedicao()
  m.inicia('area')
  const topo = m.face(caixa, 2)
  assert.ok(topo)
  perto(topo.valor, 200)
  const lateral = m.face(caixa, 8)
  assert.ok(lateral)
  perto(lateral.valor, 600)
  assert.equal(m.resultados.length, 2)
})

test('volume: corpo usa c.volume = 6000', () => {
  const m = criaMedicao()
  m.inicia('volume')
  const r = m.corpo(caixa)
  assert.ok(r)
  perto(r.valor, 6000)
  assert.equal(r.texto, 'Volume 6000,00 mm³')
})

test('prompt acompanha os pontos pendentes', () => {
  const m = criaMedicao()
  m.inicia('distancia')
  assert.equal(m.prompt, 'Clique o primeiro ponto')
  m.ponto([0, 0, 0])
  assert.equal(m.prompt, 'Clique o segundo ponto')
  assert.equal(m.pendentes.length, 1)
})

test('resultados acumulam e limpa() zera', () => {
  const m = criaMedicao()
  m.inicia('distancia')
  m.ponto([0, 0, 0])
  m.ponto([1, 0, 0])
  m.ponto([0, 0, 0])
  m.ponto([0, 2, 0])
  assert.equal(m.resultados.length, 2)
  m.limpa()
  assert.equal(m.resultados.length, 0)
  assert.equal(m.modo, null)
})
