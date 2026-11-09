import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ordenaRecentes } from '../src/arquivos.ts'

const item = (id: string, nome: string, em: number) => ({ id, nome, em })

test('recentes: mais recente primeiro', () => {
  const r = ordenaRecentes([item('1', 'a', 10), item('2', 'b', 30), item('3', 'c', 20)])
  assert.deepEqual(r.map(x => x.id), ['2', '3', '1'])
})

test('recentes: um item por nome, mantendo o mais novo', () => {
  const r = ordenaRecentes([item('1', 'caixa', 10), item('2', 'tampa', 20), item('3', 'caixa', 40), item('4', 'caixa', 30)])
  assert.deepEqual(r, [item('3', 'caixa', 40), item('2', 'tampa', 20)])
})

test('recentes: corta em 8 por padrão e respeita max', () => {
  const muitos = Array.from({ length: 10 }, (_, i) => item(String(i), `n${i}`, i))
  assert.equal(ordenaRecentes(muitos).length, 8)
  assert.equal(ordenaRecentes(muitos)[0].id, '9')
  assert.deepEqual(ordenaRecentes(muitos, 3).map(x => x.id), ['9', '8', '7'])
  assert.deepEqual(ordenaRecentes([]), [])
})
