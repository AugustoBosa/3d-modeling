import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { definirParametro } from '@3dm/core/doc'
import { criaSessao } from '../src/headless.ts'

const pasta = () => mkdtempSync(path.join(os.tmpdir(), 'headless-'))

test('executa, desfaz e refaz mudam os parâmetros do documento', () => {
  const s = criaSessao(pasta())
  s.novo()
  s.executa(definirParametro('a', '1'))
  assert.equal(s.doc.parametros.a?.expr, '1')
  assert.equal(s.desfaz(), 'PARAM a')
  assert.equal('a' in s.doc.parametros, false)
  assert.equal(s.refaz(), 'PARAM a')
  assert.equal(s.doc.parametros.a?.expr, '1')
})

test('salvar grava e abrir em outra sessão devolve o mesmo documento', () => {
  const dir = pasta()
  const s1 = criaSessao(dir)
  s1.executa(definirParametro('larg', '40'))
  const abs = s1.salvar('casa')
  assert.equal(abs, path.join(dir, 'casa.3dm.json'))
  assert.ok(readFileSync(abs, 'utf8').includes('"larg"'))
  const s2 = criaSessao(dir)
  s2.abrir('casa.3dm.json')
  assert.deepEqual(s2.doc, s1.doc)
  assert.equal(s2.podeDesfazer, false)
})

test('abrir de JSON inválido lança Error', () => {
  const dir = pasta()
  writeFileSync(path.join(dir, 'ruim.3dm.json'), '{ não é json')
  assert.throws(() => criaSessao(dir).abrir('ruim.3dm.json'), Error)
})

test('caminho que sai da pasta lança', () => {
  const s = criaSessao(pasta())
  assert.throws(() => s.salvar('../x'), /caminho fora da pasta do projeto/)
  assert.throws(() => s.abrir('../x'), /caminho fora da pasta do projeto/)
})

test('aoMudar dispara ao executar e ao trocar o documento', () => {
  const s = criaSessao(pasta())
  let vezes = 0
  s.aoMudar(() => { vezes++ })
  s.executa(definirParametro('a', '1'))
  s.novo()
  assert.equal(vezes, 2)
})
