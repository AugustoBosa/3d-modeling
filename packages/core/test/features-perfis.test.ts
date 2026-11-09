import { test } from 'node:test'
import assert from 'node:assert/strict'
import { executaExtrude, executaRevolve } from '../src/features/perfis.ts'
import { ErroFeature } from '../src/features/tipos.ts'
import type { Ctx, Delta, FExtrude, FRevolve } from '../src/features/tipos.ts'
import type { Perfil, PlanoLocal, Vec2 } from '../src/kernel/tipos.ts'
import type { Manifold as MF } from 'manifold-3d'
import { Manifold, criaLixo, malhaDe } from '../src/kernel/index.ts'
import { bbox, fechada, volume } from '../src/malha/index.ts'

const PLANO: PlanoLocal = { origem: [0, 0, 0], normal: [0, 0, 1], eixoX: [1, 0, 0] }
const retangulo = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
const perfilSimples = (externo: Vec2[], furos: Vec2[][] = []): Perfil => ({ externo, furos })

function ctxCom(perfis: Perfil[], corpos = new Map<string, MF>()): Ctx {
  return { corpos, perfis: () => perfis, lixo: criaLixo(), tol: 0.05 }
}

function liberaDelta(delta: Delta) {
  for (const m of Object.values(delta)) m?.delete()
}

function extrude(extra: Partial<FExtrude>): FExtrude {
  return { id: 'e1', tipo: 'extrude', sketch: 'sk1', distancia: 5, ...extra }
}

function revolve(extra: Partial<FRevolve>): FRevolve {
  return { id: 'r1', tipo: 'revolve', sketch: 'sk1', eixo: { ponto: [0, 0], dir: [0, 1] }, graus: 360, ...extra }
}

const perto = (a: number, b: number, tol: number) => assert.ok(Math.abs(a - b) <= tol, `esperado ${b} ± ${tol}, obtido ${a}`)

test('extrude de quadrado 20x10 por 5: volume 1000, bbox z 0..5, malha fechada', () => {
  const ctx = ctxCom([perfilSimples(retangulo(0, 0, 20, 10))])
  const delta = executaExtrude(extrude({}), ctx, PLANO)
  const m = delta.e1!
  const malha = malhaDe(m)
  perto(volume(malha), 1000, 0.01)
  const b = bbox(malha)
  perto(b.min[2], 0, 1e-6); perto(b.max[2], 5, 1e-6)
  assert.equal(fechada(malha), true)
  liberaDelta(delta)
  ctx.lixo.limpa()
})

test('extrude com furo quadrado 4x4: volume 920', () => {
  const furo = retangulo(8, 3, 12, 7)
  const ctx = ctxCom([perfilSimples(retangulo(0, 0, 20, 10), [furo])])
  const delta = executaExtrude(extrude({}), ctx, PLANO)
  perto(volume(malhaDe(delta.e1!)), 920, 0.01)
  liberaDelta(delta)
  ctx.lixo.limpa()
})

test('extrude simétrico 6: bbox z -3..3, volume 1200', () => {
  const ctx = ctxCom([perfilSimples(retangulo(0, 0, 20, 10))])
  const delta = executaExtrude(extrude({ distancia: 6, modo: 'simetrica' }), ctx, PLANO)
  const malha = malhaDe(delta.e1!)
  const b = bbox(malha)
  perto(b.min[2], -3, 1e-6); perto(b.max[2], 3, 1e-6)
  perto(volume(malha), 1200, 0.01)
  liberaDelta(delta)
  ctx.lixo.limpa()
})

test('extrude em duas distâncias 4 e 2: bbox z -2..4', () => {
  const ctx = ctxCom([perfilSimples(retangulo(0, 0, 20, 10))])
  const delta = executaExtrude(extrude({ distancia: 4, distancia2: 2, modo: 'duas' }), ctx, PLANO)
  const b = bbox(malhaDe(delta.e1!))
  perto(b.min[2], -2, 1e-6); perto(b.max[2], 4, 1e-6)
  liberaDelta(delta)
  ctx.lixo.limpa()
})

test('extrude com taper 5° de quadrado 20x20 h=10: volume do tronco ±1%', () => {
  const ctx = ctxCom([perfilSimples(retangulo(0, 0, 20, 20))])
  const delta = executaExtrude(extrude({ distancia: 10, taper: 5 }), ctx, PLANO)
  const s = 1 - (10 * Math.tan((5 * Math.PI) / 180)) / 10
  const a1 = 400, a2 = 400 * s * s
  const esperado = (10 / 3) * (a1 + a2 + Math.sqrt(a1 * a2))
  perto(volume(malhaDe(delta.e1!)), esperado, esperado * 0.01)
  liberaDelta(delta)
  ctx.lixo.limpa()
})

