import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Feature } from '@3dm/core/doc'
import type { StatusFeature } from '@3dm/core/regen'
import { linhasArvore, proximoMarcador } from '../src/features/arvore-modelo.ts'

const feats: Feature[] = [
  { id: 'sk', tipo: 'sketch' },
  { id: 'ext', tipo: 'extrude' },
  { id: 'furo', tipo: 'furo' },
  { id: 'caixa', tipo: 'caixa' },
  { id: 'padrao', tipo: 'padrao' },
]
const status = new Map<string, StatusFeature>([
  ['furo', { estado: 'erro', erro: { causa: 'Furo sem alvo', correcao: 'Mova o furo' } }],
  ['caixa', { estado: 'suspensa' }],
  ['padrao', { estado: 'suspensa' }],
])
const dados = { status, selecionada: null, ocultos: new Set<string>() }

test('sem marcador: todas ativas, erro com causa e correção, marcador na última', () => {
  const l = linhasArvore(feats, null, dados)
  assert.equal(l.length, 5)
  assert.deepEqual(l.map(x => x.id), ['sk', 'ext', 'furo', 'caixa', 'padrao'])
  assert.equal(l[0].estado, 'ok')
  assert.equal(l[0].icone, '✎')
  assert.equal(l[2].estado, 'erro')
  assert.equal(l[2].erro, 'Furo sem alvo Mova o furo')
  assert.equal(l[0].erro, '')
  assert.ok(l.every(x => !x.revertida))
  assert.deepEqual(l.filter(x => x.ehMarcador).map(x => x.id), ['padrao'])
})

test('marcador em furo: caixa e padrao ficam revertidas', () => {
  const l = linhasArvore(feats, 'furo', dados)
  assert.deepEqual(l.map(x => x.revertida), [false, false, false, true, true])
  assert.deepEqual(l.filter(x => x.ehMarcador).map(x => x.id), ['furo'])
  assert.equal(l[3].estado, 'suspensa')
})

test('ocultos e selecionada', () => {
  const l = linhasArvore(feats, 'padrao', { ...dados, selecionada: 'furo', ocultos: new Set(['caixa']) })
  assert.deepEqual(l.filter(x => x.oculta).map(x => x.id), ['caixa'])
  assert.deepEqual(l.filter(x => x.selecionada).map(x => x.id), ['furo'])
})

test('proximoMarcador nos limites', () => {
  assert.equal(proximoMarcador(feats, null, 1), null)
  assert.equal(proximoMarcador(feats, null, -1), 'caixa')
  assert.equal(proximoMarcador(feats, 'sk', -1), 'sk')
  assert.equal(proximoMarcador(feats, 'sk', 1), 'ext')
  assert.equal(proximoMarcador(feats, 'furo', 1), 'caixa')
  assert.equal(proximoMarcador(feats, 'padrao', 1), null)
  assert.equal(proximoMarcador([], null, -1), null)
})
