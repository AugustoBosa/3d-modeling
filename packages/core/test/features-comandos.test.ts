import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criaPilha, novoDocumento } from '../src/doc/index.ts'
import type { Comando, Documento } from '../src/doc/index.ts'
import {
  adicionaFeature, definirCorCorpo, definirParametroCompleto, editaFeature, idLivre, moveFeature,
  moveMarcador, removeFeature, removeParametro, renomeiaParametro, suprimeFeature,
} from '../src/features/comandos.ts'
import { tabelaParametros, usoDoParametro } from '../src/features/tabela.ts'

const base = (): Documento => ({
  ...novoDocumento(),
  parametros: { L: { expr: '80' }, w: { expr: 'L/2' }, p: { expr: 'L*2', comentario: 'perímetro', unidade: 'mm' } },
  features: [
    { id: 'sk1', tipo: 'sketch', entidades: [], restricoes: [{ id: 'r1', tipo: 'distancia', e: ['p1'], expr: 'L' }] },
    { id: 'ex1', tipo: 'extrude', sketch: 'sk1', distancia: 'L' },
  ],
  marcadorHistorico: 'ex1',
  aparencia: { ex1: { cor: '#b8b4ac' } },
})

/** Roda fazer e desfazer e confirma que o documento volta ao JSON exato de antes. */
function idaEVolta(d: Documento, c: Comando<Documento>): void {
  const antes = structuredClone(d)
  c.fazer(d)
  c.desfazer(d)
  assert.deepEqual(d, antes)
}

test('adicionaFeature sem índice insere depois do marcador e move o marcador', () => {
  const d = base()
  const c = adicionaFeature({ id: 'ex2', tipo: 'extrude', sketch: 'sk1', distancia: 5 })
  idaEVolta(d, c)
  c.fazer(d)
  assert.deepEqual(d.features.map((f) => f.id), ['sk1', 'ex1', 'ex2'])
  assert.equal(d.marcadorHistorico, 'ex2')
})

test('adicionaFeature com marcador no meio insere logo depois dele', () => {
  const d = base()
  d.marcadorHistorico = 'sk1'
  adicionaFeature({ id: 'x', tipo: 'caixa' }).fazer(d)
  assert.deepEqual(d.features.map((f) => f.id), ['sk1', 'x', 'ex1'])
  assert.equal(d.marcadorHistorico, 'x')
})

test('adicionaFeature sem marcador põe no fim; com índice põe na posição', () => {
  const d = base()
  d.marcadorHistorico = null
  idaEVolta(d, adicionaFeature({ id: 'x', tipo: 'caixa' }))
  adicionaFeature({ id: 'y', tipo: 'caixa' }).fazer(d)
  assert.deepEqual(d.features.map((f) => f.id), ['sk1', 'ex1', 'y'])
  idaEVolta(d, adicionaFeature({ id: 'z', tipo: 'caixa' }, 0))
  assert.throws(() => adicionaFeature({ id: 'w', tipo: 'caixa' }, 99).fazer(d), /fora da lista/)
})

test('adicionaFeature com id repetido lança e não muda o documento', () => {
  const d = base()
  const antes = structuredClone(d)
  assert.throws(() => adicionaFeature({ id: 'ex1', tipo: 'caixa' }).fazer(d), /Já existe/)
  assert.deepEqual(d, antes)
})

test('editaFeature mescla campos, remove com undefined e desfaz', () => {
  const d = base()
  const c = editaFeature('ex1', { distancia: 10, sketch: undefined })
  idaEVolta(d, c)
  c.fazer(d)
  assert.equal(d.features[1].distancia, 10)
  assert.equal('sketch' in d.features[1], false)
  assert.equal(d.features[1].tipo, 'extrude')
})

test('removeFeature: marcador vai para a anterior, aparência sai, desfazer restaura', () => {
  const d = base()
  const c = removeFeature('ex1')
  idaEVolta(d, c)
  c.fazer(d)
  assert.deepEqual(d.features.map((f) => f.id), ['sk1'])
  assert.equal(d.marcadorHistorico, 'sk1')
  assert.equal(Object.hasOwn(d.aparencia, 'ex1'), false)
})

test('removeFeature da primeira com marcador deixa o marcador em null', () => {
  const d = base()
  d.marcadorHistorico = 'sk1'
  const c = removeFeature('sk1')
  idaEVolta(d, c)
  c.fazer(d)
  assert.equal(d.marcadorHistorico, null)
})

test('suprimeFeature liga e desliga o campo suprimida', () => {
  const d = base()
  idaEVolta(d, suprimeFeature('ex1', true))
  suprimeFeature('ex1', true).fazer(d)
  assert.equal(d.features[1].suprimida, true)
  idaEVolta(d, suprimeFeature('ex1', false))
})

test('moveMarcador e moveFeature: ida e volta; id inexistente lança', () => {
  const d = base()
  idaEVolta(d, moveMarcador(null))
  idaEVolta(d, moveMarcador('sk1'))
  assert.throws(() => moveMarcador('nao').fazer(d), /não existe/)
  idaEVolta(d, moveFeature('sk1', 1))
  const c = moveFeature('sk1', 1)
  c.fazer(d)
  assert.deepEqual(d.features.map((f) => f.id), ['ex1', 'sk1'])
})

