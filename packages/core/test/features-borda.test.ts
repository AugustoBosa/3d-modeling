import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extrudeComBorda } from '../src/features/borda.ts'
import { ErroFeature } from '../src/features/tipos.ts'
import type { BordaExtrude, Ctx } from '../src/features/tipos.ts'
import type { Perfil, Vec2 } from '../src/kernel/tipos.ts'
import { criaLixo, malhaDe } from '../src/kernel/index.ts'
import { bbox, fechada, volume } from '../src/malha/index.ts'

const retangulo = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
const quadrado = (lado: number): Perfil => ({ externo: retangulo(0, 0, lado, lado), furos: [] })

function ctxNovo(): Ctx {
  return { corpos: new Map(), perfis: () => [], lixo: criaLixo(), tol: 0.05 }
}

/** Volume removido por UMA face (integral com ponto médio, 100000 passos): ∫0^r (L² - (L - 2·recuo(t))²) dt. */
function perdaFace(lado: number, r: number, modo: BordaExtrude['modo'], passos = 100000): number {
  const h = r / passos
  let soma = 0
  for (let i = 0; i < passos; i++) {
    const t = (i + 0.5) * h
    const rec = modo === 'chanfro' ? r - t : r - Math.sqrt(r * r - (r - t) * (r - t))
    const l2 = lado - 2 * rec
    soma += (lado * lado - l2 * l2) * h
  }
  return soma
}

/** Roda a feature, mede o tempo e devolve a malha. Registrado no lixo do ctx: não precisa liberar. */
function roda(perfis: Perfil[], altura: number, borda: BordaExtrude, ctx: Ctx) {
  ctx.perfis = () => perfis
  const t0 = performance.now()
  const m = extrudeComBorda(perfis, altura, borda, ctx)
  const ms = performance.now() - t0
  const malha = malhaDe(m)
  return { malha, ms, tris: malha.triVerts.length / 3 }
}

const erroRel = (obtido: number, esperado: number) => Math.abs(obtido - esperado) / esperado

test('chanfro 2 no topo de quadrado 20x20 h10: volume = 4000 - perda, erro <= 1%', () => {
  const ctx = ctxNovo()
  const r = roda([quadrado(20)], 10, { modo: 'chanfro', tamanho: 2, onde: 'topo' }, ctx)
  const esperado = 4000 - perdaFace(20, 2, 'chanfro')
  const v = volume(r.malha)
  const e = erroRel(v, esperado)
  console.log(`chanfro topo 2: V=${v.toFixed(3)} esperado=${esperado.toFixed(3)} erro=${(e * 100).toFixed(3)}% (da perda: ${(Math.abs(v - esperado) / perdaFace(20, 2, 'chanfro') * 100).toFixed(2)}%) tris=${r.tris} ms=${r.ms.toFixed(1)}`)
  assert.ok(e <= 0.01, `erro ${e}`)
  const b = bbox(r.malha)
  assert.ok(Math.abs(b.min[2]) < 1e-6 && Math.abs(b.max[2] - 10) < 1e-6)
  assert.equal(fechada(r.malha), true)
  ctx.lixo.limpa()
})

test('chanfro 2 nas duas bordas (ambas) de quadrado 20x20 h10: erro <= 1%', () => {
  const ctx = ctxNovo()
  const r = roda([quadrado(20)], 10, { modo: 'chanfro', tamanho: 2, onde: 'ambas' }, ctx)
  const esperado = 4000 - 2 * perdaFace(20, 2, 'chanfro')
  const v = volume(r.malha)
  const e = erroRel(v, esperado)
  console.log(`chanfro ambas 2: V=${v.toFixed(3)} esperado=${esperado.toFixed(3)} erro=${(e * 100).toFixed(3)}% tris=${r.tris} ms=${r.ms.toFixed(1)}`)
  assert.ok(e <= 0.01, `erro ${e}`)
  const b = bbox(r.malha)
  assert.ok(Math.abs(b.min[2]) < 1e-6 && Math.abs(b.max[2] - 10) < 1e-6)
  assert.equal(fechada(r.malha), true)
  ctx.lixo.limpa()
})

test('fillet 3 no topo de quadrado 30x30 h10: erro <= 1.5%', () => {
  const ctx = ctxNovo()
  const r = roda([quadrado(30)], 10, { modo: 'fillet', tamanho: 3, onde: 'topo' }, ctx)
  const esperado = 9000 - perdaFace(30, 3, 'fillet')
  const v = volume(r.malha)
  const e = erroRel(v, esperado)
  console.log(`fillet topo 3: V=${v.toFixed(3)} esperado=${esperado.toFixed(3)} erro=${(e * 100).toFixed(3)}% (da perda: ${(Math.abs(v - esperado) / perdaFace(30, 3, 'fillet') * 100).toFixed(2)}%) tris=${r.tris} ms=${r.ms.toFixed(1)}`)
  assert.ok(e <= 0.015, `erro ${e}`)
  const b = bbox(r.malha)
  assert.ok(Math.abs(b.min[2]) < 1e-6 && Math.abs(b.max[2] - 10) < 1e-6)
  assert.equal(fechada(r.malha), true)
  ctx.lixo.limpa()
})

test('borda base: bbox z 0..altura e malha fechada', () => {
  const ctx = ctxNovo()
  const r = roda([quadrado(30)], 10, { modo: 'fillet', tamanho: 3, onde: 'base' }, ctx)
  const b = bbox(r.malha)
  assert.ok(Math.abs(b.min[2]) < 1e-6 && Math.abs(b.max[2] - 10) < 1e-6)
  assert.equal(fechada(r.malha), true)
  ctx.lixo.limpa()
})

test('borda >= metade da altura: ErroFeature', () => {
  const ctx = ctxNovo()
  assert.throws(() => roda([quadrado(20)], 10, { modo: 'chanfro', tamanho: 5, onde: 'topo' }, ctx), ErroFeature)
  ctx.lixo.limpa()
})
