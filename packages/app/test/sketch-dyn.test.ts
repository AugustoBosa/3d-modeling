import { test } from 'node:test'
import assert from 'node:assert/strict'
import { medidasDyn, textoDyn } from '../src/sketch/dyn.ts'

test('medidasDyn: comprimento e ângulo anti-horário a partir de +X, 1 casa', () => {
  assert.deepEqual(medidasDyn({ x: 0, y: 0 }, { x: 3, y: 4 }), { comprimento: 5, angulo: 53.1 })
  assert.deepEqual(medidasDyn({ x: 0, y: 0 }, { x: 10, y: 0 }), { comprimento: 10, angulo: 0 })
  assert.deepEqual(medidasDyn({ x: 0, y: 0 }, { x: 1, y: -1 }), { comprimento: 1.4, angulo: 315 })
})

test('textoDyn: ambos -> polar; só comprimento -> distância; só ângulo -> null', () => {
  assert.equal(textoDyn('10', '45'), '@10<45')
  assert.equal(textoDyn('10', ''), '10')
  assert.equal(textoDyn('', '45'), null)
  assert.equal(textoDyn(' L/2 ', ' 30 '), '@L/2<30')
  assert.equal(textoDyn('', ''), null)
})
