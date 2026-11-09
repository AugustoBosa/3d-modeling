import { test } from 'node:test'
import assert from 'node:assert/strict'
import { novoDocumento } from '@3dm/core/doc'
import type { Documento } from '@3dm/core/doc'
import type { EntradaMalha } from '@3dm/core/malha'
import type { ArquivoExport } from '@3dm/core/export'
import { criaExportador, type DepsExportador } from '../src/imprimir/exportar.ts'
import { cuboAberto, doisCorpos } from '../../core/test/malha-fixtures.ts'

const doc = (): Documento => ({ ...novoDocumento('bambu-p2s'), nome: 'T' })
const mapa = (): Map<string, EntradaMalha> => new Map(doisCorpos().map((c) => [c.nome, c.malha]))

function falsas(over: Partial<DepsExportador> = {}) {
  const log = { entregas: [] as ArquivoExport[], cancelou: 0 }
  const d: DepsExportador = {
    doc,
    corposFinos: async () => mapa(),
    ocultos: () => new Set(),
    miniatura: async () => undefined,
    cancelaGeracao: () => { log.cancelou++ },
    entrega: (a) => { log.entregas.push(a) },
    ...over,
  }
  return { ex: criaExportador(d), log }
}

test('3mf: um arquivo, hash sha-256, entrega uma vez', async () => {
  const { ex, log } = falsas()
  const r = await ex.exporta('3mf')
  assert.equal(r.arquivos.length, 1)
  assert.ok(r.arquivos[0]!.nome.endsWith('.3mf'))
  assert.match(r.arquivos[0]!.hash, /^[0-9a-f]{64}$/)
  assert.match(r.hashTotal, /^[0-9a-f]{64}$/)
  assert.equal(log.entregas.length, 1)
  assert.equal(r.erro, undefined)
})

test('mesma entrada duas vezes gera o mesmo hashTotal', async () => {
  const { ex } = falsas()
  const a = await ex.exporta('3mf', { semDownload: true })
  const b = await ex.exporta('3mf', { semDownload: true })
  assert.equal(a.hashTotal, b.hashTotal)
})

test('semDownload não chama entrega', async () => {
  const { ex, log } = falsas()
  const r = await ex.exporta('3mf', { semDownload: true })
  assert.equal(r.arquivos.length, 1)
  assert.equal(log.entregas.length, 0)
})

test('corpo aberto bloqueia; ignoraBloqueio gera', async () => {
  const aberto = () => new Map<string, EntradaMalha>([['Aberto', cuboAberto(20)]])
  const { ex, log } = falsas({ corposFinos: async () => aberto() })
  const r = await ex.exporta('3mf')
  assert.equal(r.bloqueado, true)
  assert.equal(r.arquivos.length, 0)
  assert.equal(log.entregas.length, 0)

  const g = await ex.exporta('3mf', { ignoraBloqueio: true })
  assert.equal(g.arquivos.length, 1)
  assert.equal(log.entregas.length, 1)
})

test('corposFinos null → cancelado', async () => {
  const { ex, log } = falsas({ corposFinos: async () => null })
  const r = await ex.exporta('3mf')
  assert.equal(r.cancelado, true)
  assert.equal(r.arquivos.length, 0)
  assert.equal(log.entregas.length, 0)
})

test('corposFinos que lança → erro, não propaga', async () => {
  const { ex } = falsas({ corposFinos: async () => { throw new Error('falhou') } })
  const r = await ex.exporta('3mf')
  assert.equal(r.erro, 'falhou')
  assert.equal(r.arquivos.length, 0)
})

test('miniatura que rejeita → miniaturaFalhou e arquivo gerado', async () => {
  const { ex } = falsas({ miniatura: () => Promise.reject(new Error('sem canvas')) })
  const r = await ex.exporta('3mf')
  assert.equal(r.miniaturaFalhou, true)
  assert.equal(r.arquivos.length, 1)
})

test('emAndamento true durante a chamada e false depois', async () => {
  const { ex } = falsas({ corposFinos: () => new Promise((res) => setTimeout(() => res(mapa()), 5)) })
  const p = ex.exporta('stl', { semDownload: true })
  assert.equal(ex.emAndamento(), true)
  await p
  assert.equal(ex.emAndamento(), false)
  assert.equal(ex.ultimo()?.formato, 'stl')
})
