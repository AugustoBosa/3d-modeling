import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { EntSk, SketchFeature } from '@3dm/core/sketch'
import { EDITORES } from '../src/sketch/editores.ts'
import type { Resp } from '../src/sketch/editor.ts'
import { T } from '../src/textos.ts'

// Sketch de teste: retângulo 80x50 com 4 pontos (p1..p4) e 4 linhas (l1..l4).
const retangulo = (): SketchFeature => ({
  id: 'sk1', tipo: 'sketch', plano: { base: 'XY', offset: 0 },
  entidades: [
    { id: 'p1', tipo: 'ponto', x: 0, y: 0 }, { id: 'p2', tipo: 'ponto', x: 80, y: 0 },
    { id: 'p3', tipo: 'ponto', x: 80, y: 50 }, { id: 'p4', tipo: 'ponto', x: 0, y: 50 },
    { id: 'l1', tipo: 'linha', a: 'p1', b: 'p2' }, { id: 'l2', tipo: 'linha', a: 'p2', b: 'p3' },
    { id: 'l3', tipo: 'linha', a: 'p3', b: 'p4' }, { id: 'l4', tipo: 'linha', a: 'p4', b: 'p1' },
  ],
  restricoes: [],
})

// Dois segmentos em T: A horizontal (0,0)-(100,0) cortada por B vertical em x=50.
const cenaT = (): SketchFeature => ({
  id: 'sk2', tipo: 'sketch', plano: { base: 'XY', offset: 0 },
  entidades: [
    { id: 'pa0', tipo: 'ponto', x: 0, y: 0 }, { id: 'pa1', tipo: 'ponto', x: 100, y: 0 },
    { id: 'pb0', tipo: 'ponto', x: 50, y: -20 }, { id: 'pb1', tipo: 'ponto', x: 50, y: 20 },
    { id: 'A', tipo: 'linha', a: 'pa0', b: 'pa1' }, { id: 'B', tipo: 'linha', a: 'pb0', b: 'pb1' },
  ],
  restricoes: [],
})

// Duas linhas paralelas ao eixo X e uma vertical, para estender A (0,0)-(40,0) até B em x=100.
const estendeCena = (): SketchFeature => ({
  id: 'sk3', tipo: 'sketch', plano: { base: 'XY', offset: 0 },
  entidades: [
    { id: 'pa0', tipo: 'ponto', x: 0, y: 0 }, { id: 'pa1', tipo: 'ponto', x: 40, y: 0 },
    { id: 'pb0', tipo: 'ponto', x: 100, y: -50 }, { id: 'pb1', tipo: 'ponto', x: 100, y: 50 },
    { id: 'A', tipo: 'linha', a: 'pa0', b: 'pa1' }, { id: 'B', tipo: 'linha', a: 'pb0', b: 'pb1' },
  ],
  restricoes: [],
})

const de = <K extends EntSk['tipo']>(sk: SketchFeature, tipo: K) =>
  sk.entidades.filter((e): e is Extract<EntSk, { tipo: K }> => e.tipo === tipo)

const pt = (sk: SketchFeature, id: string): { x: number; y: number } => {
  const e = sk.entidades.find((x) => x.id === id)
  if (!e || e.tipo !== 'ponto') throw new Error(`ponto ${id} ausente`)
  return { x: e.x, y: e.y }
}
const perto = (p: { x: number; y: number }, x: number, y: number) => {
  assert.ok(Math.abs(p.x - x) < 1e-6 && Math.abs(p.y - y) < 1e-6, `(${p.x}, ${p.y}) != (${x}, ${y})`)
}
const temPonto = (sk: SketchFeature, x: number, y: number) =>
  de(sk, 'ponto').some((p) => Math.abs(p.x - x) < 1e-6 && Math.abs(p.y - y) < 1e-6)

const roda = (nome: string, sk: SketchFeature, r: Resp[]) => EDITORES[nome].fabrica().aplica(sk, r)

