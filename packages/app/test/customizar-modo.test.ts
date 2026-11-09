import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ErroOpcoes, parseOpcoes } from '../src/customizar/modo.ts'

test('parseOpcoes lê rotulo=valor, ignora linhas vazias e aceita espaços e vírgula decimal', () => {
  assert.deepEqual(parseOpcoes('Pequena = 20\n\n  Media=30 \r\nGrande= 40,5'), [
    { rotulo: 'Pequena', valor: 20 },
    { rotulo: 'Media', valor: 30 },
    { rotulo: 'Grande', valor: 40.5 },
  ])
})

test('linha sem = gera erro com código sem-igual e número da linha', () => {
  assert.throws(() => parseOpcoes('ok=1\nsem igual'), (e: unknown) => e instanceof ErroOpcoes && e.codigo === 'sem-igual' && e.linha === 2)
})

test('valor não numérico gera erro com código valor-invalido', () => {
  assert.throws(() => parseOpcoes('a=1\nb=abc'), (e: unknown) => e instanceof ErroOpcoes && e.codigo === 'valor-invalido' && e.linha === 2)
  assert.throws(() => parseOpcoes('a='), (e: unknown) => e instanceof ErroOpcoes && e.codigo === 'valor-invalido' && e.linha === 1)
})

test('texto sem opções gera erro com código vazio', () => {
  assert.throws(() => parseOpcoes('  \n '), (e: unknown) => e instanceof ErroOpcoes && e.codigo === 'vazio')
})
