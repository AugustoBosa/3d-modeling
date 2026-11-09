import { test } from 'node:test'
import assert from 'node:assert/strict'
import { novoDocumento } from '@3dm/core/doc'
import type { Documento } from '@3dm/core/doc'
import type { EntradaMalha } from '@3dm/core/malha'
import { calculaPainel, fmtGramas } from '../src/imprimir/modelo.ts'
import { cubo, cuboAberto } from '../../core/test/malha-fixtures.ts'

const mapa = (c: Record<string, EntradaMalha>): Map<string, EntradaMalha> => new Map(Object.entries(c))
const SEM = new Set<string>()

test('cubo 20 mm em PLA na P2S: sem achados, massa 9,9 g, 4 slots', () => {
  const r = calculaPainel(novoDocumento('bambu-p2s'), mapa({ Cubo: cubo(20) }), SEM)
  assert.deepEqual(r.achados, [])
  assert.equal(fmtGramas(r.massaG), '9,9')
  assert.equal(r.filamento.id, 'pla')
  assert.equal(r.temBloqueio, false)
  assert.equal(r.slotsDisponiveis, 4)
})

test('TPU na Mega S: flexivel-bowden; 1 slot sem AMS', () => {
  const doc: Documento = { ...novoDocumento('anycubic-i3-mega-s'), filamento: 'tpu' }
  const r = calculaPainel(doc, mapa({ Cubo: cubo(20) }), SEM)
  assert.ok(r.achados.some(a => a.codigo === 'flexivel-bowden'))
  assert.equal(r.slotsDisponiveis, 1)
})

test('corpo aberto bloqueia; corpo oculto não conta', () => {
  const aberto = calculaPainel(novoDocumento('bambu-p2s'), mapa({ Aberto: cuboAberto(20) }), SEM)
  assert.equal(aberto.temBloqueio, true)

  const oculto = calculaPainel(novoDocumento('bambu-p2s'), mapa({ Cubo: cubo(20), Aberto: cuboAberto(20) }), new Set(['Aberto']))
  assert.equal(oculto.temBloqueio, false)
  assert.equal(fmtGramas(oculto.massaG), '9,9')
})

test('slot 2 na Mega S: sem-ams', () => {
  const doc: Documento = { ...novoDocumento('anycubic-i3-mega-s'), aparencia: { Cubo: { cor: '#ffffff', slot: 2 } } }
  const r = calculaPainel(doc, mapa({ Cubo: cubo(20) }), SEM)
  assert.ok(r.achados.some(a => a.codigo === 'sem-ams' && a.corpo === 'Cubo'))
})

test('fmtGramas usa uma casa decimal e vírgula', () => {
  assert.equal(fmtGramas(9.92), '9,9')
  assert.equal(fmtGramas(10), '10,0')
})