test('definirCorCorpo grava e desfaz (inclusive quando não havia cor)', () => {
  const d = base()
  idaEVolta(d, definirCorCorpo('sk1', '#ffffff'))
  idaEVolta(d, definirCorCorpo('ex1', '#000000'))
  definirCorCorpo('sk1', '#ffffff').fazer(d)
  assert.deepEqual(d.aparencia.sk1, { cor: '#ffffff' })
})

test('definirParametroCompleto recusa ciclo sem mutar e guarda metadados', () => {
  const d = base()
  d.parametros = { a: { expr: 'b' }, b: { expr: '1' } }
  const antes = structuredClone(d)
  assert.throws(() => definirParametroCompleto('b', { expr: 'a' }).fazer(d), /Ciclo entre parâmetros: a → b → a\. Quebre a dependência\./)
  assert.deepEqual(d, antes)
  assert.throws(() => definirParametroCompleto('L', { expr: 'L*2' }).fazer(d), /Ciclo entre parâmetros: L → L/)
  assert.throws(() => definirParametroCompleto('1x', { expr: '2' }), /nome de parâmetro inválido/)

  const e = base()
  const c = definirParametroCompleto('novo', { expr: 'L+1', comentario: 'folga', unidade: 'cm' })
  idaEVolta(e, c)
  c.fazer(e)
  assert.deepEqual(e.parametros.novo, { expr: 'L+1', comentario: 'folga', unidade: 'cm' })
})

test('renomeiaParametro reescreve parâmetros, cotas e campos; desfazer volta tudo', () => {
  const d = base()
  const c = renomeiaParametro('L', 'comprimento')
  idaEVolta(d, c)
  c.fazer(d)
  assert.equal(d.parametros.comprimento.expr, '80')
  assert.equal(Object.hasOwn(d.parametros, 'L'), false)
  assert.equal(d.parametros.p.expr, 'comprimento*2')
  assert.equal(d.parametros.w.expr, 'comprimento/2')
  assert.equal((d.features[0].restricoes as { expr: string }[])[0].expr, 'comprimento')
  assert.equal(d.features[1].distancia, 'comprimento')
  assert.throws(() => renomeiaParametro('w', 'p').fazer(d), /Já existe/)
})

test('removeParametro remove e desfaz; inexistente lança', () => {
  const d = base()
  const c = removeParametro('w')
  idaEVolta(d, c)
  c.fazer(d)
  assert.equal(Object.hasOwn(d.parametros, 'w'), false)
  assert.throws(() => removeParametro('zz').fazer(d), /não existe/)
})

test('idLivre devolve o primeiro id livre', () => {
  assert.equal(idLivre(novoDocumento(), 'ex'), 'ex1')
  assert.equal(idLivre(base(), 'ex'), 'ex2')
})

test('tabelaParametros: valor, erro, unidade, comentário e ciclo', () => {
  const d = novoDocumento()
  d.parametros = {
    L: { expr: '80' },
    ang: { expr: '45', unidade: 'graus', comentario: 'ângulo' },
    zero: { expr: '1/0' },
    nx: { expr: 'x' },
    a: { expr: 'b' },
    b: { expr: 'a' },
  }
  const t = tabelaParametros(d)
  assert.deepEqual(t.map((l) => l.nome), ['L', 'ang', 'zero', 'nx', 'a', 'b'])
  assert.deepEqual(t[0], { nome: 'L', expr: '80', valor: 80, erro: null, unidade: 'mm', comentario: '', ciclo: false })
  assert.equal(t[1].unidade, 'graus')
  assert.equal(t[1].comentario, 'ângulo')
  assert.equal(t[2].valor, null)
  assert.match(t[2].erro ?? '', /Divisão por zero/)
  assert.match(t[3].erro ?? '', /não existe/)
  assert.equal(t[4].ciclo, true)
  assert.equal(t[5].ciclo, true)
  assert.match(t[4].erro ?? '', /circular/)
})

test('usoDoParametro acha sketches e features que citam o nome', () => {
  const d = base()
  assert.deepEqual(usoDoParametro(d, 'L'), ['sk1', 'ex1'])
  assert.deepEqual(usoDoParametro(d, 'p'), [])
  assert.deepEqual(usoDoParametro(d, 'w'), [])
})

test('pilha real: desfaz e refaz renomeação e inclusão', () => {
  const d = base()
  const pilha = criaPilha(d)
  const antes = structuredClone(d)
  pilha.executa(renomeiaParametro('L', 'comprimento'))
  pilha.executa(adicionaFeature({ id: 'ex2', tipo: 'extrude', sketch: 'sk1', distancia: 'comprimento' }))
  const depois = structuredClone(d)
  pilha.desfaz()
  pilha.desfaz()
  assert.deepEqual(d, antes)
  pilha.refaz()
  pilha.refaz()
  assert.deepEqual(d, depois)
  assert.equal(d.features.length, 3)
})
