import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { EntSk, InfoSketch, RestSk, SketchFeature } from '@3dm/core/sketch'
import { corDaEntidade, polilinhaDe } from '../src/sketch/desenho.ts'

const info = (estado: InfoSketch['estado'], culpadas: string[] = []): InfoSketch => ({ estado, dof: 0, residuo: 0, erros: [], culpadas })
const sk = (entidades: EntSk[], restricoes: RestSk[] = []) =>
  ({ id: 's1', tipo: 'sketch', plano: { base: 'XY', offset: 0 }, entidades, restricoes }) as unknown as SketchFeature
const vazio = new Set<string>()
const cota: RestSk = { id: 'r1', tipo: 'distancia', e: ['l1', 'l2'], expr: '10' }

test('corDaEntidade: seleção > hover > conflito > definido > livre', () => {
  const s = sk([], [cota])
  assert.equal(corDaEntidade(s, 'l1', info('conflito', ['r1']), new Set(['l1']), 'l1'), 'selecao')
  assert.equal(corDaEntidade(s, 'l1', info('conflito', ['r1']), vazio, 'l1'), 'hover')
  assert.equal(corDaEntidade(s, 'l1', info('conflito', ['r1']), vazio, null), 'conflito')
  assert.equal(corDaEntidade(s, 'l3', info('conflito', ['r1']), vazio, null), 'livre')
  assert.equal(corDaEntidade(s, 'l1', info('definido'), vazio, null), 'definido')
  assert.equal(corDaEntidade(s, 'l1', info('subdefinido'), vazio, null), 'livre')
})

test('polilinhaDe: linha, ponto, círculo fechado e arco', () => {
  const pts = (id: string, x: number, y: number): EntSk => ({ id, tipo: 'ponto', x, y })
  const s = sk([pts('p0', 0, 0), pts('p1', 10, 0), pts('p2', 0, 10), pts('p3', 3, 4),
    { id: 'l1', tipo: 'linha', a: 'p0', b: 'p1' },
    { id: 'c1', tipo: 'circulo', c: 'p0', r: 5 },
    { id: 'a1', tipo: 'arco', c: 'p0', a: 'p1', b: 'p2' }])
  const ent = (id: string) => s.entidades.find(e => e.id === id)!

  assert.deepEqual(polilinhaDe(s, ent('l1')), [{ x: 0, y: 0 }, { x: 10, y: 0 }])
  assert.deepEqual(polilinhaDe(s, ent('p3')), [{ x: 3, y: 4 }])

  const c = polilinhaDe(s, ent('c1'))
  assert.ok(c.length >= 12)
  assert.deepEqual(c.at(-1), c[0]) // fechado
  assert.ok(c.every(p => Math.abs(Math.hypot(p.x, p.y) - 5) < 1e-9))

  const a = polilinhaDe(s, ent('a1'))
  assert.deepEqual(a[0], { x: 10, y: 0 })
  assert.deepEqual(a.at(-1), { x: 0, y: 10 })
  assert.ok(a.every(p => Math.abs(Math.hypot(p.x, p.y) - 10) < 1e-9))
})
