import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criaRegistro } from '../src/linha/registro.ts'
import { ATALHOS, filtra, linhasAjuda } from '../src/ajuda/dados.ts'

function reg() {
  const r = criaRegistro()
  r.registra({ nome: 'LINHA', aliases: ['L'], descricao: 'Linha', executa() {} })
  r.registra({ nome: 'DESFAZER', aliases: ['U', 'UNDO'], descricao: 'Desfaz o último comando', executa() {} })
  return r
}

test('ATALHOS cobre as teclas de função e as imediatas das §7.2 e §7.3', () => {
  const teclas = new Set(ATALHOS.map(a => a.atalho))
  for (const t of ['F1', 'F2', 'F3', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'Tab', 'G', 'R', 'S', 'Shift+A', 'Shift+D', 'H', 'Alt+H', 'Shift+H', 'V', 'I', 'T', 'E', 'B', 'D', 'Ctrl+A', 'Alt+A', 'Numpad 1', 'Numpad 3', 'Numpad 7', 'Numpad 5', 'Numpad .', 'Home', 'N', 'Del / X', 'Esc', 'Enter / Espaço', 'Ctrl+Z', 'Ctrl+Y', 'Ctrl+S', 'Ctrl+K'])
    assert.ok(teclas.has(t), `falta ${t}`)
  for (const a of ATALHOS) assert.ok(a.descricao.length > 0, `sem descrição: ${a.atalho}`)
})

test('linhasAjuda junta comandos (aliases separados por vírgula) e atalhos', () => {
  const linhas = linhasAjuda(reg())
  const cmd = linhas.find(l => l.tipo === 'comando' && l.nome === 'DESFAZER')
  assert.deepEqual(cmd, { tipo: 'comando', nome: 'DESFAZER', alias: 'U, UNDO', atalho: '', descricao: 'Desfaz o último comando' })
  assert.equal(linhas.filter(l => l.tipo === 'atalho').length, ATALHOS.length)
})

test('filtra: sem maiúsculas, alias e tecla; todas as palavras precisam casar', () => {
  const linhas = linhasAjuda(reg())
  assert.equal(filtra(linhas, '  ').length, linhas.length)
  assert.ok(filtra(linhas, 'DESFAZ').some(l => l.nome === 'DESFAZER'))
  assert.ok(filtra(linhas, 'u').some(l => l.nome === 'DESFAZER')) // alias
  assert.deepEqual(filtra(linhas, 'ctrl desfaz').map(l => l.atalho), ['Ctrl+Z'])
  assert.ok(filtra(linhas, 'ctrl z').every(l => l.atalho.startsWith('Ctrl')))
  assert.deepEqual(filtra(linhas, 'linha desfaz'), [])
  assert.equal(filtra(linhas, 'Numpad 7')[0].atalho, 'Numpad 7')
})

test('filtra: sem acento casa com texto acentuado (frente, espaço)', () => {
  const linhas = linhasAjuda(reg())
  assert.ok(filtra(linhas, 'frente').some(l => l.atalho === 'Numpad 1'))
  assert.ok(filtra(linhas, 'espaco').some(l => l.atalho === 'Enter / Espaço'))
  assert.ok(filtra(linhas, 'Espaço').some(l => l.atalho === 'Enter / Espaço'))
})