test('todos os editores existem, com aliases e passos; repete so em APARAR e ESTENDER', () => {
  const nomes = Object.keys(EDITORES).sort()
  assert.deepEqual(nomes, ['APAGAR', 'APARAR', 'ARRAY', 'ARRAYPOLAR', 'CHANFRO', 'CONSTRUCAO_ALT', 'COPIAR', 'ESCALAR', 'ESPELHAR', 'ESTENDER', 'FILLET', 'GIRAR', 'MOVER', 'OFFSET'])
  assert.deepEqual(EDITORES.APAGAR.aliases, ['E', 'ERASE'])
  assert.deepEqual(EDITORES.CHANFRO.aliases, ['CHA'])
  const repetem = nomes.filter((n) => EDITORES[n].fabrica().repete === true)
  assert.deepEqual(repetem, ['APARAR', 'ESTENDER'])
  for (const n of nomes) assert.equal(EDITORES[n].fabrica().nome, n)

  const kinds = (n: string) => EDITORES[n].fabrica().passos.map((p) => p.k)
  assert.deepEqual(kinds('MOVER'), ['selecao', 'ponto', 'ponto'])
  assert.deepEqual(kinds('GIRAR'), ['selecao', 'ponto', 'valor'])
  assert.deepEqual(kinds('ESPELHAR'), ['selecao', 'ponto', 'ponto', 'opcao'])
  assert.deepEqual(kinds('APAGAR'), ['selecao'])
  assert.deepEqual(kinds('APARAR'), ['entidade'])
  assert.deepEqual(kinds('OFFSET'), ['valor', 'entidade', 'ponto'])
  assert.deepEqual(kinds('ARRAY'), ['selecao', 'valor', 'valor', 'valor', 'valor'])
  assert.deepEqual(kinds('ARRAYPOLAR'), ['selecao', 'ponto', 'valor', 'valor'])
  const prompts = EDITORES.MOVER.fabrica().passos.map((p) => p.prompt)
  assert.deepEqual(prompts, [T.ed.selecionar, T.ed.base, T.ed.destino])
  const opt = EDITORES.ESPELHAR.fabrica().passos[3]
  assert.deepEqual(opt.k === 'opcao' ? opt.opcoes : null, [T.ed.op.sim, T.ed.op.nao])
})

test('MOVER 10,5 desloca os pontos da selecao', () => {
  const sk = retangulo()
  roda('MOVER', sk, [{ sel: ['l1', 'l2', 'l3', 'l4'] }, { p: { x: 0, y: 0 } }, { p: { x: 10, y: 5 } }])
  perto(pt(sk, 'p1'), 10, 5)
  perto(pt(sk, 'p3'), 90, 55)
})

test('COPIAR dobra as linhas', () => {
  const sk = retangulo()
  roda('COPIAR', sk, [{ sel: ['l1', 'l2', 'l3', 'l4'] }, { p: { x: 0, y: 0 } }, { p: { x: 100, y: 0 } }])
  assert.equal(de(sk, 'linha').length, 8)
  perto(pt(sk, 'p1'), 0, 0)
  assert.ok(temPonto(sk, 100, 0))
})

test('GIRAR 90 graus em torno da origem', () => {
  const sk = retangulo()
  roda('GIRAR', sk, [{ sel: ['l1', 'l2', 'l3', 'l4'] }, { p: { x: 0, y: 0 } }, { v: 90 }])
  perto(pt(sk, 'p2'), 0, 80)
})

test('ESCALAR 2 em torno da origem', () => {
  const sk = retangulo()
  roda('ESCALAR', sk, [{ sel: ['l1', 'l2', 'l3', 'l4'] }, { p: { x: 0, y: 0 } }, { v: 2 }])
  perto(pt(sk, 'p3'), 160, 100)
})

test('ESPELHAR: Sim move a origem; Nao mantem e cria copia', () => {
  const sim = retangulo()
  roda('ESPELHAR', sim, [{ sel: ['l1', 'l2', 'l3', 'l4'] }, { p: { x: 0, y: 0 } }, { p: { x: 0, y: 1 } }, { opcao: T.ed.op.sim }])
  perto(pt(sim, 'p2'), -80, 0)
  assert.equal(de(sim, 'linha').length, 4)

  const nao = retangulo()
  roda('ESPELHAR', nao, [{ sel: ['l1', 'l2', 'l3', 'l4'] }, { p: { x: 0, y: 0 } }, { p: { x: 0, y: 1 } }, { opcao: T.ed.op.nao }])
  perto(pt(nao, 'p2'), 80, 0)
  assert.equal(de(nao, 'linha').length, 8)
  assert.ok(temPonto(nao, -80, 0))
})

test('APAGAR remove a linha e mantem os pontos', () => {
  const sk = retangulo()
  roda('APAGAR', sk, [{ sel: ['l1'] }])
  assert.deepEqual(de(sk, 'linha').map((e) => e.id), ['l2', 'l3', 'l4'])
  assert.equal(de(sk, 'ponto').length, 4)
})

