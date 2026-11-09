import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nomeArquivo } from '../src/export/nome.ts'

test('nome com acentos, espaços e caracteres especiais', () => {
  assert.equal(nomeArquivo('Caixa com Tampa', 'Tampa Ç', 'bambu-p2s'), 'caixa-com-tampa-tampa-c-bambu-p2s.3mf')
})

test('parte vazia vira sem-nome', () => {
  assert.equal(nomeArquivo('', 'Corpo', 'bambu-p2s'), 'sem-nome-corpo-bambu-p2s.3mf')
  assert.equal(nomeArquivo('Caixa', '  !! ', 'bambu-p2s'), 'caixa-sem-nome-bambu-p2s.3mf')
})

test('extensão configurável', () => {
  assert.equal(nomeArquivo('Caixa', 'Base', 'bambu-p2s', 'stl'), 'caixa-base-bambu-p2s.stl')
})
