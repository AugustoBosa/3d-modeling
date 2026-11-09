import { test } from 'node:test'
import assert from 'node:assert/strict'
import { novoDocumento } from '@3dm/core/doc'
import { entradaDe } from '@3dm/core/features'
import { ESQUEMAS, normalizaNum, novaFeature, planoDe, planoParaCampo, toFeature, valida } from '../src/features/esquemas.ts'

const ctx = { corpos: ['c0'], sketches: ['sk'] }
const base = [{ id: 'c0', tipo: 'caixa', pos: [0, 0, 0], dim: [10, 10, 10] }, { id: 'sk', tipo: 'sketch' }]

test('novaFeature de cada tipo passa por entradaDe sem virar invalida', () => {
  for (const tipo of Object.keys(ESQUEMAS)) {
    const doc = { ...novoDocumento(), features: [...base, novaFeature(tipo, 'f1', ctx)] }
    const item = entradaDe(doc).features[2] as { tipo: string; causa?: string }
    assert.notEqual(item.tipo, 'invalida', `${tipo}: ${item.causa ?? ''}`)
  }
})

test('planoDe e planoParaCampo fazem a volta', () => {
  for (const b of ['XY', 'XZ', 'YZ'] as const) {
    for (const o of ['0', '5', 'L/2']) assert.deepEqual(planoParaCampo(planoDe(b, o)), { base: b, offset: o })
  }
})

test('normalizaNum: vazio, número e expressão', () => {
  assert.equal(normalizaNum(''), '')
  assert.equal(normalizaNum(' 12.5 '), 12.5)
  assert.equal(normalizaNum('L/2'), 'L/2')
})

test('valida acusa distância vazia e não acusa o padrão', () => {
  const vazia = valida({ id: 'e', tipo: 'extrude', sketch: 'sk', distancia: '', modo: 'normal', operacao: 'nova', bordaModo: 'nenhuma' })
  assert.equal(vazia.length, 1)
  assert.match(vazia[0], /distância/)
  assert.deepEqual(valida({ id: 'e', tipo: 'extrude', sketch: 'sk', distancia: 5, modo: 'normal', operacao: 'nova', bordaModo: 'nenhuma' }), [])
})

test('toFeature monta a borda a partir dos campos planos', () => {
  const f = toFeature({ id: 'e', tipo: 'extrude', sketch: 'sk', distancia: 5, modo: 'normal', operacao: 'nova', bordaModo: 'fillet', bordaTamanho: 1, bordaOnde: 'topo' })
  assert.deepEqual(f.borda, { modo: 'fillet', tamanho: 1, onde: 'topo' })
  assert.equal('bordaModo' in f, false)
})
