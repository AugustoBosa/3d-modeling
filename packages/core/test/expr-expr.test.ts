import { test } from 'node:test'
import assert from 'node:assert/strict'
import { achaCiclo, avalia, dependencias, type Parametros } from '../src/expr/index.ts'

const p: Parametros = {
  L: { expr: '80' },
  parede: { expr: '2' },
  W: { expr: 'L/2+parede' },
}

test('aritmética e precedência', () => {
  assert.deepEqual(avalia('2+3*4'), { ok: true, valor: 14 })
  assert.deepEqual(avalia('(2+3)*4'), { ok: true, valor: 20 })
  assert.deepEqual(avalia('10 - 4 - 3'), { ok: true, valor: 3 })
  assert.deepEqual(avalia('25.4*2'), { ok: true, valor: 50.8 })
  assert.deepEqual(avalia('.5+.5'), { ok: true, valor: 1 })
})

test('unário', () => {
  assert.deepEqual(avalia('-3+5'), { ok: true, valor: 2 })
  assert.deepEqual(avalia('-(2+3)'), { ok: true, valor: -5 })
  assert.deepEqual(avalia('2*-3'), { ok: true, valor: -6 })
  assert.deepEqual(avalia('2--3'), { ok: true, valor: 5 })
})

test('parâmetros encadeados', () => {
  assert.deepEqual(avalia('W', p), { ok: true, valor: 42 })
  assert.deepEqual(avalia('L-2*parede', p), { ok: true, valor: 76 })
  assert.deepEqual(avalia('80/2+parede', p), { ok: true, valor: 42 })
})

test('funções', () => {
  assert.deepEqual(avalia('min(3,5)'), { ok: true, valor: 3 })
  assert.deepEqual(avalia('max(3,5)'), { ok: true, valor: 5 })
  assert.deepEqual(avalia('round(2.5)'), { ok: true, valor: 3 })
  assert.deepEqual(avalia('floor(2.7)'), { ok: true, valor: 2 })
  assert.deepEqual(avalia('ceil(2.1)'), { ok: true, valor: 3 })
  assert.deepEqual(avalia('abs(-4)'), { ok: true, valor: 4 })
  assert.deepEqual(avalia('sqrt(16)'), { ok: true, valor: 4 })
})

test('trigonometria em graus e constante pi', () => {
  const sin30 = avalia('sin(30)')
  assert.ok(sin30.ok && Math.abs(sin30.valor - 0.5) < 1e-9)
  const cos60 = avalia('cos(60)')
  assert.ok(cos60.ok && Math.abs(cos60.valor - 0.5) < 1e-9)
  const tan45 = avalia('tan(45)')
  assert.ok(tan45.ok && Math.abs(tan45.valor - 1) < 1e-9)
  assert.deepEqual(avalia('pi'), { ok: true, valor: Math.PI })
})

test('erros com mensagem em pt-BR', () => {
  assert.deepEqual(avalia('X'), { ok: false, erro: 'Parâmetro "X" não existe. Crie-o com o comando PARAM.' })
  assert.deepEqual(avalia('(2+3'), { ok: false, erro: 'Parêntese aberto sem fechar. Feche com ")".' })
  assert.deepEqual(avalia('1/0').ok, false)
  assert.deepEqual(avalia('1/(2-2)'), { ok: false, erro: 'Divisão por zero. Troque o divisor por outro valor.' })
  assert.deepEqual(avalia('foo(2)'), {
    ok: false,
    erro: 'Função "foo" não existe. Use min, max, round, floor, ceil, sqrt, abs, sin, cos ou tan.',
  })
  assert.deepEqual(avalia(''), { ok: false, erro: 'Expressão vazia. Digite um valor, como 80.' })
  assert.deepEqual(avalia('   '), { ok: false, erro: 'Expressão vazia. Digite um valor, como 80.' })
  assert.equal(avalia('sqrt(-1)').ok, false)
  assert.equal(avalia('2 3').ok, false)
  assert.equal(avalia('#').ok, false)
  assert.equal(avalia('min()').ok, false)
})

test('ciclo direto, indireto e auto-referência', () => {
  const indireto: Parametros = { A: { expr: 'B' }, B: { expr: 'A' } }
  assert.deepEqual(achaCiclo(indireto), ['A', 'B'])
  assert.deepEqual(avalia('A', indireto), { ok: false, erro: 'Referência circular: A -> B -> A. Remova a dependência.' })

  const auto: Parametros = { A: { expr: 'A+1' } }
  assert.deepEqual(achaCiclo(auto), ['A'])
  assert.deepEqual(avalia('A', auto), { ok: false, erro: 'Referência circular: A -> A. Remova a dependência.' })

  assert.equal(achaCiclo(p), null)
})

test('dependencias', () => {
  assert.deepEqual(dependencias('L-2*parede+min(a,3)'), ['L', 'parede', 'a'])
  assert.deepEqual(dependencias('pi*r*r'), ['r'])
  assert.deepEqual(dependencias('x+x'), ['x'])
  assert.deepEqual(dependencias('2+'), [])
})
