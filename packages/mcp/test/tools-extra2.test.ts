import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { definirParametro } from '@3dm/core/doc'
import { adicionaFeature } from '@3dm/core/features'
import { bbox, volume } from '@3dm/core/malha'
import { criaSessao } from '../src/headless.ts'
import { regenera } from '../src/modelo.ts'
import type { Sessao } from '../src/sessao.ts'
import type { Tool } from '../src/tool.ts'
import { toolsExtra2 } from '../src/tools-extra2.ts'
import { toolsModelo } from '../src/tools-modelo.ts'
import { tools } from '../src/tools.ts'

const pasta = () => mkdtempSync(path.join(os.tmpdir(), 'extra2-'))

/** Sessão com a caixa cx1 de 10×20×30 no projeto. */
function caixa(): Sessao {
  const s = criaSessao(pasta())
  s.novo()
  s.executa(adicionaFeature({ id: 'cx1', tipo: 'caixa', pos: [0, 0, 0], dim: [10, 20, 30] }))
  return s
}

// async: um throw síncrono da tool vira rejeição, que o assert.rejects captura.
const chama = async (lista: Tool[], nome: string, s: Sessao, args: Record<string, unknown> = {}): Promise<any> =>
  lista.find(t => t.nome === nome)!.executa(s, args)
const extra = (nome: string, s: Sessao, args: Record<string, unknown> = {}) => chama(toolsExtra2, nome, s, args)
const modelo = (nome: string, s: Sessao, args: Record<string, unknown> = {}) => chama(toolsModelo, nome, s, args)

test('transformar mover [10,0,0] desloca o corpo em x', async () => {
  const s = caixa()
  assert.equal(bbox(regenera(s).corpos.get('cx1')!).min[0], 0)
  const r = await extra('transformar', s, { alvo: 'cx1', mover: [10, 0, 0] })
  assert.equal(r.ok, true)
  assert.equal(bbox(regenera(s).corpos.get('cx1')!).min[0], 10)
})

test('transformar sem mover, girar nem escala lança', async () => {
  await assert.rejects(extra('transformar', caixa(), { alvo: 'cx1' }), /mover, girar ou escala/)
})

test('transformar com copiar:true gera um segundo corpo copia1', async () => {
  const s = caixa()
  const r = await extra('transformar', s, { alvo: 'cx1', mover: [50, 0, 0], copiar: true })
  assert.equal(r.copia, 'copia1')
  assert.equal(regenera(s).corpos.size, 2)
  assert.ok(regenera(s).corpos.has('copia1'))
})

test('corte manter acima de caixa 10x20x30 em z=10 deixa volume 4000', async () => {
  const s = caixa()
  await extra('corte', s, { alvo: 'cx1', plano: { origem: [0, 0, 10], normal: [0, 0, 1], eixoX: [1, 0, 0] }, manter: 'acima' })
  const r = regenera(s)
  assert.equal(r.corpos.size, 1)
  assert.ok(Math.abs(volume(r.corpos.get('cx1')!) - 4000) < 0.01)
})

test('corte manter ambos gera 2 corpos', async () => {
  const s = caixa()
  await extra('corte', s, { alvo: 'cx1', plano: { origem: [0, 0, 10], normal: [0, 0, 1], eixoX: [1, 0, 0] }, manter: 'ambos' })
  assert.equal(regenera(s).corpos.size, 2)
})

test('cor_definir grava aparencia, desfaz restaura e corpo inexistente lança', async () => {
  const s = caixa()
  const r = await extra('cor_definir', s, { corpo: 'cx1', cor: '#ff0000', slot: 2 })
  assert.deepEqual(s.doc.aparencia.cx1, { cor: '#ff0000', slot: 2 })
  assert.equal(r.slot, 2)
  assert.equal((await extra('cor_definir', s, { corpo: 'cx1', cor: '#00ff00' })).slot, 1)
  s.desfaz()
  assert.deepEqual(s.doc.aparencia.cx1, { cor: '#ff0000', slot: 2 })
  s.desfaz()
  assert.equal(s.doc.aparencia.cx1, undefined)
  await assert.rejects(extra('cor_definir', s, { corpo: 'nope', cor: '#ff0000' }), /corpo desconhecido: nope.*cx1/)
})

test('parametros_expostos define, lista com valor, valida e remove', async () => {
  const s = caixa()
  s.executa(definirParametro('H', '40'))
  const r = await extra('parametros_expostos', s, { definir: [{ parametro: 'H', rotulo: 'Altura', tipo: 'numero', min: 10, max: 100 }] })
  assert.equal(r.expostos.length, 1)
  assert.equal(r.expostos[0].valor, 40)
  assert.equal(r.expostos[0].expr, '40')
  await assert.rejects(extra('parametros_expostos', s, { definir: [{ parametro: 'X', rotulo: 'x', tipo: 'numero' }] }), /parâmetro desconhecido: X/)
  await assert.rejects(extra('parametros_expostos', s, { definir: [{ parametro: 'H', rotulo: 'h', tipo: 'numero', min: 5, max: 1 }] }), /min \(5\) maior que max \(1\)/)
  await assert.rejects(extra('parametros_expostos', s, { definir: [{ parametro: 'H', rotulo: 'h', tipo: 'lista' }] }), /precisa de opcoes/)
  assert.equal((await extra('parametros_expostos', s, { remover: ['H'] })).expostos.length, 0)
  assert.equal((await extra('parametros_expostos', s)).expostos.length, 0)
})

test('projeto_novo com nome grava doc.nome', async () => {
  const s = caixa()
  const projetoNovo = tools.find(t => t.nome === 'projeto_novo')!
  const r = await projetoNovo.executa(s, { nome: 'suporte' }) as { nome: string }
  assert.equal(s.doc.nome, 'suporte')
  assert.equal(r.nome, 'suporte')
})

test('modelo_info usa o filamento do projeto quando não recebe um', async () => {
  const s = caixa()
  s.doc.filamento = 'petg'
  assert.equal((await modelo('modelo_info', s)).filamento, 'petg')
})

test('exportar com valores {H:50} muda o arquivo e não altera o projeto', async () => {
  const s = caixa()
  s.executa(definirParametro('H', '30'))
  s.executa(adicionaFeature({ id: 'cx2', tipo: 'caixa', pos: [0, 0, 0], dim: [10, 20, 'H'] }))
  const base = await modelo('exportar', s, { formato: '3mf', caminho: 'base.3mf' })
  const alt = await modelo('exportar', s, { formato: '3mf', caminho: 'alt.3mf', valores: { H: 50 } })
  assert.notDeepEqual(readFileSync(alt.arquivos[0].caminho), readFileSync(base.arquivos[0].caminho))
  assert.equal(s.doc.parametros.H.expr, '30')
  await assert.rejects(modelo('exportar', s, { formato: 'stl', valores: { Z: 1 } }), /parâmetro desconhecido: Z/)
})

test('slot 2 de um corpo muda o 3MF exportado', async () => {
  const s = caixa()
  const antes = await modelo('exportar', s, { formato: '3mf', caminho: 'slot1.3mf' })
  await extra('cor_definir', s, { corpo: 'cx1', cor: '#d9b36c', slot: 2 })
  const depois = await modelo('exportar', s, { formato: '3mf', caminho: 'slot2.3mf' })
  assert.notDeepEqual(readFileSync(depois.arquivos[0].caminho), readFileSync(antes.arquivos[0].caminho))
})
