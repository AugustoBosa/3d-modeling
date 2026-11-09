import { test } from 'node:test'
import assert from 'node:assert/strict'
import { executaBooleana, executaCorte, executaEspelho, executaPadrao, executaPrimitiva, executaShell, executaTransformacao } from '../src/features/solidos.ts'
import { ErroFeature } from '../src/features/tipos.ts'
import type { Ctx, Delta, FBooleana, FCorte, FEspelho, FPadrao, FPrimitiva, FShell, FTransformacao } from '../src/features/tipos.ts'
import type { Manifold as MF } from 'manifold-3d'
import { Manifold, criaLixo, malhaDe } from '../src/kernel/index.ts'
import { bbox, fechada, volume } from '../src/malha/index.ts'

const PLANO_X = { origem: [0, 0, 0] as [number, number, number], normal: [1, 0, 0] as [number, number, number], eixoX: [0, 1, 0] as [number, number, number] }

function ctxCom(corpos = new Map<string, MF>()): Ctx {
  return { corpos, perfis: () => [], lixo: criaLixo(), tol: 0.01 }
}

function liberaDelta(delta: Delta) {
  for (const m of Object.values(delta)) m?.delete()
}

/** Confere volume (± tol), bbox (min/max) e malha fechada de um corpo do Delta. */
function confere(delta: Delta, id: string, v: number, vTol: number, min: number[], max: number[]) {
  const malha = malhaDe(delta[id]!)
  assert.ok(Math.abs(volume(malha) - v) <= vTol, `volume ${volume(malha)} fora de ${v} ± ${vTol}`)
  const b = bbox(malha)
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(b.min[i] - min[i]) < 1e-3, `min[${i}] ${b.min[i]} != ${min[i]}`)
    assert.ok(Math.abs(b.max[i] - max[i]) < 1e-3, `max[${i}] ${b.max[i]} != ${max[i]}`)
  }
  assert.equal(fechada(malha), true)
}

const prim = (extra: Partial<FPrimitiva>): FPrimitiva => ({ id: 'p1', tipo: 'caixa', pos: [0, 0, 0], dim: [10, 10, 10], ...extra })

test('caixa 10x20x30: volume 6000 exato, bbox 0..10 0..20 0..30', () => {
  const ctx = ctxCom()
  const delta = executaPrimitiva(prim({ dim: [10, 20, 30] }), ctx)
  confere(delta, 'p1', 6000, 0.01, [0, 0, 0], [10, 20, 30])
  liberaDelta(delta); ctx.lixo.limpa()
})

test('cilindro r=5 h=10: volume π·25·10 ±0,3%', () => {
  const ctx = ctxCom()
  const delta = executaPrimitiva(prim({ tipo: 'cilindro', dim: [5, 10] }), ctx)
  const v = Math.PI * 25 * 10
  confere(delta, 'p1', v, v * 0.003, [-5, -5, 0], [5, 5, 10])
  liberaDelta(delta); ctx.lixo.limpa()
})

test('esfera r=10: volume 4/3·π·10³ ±0,5%', () => {
  const ctx = ctxCom()
  const delta = executaPrimitiva(prim({ tipo: 'esfera', dim: [10] }), ctx)
  const v = (4 / 3) * Math.PI * 1000
  confere(delta, 'p1', v, v * 0.005, [-10, -10, -10], [10, 10, 10])
  liberaDelta(delta); ctx.lixo.limpa()
})

test('cone rBase 5, rTopo 2, h 10: volume π·h/3·(R²+Rr+r²) ±0,5%', () => {
  const ctx = ctxCom()
  const delta = executaPrimitiva(prim({ tipo: 'cone', dim: [5, 2, 10] }), ctx)
  const v = (Math.PI * 10 / 3) * (25 + 10 + 4)
  confere(delta, 'p1', v, v * 0.005, [-5, -5, 0], [5, 5, 10])
  liberaDelta(delta); ctx.lixo.limpa()
})

test('toro R=10 r=2: volume 2π²·R·r² ±1%', () => {
  const ctx = ctxCom()
  const delta = executaPrimitiva(prim({ tipo: 'toro', dim: [10, 2] }), ctx)
  const v = 2 * Math.PI * Math.PI * 10 * 4
  confere(delta, 'p1', v, v * 0.01, [-12, -12, -2], [12, 12, 2])
  liberaDelta(delta); ctx.lixo.limpa()
})

