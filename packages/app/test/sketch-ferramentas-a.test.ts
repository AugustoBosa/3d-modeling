import { test } from 'node:test'
import assert from 'node:assert/strict'
import { linha, polilinha, retangulo, ponto, construcao } from '../src/sketch/ferramentas-a.ts'
import { T } from '../src/textos.ts'
import type { EntSk } from '@3dm/core/sketch'

const clique = (x: number, y: number, ref?: string) => ({ tipo: 'ponto' as const, p: { x, y }, ref })
const opcao = (o: string) => ({ tipo: 'opcao' as const, opcao: o })
const valor = (v: number) => ({ tipo: 'valor' as const, v })
const arred = (x: number) => Math.round(x * 1e6) / 1e6 + 0 // evita -0 e ruído de ponto flutuante
const pontoDe = (ents: EntSk[], id: string) => {
  const e = ents.find(x => x.id === id)
  return e?.tipo === 'ponto' ? [arred(e.x), arred(e.y)] : null
}
const tipos = (ents: EntSk[]) => ents.map(e => e.tipo)

test('RETANGULO 80x50: 4 pontos, 4 linhas em volta, horizontal/vertical, fim', () => {
  const f = retangulo()
  assert.equal(f.nome, 'RETANGULO')
  assert.equal(f.inicio().prompt, T.ferrA.recP1Op)
  assert.deepEqual(f.inicio().opcoes, [T.ferrA.op.centro, T.ferrA.op.tres, T.ferrA.op.fillet, T.ferrA.op.chanfro])
  f.entra(clique(0, 0))
  const r = f.entra(clique(80, 50))
  assert.equal(r.fim, true)
  const a = r.adicao!
  const pts = a.entidades.filter(e => e.tipo === 'ponto').map(e => [e.tipo === 'ponto' ? e.x : 0, e.tipo === 'ponto' ? e.y : 0])
  assert.deepEqual(pts, [[0, 0], [80, 0], [80, 50], [0, 50]])
  assert.equal(a.entidades.filter(e => e.tipo === 'linha').length, 4)
  assert.deepEqual(a.restricoes.map(q => q.tipo), ['horizontal', 'vertical', 'horizontal', 'vertical'])
})

test('RETANGULO com ref: o ponto existente nao e redefinido e as linhas apontam para a ref', () => {
  const f = retangulo()
  f.entra(clique(0, 0, 'p3'))
  const a = f.entra(clique(80, 50)).adicao!
  assert.equal(a.entidades.some(e => e.id === 'p3'), false)
  const linhas = a.entidades.filter(e => e.tipo === 'linha')
  assert.ok(linhas.some(e => e.tipo === 'linha' && e.a === 'p3'))
  assert.ok(linhas.some(e => e.tipo === 'linha' && e.b === 'p3'))
})

test('RETANGULO com largura 0 nao emite e segue no passo P2', () => {
  const f = retangulo()
  f.entra(clique(0, 0))
  const r = f.entra(clique(0, 50))
  assert.equal(r.adicao, undefined)
  assert.equal(r.fim, false)
})

test('RETANGULO cursor devolve 4 linhas elasticas', () => {
  const f = retangulo()
  assert.deepEqual(f.cursor({ x: 5, y: 5 }), [])
  f.entra(clique(0, 0))
  assert.equal(f.cursor({ x: 80, y: 50 }).length, 4)
})

test('LINHA com 3 cliques: 2 adicoes encadeadas, a 2a nao define o ponto inicial', () => {
  const f = linha()
  assert.equal(f.nome, 'LINHA')
  f.entra(clique(0, 0))
  const a1 = f.entra(clique(10, 0)).adicao!
  const a2 = f.entra(clique(10, 10)).adicao!
  assert.equal(a1.entidades.length, 3) // ponto P1, ponto P2, linha
  assert.equal(a2.entidades.some(e => e.id === a1.entidades[1].id), false) // ponto final da 1a nao redefinido
  const linha2 = a2.entidades.find(e => e.tipo === 'linha')!
  assert.ok(linha2.tipo === 'linha' && linha2.a === a1.entidades[1].id)
})

test('LINHA: Fechar so depois de 2 segmentos e emite linha do ultimo ao primeiro', () => {
  const f = linha()
  f.entra(clique(0, 0))
  f.entra(clique(10, 0))
  const cedo = f.entra(opcao(T.ferr.op.fechar))
  assert.equal(cedo.adicao, undefined)
  assert.equal(cedo.fim, false)
  f.entra(clique(10, 10))
  const r = f.entra(opcao(T.ferr.op.fechar))
  assert.equal(r.fim, true)
  const ln = r.adicao!.entidades[0]
  assert.ok(ln.tipo === 'linha' && ln.a === '@4' && ln.b === '@1')
})

