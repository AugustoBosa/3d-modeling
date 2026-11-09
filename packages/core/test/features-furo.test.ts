import { test } from 'node:test'
import assert from 'node:assert/strict'
import { executaFuro } from '../src/features/furo.ts'
import { ErroFeature } from '../src/features/tipos.ts'
import type { Ctx, Delta, FFuro } from '../src/features/tipos.ts'
import type { Manifold as MF } from 'manifold-3d'
import { Manifold, criaLixo, malhaDe, segmentosCirculo } from '../src/kernel/index.ts'
import type { Vec3 } from '../src/kernel/index.ts'
import { bbox, fechada, volume } from '../src/malha/index.ts'

const TOL = 0.01
const PLANO_TOPO = { origem: [0, 0, 10] as Vec3, normal: [0, 0, 1] as Vec3, eixoX: [1, 0, 0] as Vec3 }

/** Área do polígono inscrito que o kernel gera para o círculo de raio r (é o que o furo remove de fato). */
function areaPoligono(r: number): number {
  const n = segmentosCirculo(r, TOL)
  return (n / 2) * Math.sin((2 * Math.PI) / n) * r * r
}
const volCil = (r: number, h: number) => areaPoligono(r) * h

function ctxCom(corpos: Map<string, MF>): Ctx {
  return { corpos, perfis: () => [], lixo: criaLixo(), tol: TOL }
}

function liberaDelta(delta: Delta) {
  for (const m of Object.values(delta)) m?.delete()
}

/** Confere volume (± vTol), bbox (min/max) e malha fechada de um corpo do Delta. */
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

const furo = (extra: Partial<FFuro>): FFuro => ({
  id: 'f1', tipo: 'furo', plano: PLANO_TOPO, posicoes: [[20, 20]], tipoFuro: 'simples', ...extra,
})

test('furo passante d=5: remove o polígono de d=5 em 10 mm e mantém bbox', () => {
  const c = Manifold.cube([40, 40, 10])
  const ctx = ctxCom(new Map([['c', c]]))
  const delta = executaFuro(furo({ diametro: 5 }), ctx)
  const h = volCil(2.5, 10)
  confere(delta, 'c', 16000 - h, 0.003 * h, [0, 0, 0], [40, 40, 10])
  liberaDelta(delta); ctx.lixo.limpa(); c.delete()
})

test('furo cego d=5 profundidade 4: remove polígono de d=5 em 4 mm', () => {
  const c = Manifold.cube([40, 40, 10])
  const ctx = ctxCom(new Map([['c', c]]))
  const delta = executaFuro(furo({ diametro: 5, profundidade: 4 }), ctx)
  const h = volCil(2.5, 4)
  confere(delta, 'c', 16000 - h, 0.003 * h, [0, 0, 0], [40, 40, 10])
  liberaDelta(delta); ctx.lixo.limpa(); c.delete()
})

test('M3 passagem (3.4) passante: remove polígono de d=3.4 em 10 mm', () => {
  const c = Manifold.cube([40, 40, 10])
  const ctx = ctxCom(new Map([['c', c]]))
  const delta = executaFuro(furo({ preset: 'M3' }), ctx)
  const h = volCil(1.7, 10)
  confere(delta, 'c', 16000 - h, 0.003 * h, [0, 0, 0], [40, 40, 10])
  liberaDelta(delta); ctx.lixo.limpa(); c.delete()
})

test('M3 rebaixado passante: remove furo 3.4 em 10 mm + rebaixe 6.5 em 3 mm (±0,5%)', () => {
  const c = Manifold.cube([40, 40, 10])
  const ctx = ctxCom(new Map([['c', c]]))
  const delta = executaFuro(furo({ preset: 'M3', tipoFuro: 'rebaixado' }), ctx)
  const removido = volCil(1.7, 10) + volCil(3.25, 3) - volCil(1.7, 3)
  confere(delta, 'c', 16000 - removido, 0.005 * removido, [0, 0, 0], [40, 40, 10])
  liberaDelta(delta); ctx.lixo.limpa(); c.delete()
})

test('M3 escareado passante: furo 3.4 + cone 90° de 3.4 até 6.3 na face (±1%)', () => {
  const c = Manifold.cube([40, 40, 10])
  const ctx = ctxCom(new Map([['c', c]]))
  const delta = executaFuro(furo({ preset: 'M3', tipoFuro: 'escareado' }), ctx)
  // Tronco de cone de raio 1,7 (base) a 3,15 (topo), altura 1,45, menos o cilindro de raio 1,7 nessa altura.
  const r1 = 1.7, r2 = 3.15, h = 1.45
  const extraCone = (Math.PI * h / 3) * (r2 * r2 + r2 * r1 + r1 * r1) - Math.PI * r1 * r1 * h
  const removido = volCil(1.7, 10) + extraCone
  confere(delta, 'c', 16000 - removido, 0.01 * removido, [0, 0, 0], [40, 40, 10])
  liberaDelta(delta); ctx.lixo.limpa(); c.delete()
})

test('inserto M3 cego: d=4.0 e profundidade 5.0 do próprio preset', () => {
  const c = Manifold.cube([40, 40, 10])
  const ctx = ctxCom(new Map([['c', c]]))
  const delta = executaFuro(furo({ preset: 'M3', inserto: true }), ctx)
  const h = volCil(2, 5)
  confere(delta, 'c', 16000 - h, 0.005 * h, [0, 0, 0], [40, 40, 10])
  liberaDelta(delta); ctx.lixo.limpa(); c.delete()
})

test('compensação 0,2 em M3 passante: diâmetro 3.6', () => {
  const c = Manifold.cube([40, 40, 10])
  const ctx = ctxCom(new Map([['c', c]]))
  const delta = executaFuro(furo({ preset: 'M3', compensacao: 0.2 }), ctx)
  const h = volCil(1.8, 10)
  confere(delta, 'c', 16000 - h, 0.003 * h, [0, 0, 0], [40, 40, 10])
  liberaDelta(delta); ctx.lixo.limpa(); c.delete()
})

test('4 posições: remove 4 vezes o volume de um furo', () => {
  const c = Manifold.cube([40, 40, 10])
  const ctx = ctxCom(new Map([['c', c]]))
  const delta = executaFuro(furo({ diametro: 5, posicoes: [[10, 10], [30, 10], [10, 30], [30, 30]] }), ctx)
  const h = 4 * volCil(2.5, 10)
  confere(delta, 'c', 16000 - h, 0.003 * h, [0, 0, 0], [40, 40, 10])
  liberaDelta(delta); ctx.lixo.limpa(); c.delete()
})

test('furo fora do corpo: ErroFeature', () => {
  const c = Manifold.cube([40, 40, 10])
  const ctx = ctxCom(new Map([['c', c]]))
  assert.throws(() => executaFuro(furo({ diametro: 5, posicoes: [[100, 100]] }), ctx), ErroFeature)
  ctx.lixo.limpa(); c.delete()
})

test('sem diâmetro nem preset: ErroFeature', () => {
  const c = Manifold.cube([40, 40, 10])
  const ctx = ctxCom(new Map([['c', c]]))
  assert.throws(() => executaFuro(furo({}), ctx), ErroFeature)
  ctx.lixo.limpa(); c.delete()
})

test('sem posições: ErroFeature', () => {
  const c = Manifold.cube([40, 40, 10])
  const ctx = ctxCom(new Map([['c', c]]))
  assert.throws(() => executaFuro(furo({ diametro: 5, posicoes: [] }), ctx), ErroFeature)
  ctx.lixo.limpa(); c.delete()
})