test('primitiva com dimensão zero: ErroFeature', () => {
  const ctx = ctxCom()
  assert.throws(() => executaPrimitiva(prim({ dim: [0, 1, 1] }), ctx), ErroFeature)
  ctx.lixo.limpa()
})

test('primitiva unir a um corpo existente: duas caixas 10 com 5 de sobreposição = volume 1500', () => {
  const base = Manifold.cube([10, 10, 10])
  const ctx = ctxCom(new Map([['base', base]]))
  const delta = executaPrimitiva(prim({ id: 'p2', pos: [5, 0, 0], operacao: 'unir', alvo: 'base' }), ctx)
  assert.deepEqual(Object.keys(delta), ['base'])
  confere(delta, 'base', 1500, 0.01, [0, 0, 0], [15, 10, 10])
  liberaDelta(delta); ctx.lixo.limpa(); base.delete()
})

test('booleana subtrair sem manter: ferramenta vira null e o alvo fica com volume 500', () => {
  const alvo = Manifold.cube([10, 10, 10])
  const ferr = Manifold.cube([10, 10, 10]).translate(5, 0, 0)
  const ctx = ctxCom(new Map([['alvo', alvo], ['ferr', ferr]]))
  const f: FBooleana = { id: 'b1', tipo: 'booleana', op: 'subtrair', alvo: 'alvo', ferramentas: ['ferr'], manter: false }
  const delta = executaBooleana(f, ctx)
  assert.equal(delta.ferr, null)
  confere(delta, 'alvo', 500, 0.01, [0, 0, 0], [5, 10, 10])
  liberaDelta(delta); ctx.lixo.limpa(); alvo.delete(); ferr.delete()
})

test('booleana subtrair com manter: ferramenta fica fora do Delta', () => {
  const alvo = Manifold.cube([10, 10, 10])
  const ferr = Manifold.cube([10, 10, 10]).translate(5, 0, 0)
  const ctx = ctxCom(new Map([['alvo', alvo], ['ferr', ferr]]))
  const f: FBooleana = { id: 'b1', tipo: 'booleana', op: 'subtrair', alvo: 'alvo', ferramentas: ['ferr'], manter: true }
  const delta = executaBooleana(f, ctx)
  assert.deepEqual(Object.keys(delta), ['alvo'])
  confere(delta, 'alvo', 500, 0.01, [0, 0, 0], [5, 10, 10])
  liberaDelta(delta); ctx.lixo.limpa(); alvo.delete(); ferr.delete()
})

test('booleana com ferramenta inexistente: ErroFeature', () => {
  const alvo = Manifold.cube([10, 10, 10])
  const ctx = ctxCom(new Map([['alvo', alvo]]))
  const f: FBooleana = { id: 'b1', tipo: 'booleana', op: 'unir', alvo: 'alvo', ferramentas: ['nao_existe'] }
  assert.throws(() => executaBooleana(f, ctx), ErroFeature)
  ctx.lixo.limpa(); alvo.delete()
})

test('shell de caixa 20x20x10, espessura 2, aberta no topo: volume 4000 - 16·16·8 = 1952', () => {
  const c = Manifold.cube([20, 20, 10])
  const ctx = ctxCom(new Map([['c', c]]))
  const f: FShell = { id: 's1', tipo: 'shell', alvo: 'c', espessura: 2, abrir: ['topo'] }
  const delta = executaShell(f, ctx)
  confere(delta, 'c', 1952, 1952 * 0.005, [0, 0, 0], [20, 20, 10])
  liberaDelta(delta); ctx.lixo.limpa(); c.delete()
})

test('shell de esfera (não prismática): ErroFeature', () => {
  const e = Manifold.sphere(10, 48)
  const ctx = ctxCom(new Map([['e', e]]))
  const f: FShell = { id: 's1', tipo: 'shell', alvo: 'e', espessura: 2, abrir: ['topo'] }
  assert.throws(() => executaShell(f, ctx), ErroFeature)
  ctx.lixo.limpa(); e.delete()
})