test('LINHA: Desfazer recua o ultimo ponto e a previa acompanha', () => {
  const f = linha()
  f.entra(clique(0, 0))
  f.entra(clique(10, 0))
  f.entra(clique(10, 10))
  const r = f.entra(opcao(T.ferr.op.desfazer))
  assert.deepEqual(f.ultimo, { x: 10, y: 0 })
  assert.equal(r.previa.length, 1)
  assert.equal(r.desfazUltima, true)
  assert.equal(r.adicao, undefined)
  assert.equal(r.fim, false)
})

test('LINHA: Desfazer sem segmento emitido e ignorado', () => {
  const f = linha()
  f.entra(clique(0, 0))
  const r = f.entra(opcao(T.ferr.op.desfazer))
  assert.equal(r.desfazUltima, undefined)
  assert.deepEqual(f.ultimo, { x: 0, y: 0 })
})

test('LINHA: clique repetido no mesmo ponto e ignorado; inicial minuscula funciona', () => {
  const f = linha()
  f.entra(clique(0, 0))
  f.entra(clique(10, 0))
  assert.equal(f.entra(clique(10, 0)).adicao, undefined)
  assert.equal(f.entra(opcao('f')).fim, false) // so 1 segmento: Fechar ainda nao vale
  f.entra(clique(10, 10))
  assert.equal(f.entra(opcao('F')).fim, true) // inicial maiuscula tambem
  assert.equal(f.entra(opcao('x')).adicao, undefined) // opcao desconhecida: devolve o passo, sem adicao
})

test('ids locais nao se repetem entre adicoes do mesmo comando', () => {
  const f = polilinha()
  const ids: string[] = []
  f.entra(clique(0, 0))
  for (const [x, y] of [[10, 0], [10, 10], [0, 10]]) {
    for (const e of f.entra(clique(x, y)).adicao!.entidades) ids.push(e.id)
  }
  assert.equal(new Set(ids).size, ids.length)
})

test('PONTO emite um ponto e termina', () => {
  const f = ponto()
  assert.equal(f.inicio().prompt, T.ferr.ponto)
  const r = f.entra(clique(3, 4))
  assert.equal(r.fim, true)
  assert.deepEqual(r.adicao!.entidades, [{ id: '@1', tipo: 'ponto', x: 3, y: 4, construcao: false }])
})

test('CONSTRUCAO marca linhas e pontos criados com construcao', () => {
  const f = construcao()
  assert.equal(f.nome, 'CONSTRUCAO')
  f.entra(clique(0, 0))
  const a = f.entra(clique(10, 0)).adicao!
  assert.ok(a.entidades.every(e => e.construcao === true))
})

test('RETANGULO Centro: centro (50,25) e canto (90,50) geram 80x50 centrado', () => {
  const f = retangulo()
  assert.equal(f.entra(opcao(T.ferrA.op.centro)).prompt, T.ferrA.recCentro)
  assert.equal(f.entra(clique(50, 25)).prompt, T.ferrA.recCanto)
  assert.equal(f.cursor({ x: 90, y: 50 }).length, 4)
  const r = f.entra(clique(90, 50))
  assert.equal(r.fim, true)
  const a = r.adicao!
  assert.deepEqual(a.entidades.filter(e => e.tipo === 'ponto').map(e => pontoDe(a.entidades, e.id)), [[10, 0], [90, 0], [90, 50], [10, 50]])
  assert.deepEqual(a.restricoes.map(q => q.tipo), ['horizontal', 'vertical', 'horizontal', 'vertical'])
})

test('RETANGULO 3Pontos girado: aresta (0,0)-(30,40), altura 10 para o lado de (-8,6)', () => {
  const f = retangulo()
  f.entra(opcao(T.ferrA.op.tres))
  assert.equal(f.entra(clique(0, 0)).prompt, T.ferrA.rec3p2)
  assert.equal(f.entra(clique(30, 40)).prompt, T.ferrA.rec3p3)
  assert.equal(f.cursor({ x: -8, y: 6 }).length, 4)
  const r = f.entra(clique(-8, 6))
  assert.equal(r.fim, true)
  const a = r.adicao!
  assert.deepEqual(a.entidades.filter(e => e.tipo === 'ponto').map(e => pontoDe(a.entidades, e.id)), [[0, 0], [30, 40], [22, 46], [-8, 6]])
  assert.equal(a.entidades.filter(e => e.tipo === 'linha').length, 4)
  assert.deepEqual(a.restricoes.map(q => q.tipo), ['perpendicular', 'perpendicular', 'perpendicular', 'paralela'])
})

