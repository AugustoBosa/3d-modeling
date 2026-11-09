import { test } from 'node:test'
import assert from 'node:assert/strict'
import { massaGramas, avisosFilamento } from '../src/imprimir/filamento.ts'
import { cubo, cuboInvertido } from './malha-fixtures.ts'
import { impressoraPorId } from '../printers/index.ts'
import { filamentoPorId } from '../filaments/index.ts'

const mega = impressoraPorId('anycubic-i3-mega-s')!
const p2s = impressoraPorId('bambu-p2s')!
const pla = filamentoPorId('pla')!
const tpu = filamentoPorId('tpu')!
const absAsa = filamentoPorId('abs-asa')!
const codigos = (o: Parameters<typeof avisosFilamento>[0]) => avisosFilamento(o).map(a => a.codigo)

test('massa do cubo de 20 mm em PLA e TPU', () => {
  assert.ok(Math.abs(massaGramas(cubo(20), pla) - 9.92) < 1e-9)
  assert.ok(Math.abs(massaGramas(cubo(20), tpu) - 9.68) < 1e-9)
})

test('massa usa volume absoluto (cubo invertido dá o mesmo valor)', () => {
  assert.ok(Math.abs(massaGramas(cuboInvertido(20), pla) - 9.92) < 1e-9)
})

test('PLA não gera avisos na Mega S nem na P2S', () => {
  assert.deepEqual(codigos({ impressora: mega, filamento: pla }), [])
  assert.deepEqual(codigos({ impressora: p2s, filamento: pla }), [])
})

test('TPU na Mega S gera flexivel-bowden', () => {
  assert.deepEqual(codigos({ impressora: mega, filamento: tpu }), ['flexivel-bowden'])
})

test('TPU na P2S não gera avisos', () => {
  assert.deepEqual(codigos({ impressora: p2s, filamento: tpu }), [])
})

test('ABS/ASA na Mega S gera camara-aberta e não compat-aviso', () => {
  const c = codigos({ impressora: mega, filamento: absAsa })
  assert.ok(c.includes('camara-aberta'))
  assert.ok(!c.includes('compat-aviso'))
  assert.ok(c.includes('encolhimento'))
})

test('ABS/ASA na P2S gera só encolhimento', () => {
  assert.deepEqual(codigos({ impressora: p2s, filamento: absAsa }), ['encolhimento'])
})

test('corpo no slot 2 na Mega S gera sem-ams com o corpo certo', () => {
  const achados = avisosFilamento({ impressora: mega, filamento: pla, corpos: [{ nome: 'Tampa', slot: 2 }] })
  assert.equal(achados.length, 1)
  assert.equal(achados[0].codigo, 'sem-ams')
  assert.equal(achados[0].corpo, 'Tampa')
})

test('corpo no slot 2 na P2S não gera nada', () => {
  assert.deepEqual(avisosFilamento({ impressora: p2s, filamento: pla, corpos: [{ nome: 'Tampa', slot: 2 }] }), [])
})

test('todas as mensagens são textos não vazios', () => {
  const todos = [
    ...avisosFilamento({ impressora: mega, filamento: absAsa, corpos: [{ nome: 'Tampa', slot: 2 }] }),
    ...avisosFilamento({ impressora: mega, filamento: tpu }),
  ]
  assert.ok(todos.length > 0)
  for (const a of todos) {
    assert.equal(typeof a.mensagem, 'string')
    assert.ok(a.mensagem.length > 0)
  }
})
