import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criaPilha, definirImpressora, definirParametro, lerDocumento, novoDocumento, textoDocumento, valida } from '../src/doc/index.ts'

test('documento novo é válido e faz round-trip', () => {
  const d = novoDocumento()
  assert.deepEqual(valida(d), [])
  assert.deepEqual(lerDocumento(textoDocumento(d)), d)
})

test('exemplo do PROJETO_BASE §5.2 é válido', () => {
  const d = { formato: '3d-modeling', versao: 1, unidade: 'mm', impressora: 'bambu-p2s',
    parametros: { L: { expr: '80' }, folga: { expr: 'calib.encaixe_deslizante' } },
    features: [{ id: 'sk1', tipo: 'sketch', entidades: [], restricoes: [] }, { id: 'ex1', tipo: 'extrude', sketch: 'sk1' }],
    marcadorHistorico: null, aparencia: { ex1: { cor: '#b8b4ac' } } }
  assert.deepEqual(valida(d), [])
})

test('validador recusa documentos ruins', () => {
  const ok = novoDocumento() as unknown as Record<string, unknown>
  const casos: [string, unknown, RegExp][] = [
    ['não objeto', 5, /objeto/],
    ['formato', { ...ok, formato: 'x' }, /formato/],
    ['versão futura', { ...ok, versao: 2 }, /versão/],
    ['unidade', { ...ok, unidade: 'in' }, /unidade/],
    ['impressora vazia', { ...ok, impressora: '' }, /impressora/],
    ['parâmetro com nome inválido', { ...ok, parametros: { '1a': { expr: '1' } } }, /nome inválido/],
    ['parâmetro sem expr', { ...ok, parametros: { a: { expr: 3 } } }, /expr/],
    ['feature sem tipo', { ...ok, features: [{ id: 'a' }] }, /id e tipo/],
    ['id repetido', { ...ok, features: [{ id: 'a', tipo: 't' }, { id: 'a', tipo: 't' }] }, /repetido/],
    ['marcador órfão', { ...ok, marcadorHistorico: 'zz' }, /marcador/],
    ['aparência sem cor', { ...ok, aparencia: { a: {} } }, /cor/],
  ]
  for (const [nome, doc, re] of casos) assert.match(valida(doc).join(';'), re, nome)
  assert.throws(() => lerDocumento('{'), /JSON inválido/)
  assert.throws(() => lerDocumento('{"formato":"x"}'), /formato/)
})

test('undo/redo: fazer, desfazer, refazer e ramo novo descarta o redo', () => {
  const d = novoDocumento()
  let avisos = 0
  const p = criaPilha(d, () => avisos++), L = () => d.parametros.L // função: o TS não estreita o valor entre as chamadas
  assert.ok(!p.podeDesfazer && !p.podeRefazer)
  p.executa(definirParametro('L', '80'))
  p.executa(definirParametro('L', '90'))
  assert.equal(L().expr, '90')
  p.desfaz(); assert.equal(L().expr, '80')
  p.desfaz(); assert.equal(L(), undefined)
  assert.equal(p.desfaz(), null)
  p.refaz(); p.refaz()
  assert.equal(L().expr, '90')
  assert.equal(p.refaz(), null)
  p.desfaz()
  p.executa(definirParametro('W', '50')) // ramo novo
  assert.ok(!p.podeRefazer)
  assert.equal(avisos, 8) // só as chamadas que mudam algo avisam
  p.limpa()
  assert.ok(!p.podeDesfazer)
})

test('comando de impressora desfaz; nome de parâmetro inválido lança', () => {
  const d = novoDocumento('bambu-p2s')
  const p = criaPilha(d)
  p.executa(definirImpressora('anycubic-i3-mega-s'))
  assert.equal(d.impressora, 'anycubic-i3-mega-s')
  p.desfaz()
  assert.equal(d.impressora, 'bambu-p2s')
  assert.throws(() => definirParametro('2x', '1'), /inválido/)
})