test('CONSTRUCAO_ALT liga e depois desliga', () => {
  const sk = retangulo()
  roda('CONSTRUCAO_ALT', sk, [{ sel: ['l1', 'l2'] }])
  assert.equal(de(sk, 'linha').find((e) => e.id === 'l1')?.construcao, true)
  assert.equal(de(sk, 'linha').find((e) => e.id === 'l3')?.construcao, undefined)
  roda('CONSTRUCAO_ALT', sk, [{ sel: ['l1', 'l2'] }])
  assert.equal(de(sk, 'linha').find((e) => e.id === 'l1')?.construcao, false)
})

test('APARAR corta o trecho clicado de A no T', () => {
  const sk = cenaT()
  roda('APARAR', sk, [{ id: 'A', p: { x: 75, y: 0 } }])
  const A = de(sk, 'linha').find((e) => e.id === 'A')!
  perto(pt(sk, A.a), 0, 0)
  perto(pt(sk, A.b), 50, 0)
  assert.equal(de(sk, 'linha').length, 2)
})

test('ESTENDER prolonga a ponta ate a linha limite', () => {
  const sk = estendeCena()
  roda('ESTENDER', sk, [{ id: 'A', p: { x: 35, y: 0 } }])
  const A = de(sk, 'linha').find((e) => e.id === 'A')!
  perto(pt(sk, A.b), 100, 0)
})

test('OFFSET de linha 5 mm para o lado clicado', () => {
  const sk = retangulo()
  roda('OFFSET', sk, [{ v: 5 }, { id: 'l1' }, { p: { x: 40, y: 10 } }])
  const nova = de(sk, 'linha').find((e) => e.id === 'l5')!
  const ys = [pt(sk, nova.a).y, pt(sk, nova.b).y]
  assert.deepEqual(ys, [5, 5])
})

test('FILLET raio 5 no canto do L (l1 e l4)', () => {
  const sk = retangulo()
  roda('FILLET', sk, [{ v: 5 }, { id: 'l1' }, { id: 'l4' }])
  const arco = de(sk, 'arco')
  assert.equal(arco.length, 1)
  perto(pt(sk, arco[0].c), 5, 5)
  perto(pt(sk, arco[0].a), 0, 5)
  perto(pt(sk, arco[0].b), 5, 0)
  assert.equal(sk.restricoes.filter((r) => r.tipo === 'tangente').length, 2)
})

test('CHANFRO 10 e 10 no canto do retangulo', () => {
  const sk = retangulo()
  roda('CHANFRO', sk, [{ v: 10 }, { v: 10 }, { id: 'l1' }, { id: 'l4' }])
  const nova = de(sk, 'linha').at(-1)!
  perto(pt(sk, nova.a), 10, 0)
  perto(pt(sk, nova.b), 0, 10)
  assert.equal(de(sk, 'linha').length, 5)
})

test('ARRAY 3x2: 6 cópias da seleção (24 linhas no total)', () => {
  const sk = retangulo()
  roda('ARRAY', sk, [{ sel: ['l1', 'l2', 'l3', 'l4'] }, { v: 3 }, { v: 2 }, { v: 100 }, { v: 60 }])
  assert.equal(de(sk, 'linha').length, 24)
  assert.ok(temPonto(sk, 200, 60))
})

test('ARRAYPOLAR 4 itens em 360 graus', () => {
  const sk = retangulo()
  roda('ARRAYPOLAR', sk, [{ sel: ['l1', 'l2', 'l3', 'l4'] }, { p: { x: 0, y: 0 } }, { v: 4 }, { v: 360 }])
  assert.equal(de(sk, 'linha').length, 16)
  assert.ok(temPonto(sk, -80, 0))
  assert.ok(temPonto(sk, 0, -80))
})

test('Resposta incompleta: selecao vazia e ponto faltando lancam Error em pt-BR', () => {
  assert.throws(() => roda('MOVER', retangulo(), [{ sel: [] }, { p: { x: 0, y: 0 } }, { p: { x: 1, y: 1 } }]), { message: T.ed.nadaSelecionado })
  assert.throws(() => roda('GIRAR', retangulo(), [{ sel: ['l1'] }, {}, { v: 90 }]), { message: T.ferr.invalido })
})
