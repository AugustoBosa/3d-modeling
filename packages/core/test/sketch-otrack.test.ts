import { test } from 'node:test'
import assert from 'node:assert/strict'
import { adquire, aplicaOtrack } from '../src/sketch/otrack.ts'
import type { EntSk, Pt, SketchFeature } from '../src/sketch/tipos.ts'

const P = (x: number, y: number): Pt => ({ x, y })
const sk = (...entidades: EntSk[]): SketchFeature => ({ id: 'sk1', tipo: 'sketch', plano: { base: 'XY', offset: 0 }, entidades, restricoes: [] })
const pt = (id: string, x: number, y: number): EntSk => ({ id, tipo: 'ponto', x, y })
const linha = (id: string, a: string, b: string): EntSk => ({ id, tipo: 'linha', a, b })
const TOL = 1
type Adq = { p: Pt; ref: string }[]

test('adquire: cursor perto de extremidade guarda o ponto com ref = id', () => {
  assert.deepEqual(adquire(sk(pt('p1', 10, 10)), P(10.4, 10.2), TOL, []), [{ p: P(10, 10), ref: 'p1' }])
})

test('adquire: longe de qualquer ponto não muda a lista', () => {
  assert.deepEqual(adquire(sk(pt('p1', 10, 10)), P(30, 30), TOL, []), [])
})

test('adquire: ponto médio de linha conta como adquirido', () => {
  const r = adquire(sk(pt('p1', 0, 0), pt('p2', 10, 0), linha('l1', 'p1', 'p2')), P(5.2, 0.1), TOL, [])
  assert.deepEqual(r, [{ p: P(5, 0), ref: 'l1' }])
})

test('adquire: mesmo ponto não entra duas vezes', () => {
  const s = sk(pt('p1', 10, 10))
  const r = adquire(s, P(10.2, 10), TOL, adquire(s, P(10, 10.2), TOL, []))
  assert.equal(r.length, 1)
})

test('adquire: no máximo 5, descarta o mais antigo', () => {
  const s = sk(...[0, 1, 2, 3, 4, 5].map(i => pt('p' + i, i * 20, 0)))
  let a: Adq = []
  for (let i = 0; i < 6; i++) a = adquire(s, P(i * 20 + 0.2, 0.2), TOL, a)
  assert.equal(a.length, 5)
  assert.equal(a[0].ref, 'p1')
  assert.equal(a[4].ref, 'p5')
})

const adq: Adq = [{ p: P(10, 10), ref: 'p1' }]

test('aplicaOtrack: guia horizontal ajusta y ao ponto adquirido', () => {
  const r = aplicaOtrack(P(30, 10.5), adq, TOL)
  assert.deepEqual(r?.p, P(30, 10))
  assert.deepEqual(r?.guias.map(g => g.dir), ['H'])
})

test('aplicaOtrack: guia vertical ajusta x ao ponto adquirido', () => {
  const r = aplicaOtrack(P(10.4, 40), adq, TOL)
  assert.deepEqual(r?.p, P(10, 40))
  assert.deepEqual(r?.guias.map(g => g.dir), ['V'])
})

test('aplicaOtrack: perto de guia H e V devolve a interseção', () => {
  const r = aplicaOtrack(P(10.3, 10.6), adq, TOL)
  assert.deepEqual(r?.p, P(10, 10))
  assert.deepEqual(r?.guias.map(g => g.dir), ['H', 'V'])
})

test('aplicaOtrack: sem guia devolve null', () => {
  assert.equal(aplicaOtrack(P(30, 30), adq, TOL), null)
  assert.equal(aplicaOtrack(P(30, 30), [], TOL), null)
})

test('aplicaOtrack: respeita a tolerância', () => {
  assert.equal(aplicaOtrack(P(30, 11.5), adq, 1), null)
  assert.deepEqual(aplicaOtrack(P(30, 11.5), adq, 2)?.p, P(30, 10))
})