test('padrão linear n=3 passo 15 de caixa 10: volume 3000, bbox x 0..40', () => {
  const c = Manifold.cube([10, 10, 10])
  const ctx = ctxCom(new Map([['c', c]]))
  const f: FPadrao = { id: 'pd', tipo: 'padrao', modo: 'linear', n: 3, dir: [1, 0, 0], passo: 15, alvo: 'c' }
  const delta = executaPadrao(f, ctx)
  confere(delta, 'c', 3000, 0.01, [0, 0, 0], [40, 10, 10])
  liberaDelta(delta); ctx.lixo.limpa(); c.delete()
})

test('padrão circular n=4 em 360° de caixa 2x2x2 em x 10..12: volume 32, bbox ±12', () => {
  const c = Manifold.cube([2, 2, 2]).translate(10, -1, -1)
  const ctx = ctxCom(new Map([['c', c]]))
  const f: FPadrao = { id: 'pd', tipo: 'padrao', modo: 'circular', n: 4, eixo: { ponto: [0, 0, 0], dir: [0, 0, 1] }, graus: 360, alvo: 'c' }
  const delta = executaPadrao(f, ctx)
  confere(delta, 'c', 32, 0.01, [-12, -12, -1], [12, 12, 1])
  liberaDelta(delta); ctx.lixo.limpa(); c.delete()
})

test('espelho de caixa x 5..10 pelo plano x=0 com manter: volume 1000, bbox x -10..10', () => {
  const c = Manifold.cube([5, 10, 10]).translate(5, 0, 0)
  const ctx = ctxCom(new Map([['c', c]]))
  const f: FEspelho = { id: 'es', tipo: 'espelho', plano: PLANO_X, alvo: 'c' }
  const delta = executaEspelho(f, ctx)
  confere(delta, 'c', 1000, 0.01, [-10, 0, 0], [10, 10, 10])
  liberaDelta(delta); ctx.lixo.limpa(); c.delete()
})

test('corte de caixa 10 pelo plano z=4: acima 600, abaixo 400, ambos devolve 2 chaves', () => {
  const c = Manifold.cube([10, 10, 10])
  const ctx = ctxCom(new Map([['c', c]]))
  const plano = { origem: [0, 0, 4] as [number, number, number], normal: [0, 0, 1] as [number, number, number], eixoX: [1, 0, 0] as [number, number, number] }

  const acima = executaCorte({ id: 'k', tipo: 'corte', plano, manter: 'acima', alvo: 'c' } as FCorte, ctx)
  confere(acima, 'c', 600, 0.01, [0, 0, 4], [10, 10, 10])
  liberaDelta(acima)

  const abaixo = executaCorte({ id: 'k', tipo: 'corte', plano, manter: 'abaixo', alvo: 'c' } as FCorte, ctx)
  confere(abaixo, 'c', 400, 0.01, [0, 0, 0], [10, 10, 4])
  liberaDelta(abaixo)

  const ambos = executaCorte({ id: 'k', tipo: 'corte', plano, manter: 'ambos', alvo: 'c' } as FCorte, ctx)
  assert.deepEqual(Object.keys(ambos).sort(), ['c', 'c_b'])
  confere(ambos, 'c', 600, 0.01, [0, 0, 4], [10, 10, 10])
  confere(ambos, 'c_b', 400, 0.01, [0, 0, 0], [10, 10, 4])
  liberaDelta(ambos); ctx.lixo.limpa(); c.delete()
})

test('transformação: escala 2, girar 90° em Z, mover [5,0,0] de caixa 10: volume 8000, bbox x -15..5', () => {
  const c = Manifold.cube([10, 10, 10])
  const ctx = ctxCom(new Map([['c', c]]))
  const f: FTransformacao = { id: 't1', tipo: 'transformacao', alvo: 'c', escala: 2, girar: [0, 0, 90], mover: [5, 0, 0] }
  const delta = executaTransformacao(f, ctx)
  confere(delta, 'c', 8000, 0.01, [-15, 0, 0], [5, 20, 20])
  liberaDelta(delta); ctx.lixo.limpa(); c.delete()
})