test('RETANGULO 3Pontos com valor: o lado segue o cursor; valor 0 e ignorado', () => {
  const f = retangulo()
  f.entra(opcao(T.ferrA.op.tres)); f.entra(clique(0, 0)); f.entra(clique(30, 40))
  assert.equal(f.entra(valor(0)).fim, false)
  f.cursor({ x: 30, y: -5 })
  const a = f.entra(valor(10)).adicao!
  assert.deepEqual(a.entidades.filter(e => e.tipo === 'ponto').map(e => pontoDe(a.entidades, e.id)), [[0, 0], [30, 40], [38, 34], [8, -6]])
})

test('RETANGULO 3Pontos sobre aresta horizontal: H/V e pontos alinhados', () => {
  const f = retangulo()
  f.entra(opcao(T.ferrA.op.tres)); f.entra(clique(0, 0)); f.entra(clique(80, 0))
  const a = f.entra(clique(80, 50)).adicao!
  assert.deepEqual(a.restricoes.map(q => q.tipo), ['horizontal', 'vertical', 'horizontal', 'vertical'])
  assert.deepEqual(a.entidades.filter(e => e.tipo === 'ponto').map(e => pontoDe(a.entidades, e.id)), [[0, 0], [80, 0], [80, 50], [0, 50]])
})

test('RETANGULO Fillet: raio 0 e ignorado; raio 10 gera 4 arcos anti-horarios tangentes', () => {
  const f = retangulo()
  f.entra(opcao(T.ferrA.op.fillet))
  assert.equal(f.entra(valor(0)).prompt, T.ferrA.recRaio)
  assert.equal(f.entra(valor(10)).prompt, T.ferr.recP1)
  f.entra(clique(0, 0))
  const r = f.entra(clique(80, 50))
  assert.equal(r.fim, true)
  const a = r.adicao!
  assert.equal(a.entidades.filter(e => e.tipo === 'linha').length, 4)
  assert.equal(a.entidades.filter(e => e.tipo === 'arco').length, 4)
  assert.equal(a.entidades.filter(e => e.tipo === 'ponto').length, 12)
  assert.equal(a.restricoes.filter(q => q.tipo === 'tangente').length, 8)
  assert.equal(a.restricoes.filter(q => q.tipo === 'horizontal' || q.tipo === 'vertical').length, 4)
  // canto (80,0): centro (70,10), arco de (70,0) a (80,10)
  const arcos = a.entidades.filter(e => e.tipo === 'arco').map(e => e.tipo === 'arco' ? [pontoDe(a.entidades, e.c), pontoDe(a.entidades, e.a), pontoDe(a.entidades, e.b)] : [])
  assert.ok(arcos.some(x => JSON.stringify(x) === '[[70,10],[70,0],[80,10]]'))
})

test('RETANGULO Fillet: raio >= metade do menor lado e ignorado no 2o canto', () => {
  const f = retangulo()
  f.entra(opcao(T.ferrA.op.fillet)); f.entra(valor(30)); f.entra(clique(0, 0))
  assert.equal(f.cursor({ x: 80, y: 50 }).length, 0)
  const r = f.entra(clique(80, 50))
  assert.equal(r.fim, false)
  assert.equal(r.adicao, undefined)
})

test('RETANGULO Chanfro: 8 pontos, 4 linhas longas H/V e 4 curtas, sem arcos', () => {
  const f = retangulo()
  f.entra(opcao(T.ferrA.op.chanfro)); f.entra(valor(10)); f.entra(clique(0, 0))
  assert.equal(f.cursor({ x: 80, y: 50 }).length, 8)
  const a = f.entra(clique(80, 50)).adicao!
  assert.equal(a.entidades.filter(e => e.tipo === 'ponto').length, 8)
  assert.equal(a.entidades.filter(e => e.tipo === 'linha').length, 8)
  assert.equal(a.entidades.some(e => e.tipo === 'arco'), false)
  assert.deepEqual(a.restricoes.map(q => q.tipo), ['horizontal', 'vertical', 'horizontal', 'vertical'])
})
