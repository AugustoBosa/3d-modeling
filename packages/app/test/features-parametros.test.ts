import { test } from 'node:test'
import assert from 'node:assert/strict'
import { novoDocumento } from '@3dm/core/doc'
import { tabelaParametros } from '@3dm/core/features'
import { criaProjeto } from '../src/projeto.ts'
import { executaEdicao, formataValor } from '../src/features/parametros-ui.ts'

const valorDe = (p: ReturnType<typeof criaProjeto>, nome: string) => tabelaParametros(p.doc).find(l => l.nome === nome)

test('formataValor: até 4 casas, sem zeros à direita, erro substitui valor', () => {
  assert.equal(formataValor(80, null), '80')
  assert.equal(formataValor(33.33333, null), '33.3333')
  assert.equal(formataValor(2.5, null), '2.5')
  assert.equal(formataValor(null, 'Parâmetro inexistente'), 'Parâmetro inexistente')
  assert.equal(formataValor(null, null), '')
})

test('criar parâmetro e editar expressão', () => {
  const p = criaProjeto(novoDocumento())
  assert.deepEqual(executaEdicao(p, 'expr', 'L', '80'), { ok: true })
  assert.equal(valorDe(p, 'L')?.valor, 80)
  assert.deepEqual(executaEdicao(p, 'expr', 'L', '80/2'), { ok: true })
  assert.equal(valorDe(p, 'L')?.valor, 40)
})

test('renomear reescreve as expressões que citam o parâmetro', () => {
  const p = criaProjeto(novoDocumento())
  executaEdicao(p, 'expr', 'a', '10')
  executaEdicao(p, 'expr', 'b', 'a*2')
  assert.deepEqual(executaEdicao(p, 'nome', 'a', 'c'), { ok: true })
  assert.equal(p.doc.parametros.b.expr, 'c*2')
  assert.equal(valorDe(p, 'b')?.valor, 20)
  assert.equal(Object.hasOwn(p.doc.parametros, 'a'), false)
})

test('ciclo: ok false e documento inalterado', () => {
  const p = criaProjeto(novoDocumento())
  executaEdicao(p, 'expr', 'a', '1')
  executaEdicao(p, 'expr', 'b', 'a')
  const antes = structuredClone(p.doc)
  const r = executaEdicao(p, 'expr', 'a', 'b')
  assert.equal(r.ok, false)
  assert.match(r.ok ? '' : r.erro, /Ciclo entre parâmetros/)
  assert.deepEqual(p.doc, antes)
})

test('nome inválido: ok false e documento inalterado', () => {
  const p = criaProjeto(novoDocumento())
  executaEdicao(p, 'expr', 'a', '1')
  const antes = structuredClone(p.doc)
  const r = executaEdicao(p, 'nome', 'a', '1x')
  assert.equal(r.ok, false)
  assert.deepEqual(p.doc, antes)
  const r2 = executaEdicao(p, 'expr', '2y', '3')
  assert.equal(r2.ok, false)
  assert.deepEqual(p.doc, antes)
})

test('unidade e comentário são gravados, sem perder a expressão, e desfazer volta', () => {
  const p = criaProjeto(novoDocumento())
  executaEdicao(p, 'expr', 'a', '5')
  assert.deepEqual(executaEdicao(p, 'unidade', 'a', 'cm'), { ok: true })
  assert.deepEqual(executaEdicao(p, 'comentario', 'a', 'espessura'), { ok: true })
  assert.equal(p.doc.parametros.a.expr, '5')
  assert.equal(valorDe(p, 'a')?.unidade, 'cm')
  assert.equal(valorDe(p, 'a')?.comentario, 'espessura')
  p.desfaz()
  assert.equal(valorDe(p, 'a')?.comentario, '')
  assert.equal(valorDe(p, 'a')?.unidade, 'cm')
  p.desfaz()
  assert.equal(valorDe(p, 'a')?.unidade, 'mm')
})