test('extrude com plano em z=10: bbox z 10..15', () => {
  const ctx = ctxCom([perfilSimples(retangulo(0, 0, 20, 10))])
  const delta = executaExtrude(extrude({}), ctx, { origem: [0, 0, 10], normal: [0, 0, 1], eixoX: [1, 0, 0] })
  const b = bbox(malhaDe(delta.e1!))
  perto(b.min[2], 10, 1e-6); perto(b.max[2], 15, 1e-6)
  liberaDelta(delta)
  ctx.lixo.limpa()
})

test('operação subtrair e unir sobre corpo existente (caixa 20x10x5)', () => {
  const caixa = Manifold.cube([20, 10, 5])
  const corpos = new Map([['caixa', caixa]])

  // Passante: quadrado 4x4 dentro da caixa, atravessando z 0..5 (plano em z=-2, altura 9).
  const ctxS = ctxCom([perfilSimples(retangulo(2, 2, 6, 6))], corpos)
  const dS = executaExtrude(extrude({ distancia: 9, operacao: 'subtrair', alvo: 'caixa' }), ctxS, { ...PLANO, origem: [0, 0, -2] })
  assert.deepEqual(Object.keys(dS), ['caixa'])
  perto(volume(malhaDe(dS.caixa!)), 1000 - 80, 0.01)
  liberaDelta(dS)
  ctxS.lixo.limpa()

  // Fora da caixa: quadrado 4x4 em x 22..26, unido.
  const ctxU = ctxCom([perfilSimples(retangulo(22, 2, 26, 6))], corpos)
  const dU = executaExtrude(extrude({ distancia: 9, operacao: 'unir', alvo: 'caixa' }), ctxU, { ...PLANO, origem: [0, 0, -2] })
  assert.deepEqual(Object.keys(dU), ['caixa'])
  perto(volume(malhaDe(dU.caixa!)), 1000 + 4 * 4 * 9, 0.01)
  liberaDelta(dU)
  ctxU.lixo.limpa()

  caixa.delete()
})

test('revolve de retângulo x∈[5,10] y∈[0,20] em 360°: volume ±1% e malha fechada', () => {
  const ctx = ctxCom([perfilSimples(retangulo(5, 0, 10, 20))])
  const delta = executaRevolve(revolve({}), ctx, PLANO)
  const malha = malhaDe(delta.r1!)
  perto(volume(malha), Math.PI * (100 - 25) * 20, Math.PI * 75 * 20 * 0.01)
  assert.equal(fechada(malha), true)
  liberaDelta(delta)
  ctx.lixo.limpa()
})

test('revolve de 180°: metade do volume ±1%', () => {
  const ctx = ctxCom([perfilSimples(retangulo(5, 0, 10, 20))])
  const delta = executaRevolve(revolve({ graus: 180 }), ctx, PLANO)
  perto(volume(malhaDe(delta.r1!)), (Math.PI * 75 * 20) / 2, (Math.PI * 75 * 20) / 2 * 0.01)
  liberaDelta(delta)
  ctx.lixo.limpa()
})

test('revolve com eixo deslocado em x=-3: bbox x -16..10', () => {
  const ctx = ctxCom([perfilSimples(retangulo(5, 0, 10, 20))])
  const delta = executaRevolve(revolve({ eixo: { ponto: [-3, 0], dir: [0, 1] } }), ctx, PLANO)
  const b = bbox(malhaDe(delta.r1!))
  perto(b.min[0], -16, 0.1); perto(b.max[0], 10, 0.1)
  liberaDelta(delta)
  ctx.lixo.limpa()
})

test('revolve de perfil que cruza o eixo lança ErroFeature', () => {
  const ctx = ctxCom([perfilSimples(retangulo(-2, 0, 5, 20))])
  assert.throws(() => executaRevolve(revolve({}), ctx, PLANO), ErroFeature)
  ctx.lixo.limpa()
})

test('extrude de sketch sem perfil lança ErroFeature', () => {
  const ctx = ctxCom([])
  assert.throws(() => executaExtrude(extrude({}), ctx, PLANO), ErroFeature)
  ctx.lixo.limpa()
})

test('extrude com borda (chanfro 2 no topo) remove material e fecha', () => {
  const lixo = criaLixo()
  const sq: Perfil = { externo: [[0, 0], [20, 0], [20, 20], [0, 20]], furos: [] }
  const ctx = { corpos: new Map(), perfis: () => [sq], lixo, tol: 0.05 }
  const d = executaExtrude({ id: 'e', tipo: 'extrude', sketch: 's', distancia: 10, borda: { modo: 'chanfro', tamanho: 2, onde: 'topo' } }, ctx, { origem: [0, 0, 0], normal: [0, 0, 1], eixoX: [1, 0, 0] })
  const m = malhaDe(d.e!)
  assert.ok(fechada(m)); assert.ok(volume(m) < 4000 && volume(m) > 3800)
  d.e!.delete(); lixo.limpa()
})
