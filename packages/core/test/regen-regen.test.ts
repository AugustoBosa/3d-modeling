import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Regenerador } from '../src/regen/index.ts'
import type { EntradaRegen, ResultadoRegen } from '../src/regen/index.ts'
import type { FFuro } from '../src/features/index.ts'
import type { Perfil, PlanoLocal } from '../src/kernel/index.ts'
import { volume } from '../src/malha/index.ts'

const PLANO_BASE: PlanoLocal = { origem: [0, 0, 0], normal: [0, 0, 1], eixoX: [1, 0, 0] }
const PLANO_TOPO: PlanoLocal = { origem: [0, 0, 10], normal: [0, 0, 1], eixoX: [1, 0, 0] }

const VOL_BASE = 40 * 30 * 10
const VOL_FURO = Math.PI * 2.5 ** 2 * 10 // d=5 em 10 mm; a malha inscrita tira ~0,5 % a menos
const VOL_CIL = 3 * Math.PI * 5 ** 2 * 10 // três cilindros r=5 h=10 (padrão linear)

function furoBase(extra: Partial<FFuro> = {}): FFuro {
  return { id: 'furo1', tipo: 'furo', plano: PLANO_TOPO, posicoes: [[10, 10]], tipoFuro: 'simples', diametro: 5, ...extra }
}

interface Opts { larg?: number; furo?: Partial<FFuro>; marcador?: string | null }

function entrada(o: Opts = {}): EntradaRegen {
  const larg = o.larg ?? 40
  const retangulo: Perfil = { externo: [[0, 0], [larg, 0], [larg, 30], [0, 30]], furos: [] }
  return {
    features: [
      { id: 'sk', tipo: 'sketch' },
      { id: 'base', tipo: 'extrude', sketch: 'sk', distancia: 10 },
      furoBase(o.furo),
      { id: 'cil', tipo: 'cilindro', pos: [100, 0, 0], dim: [5, 10] },
      { id: 'pad', tipo: 'padrao', modo: 'linear', n: 3, dir: [0, 1, 0], passo: 20, alvo: 'cil' },
    ],
    marcador: o.marcador ?? null,
    resolvedor: () => [retangulo],
    planoDe: () => PLANO_BASE,
  }
}

function estado(r: ResultadoRegen, id: string): string | undefined {
  return r.status.get(id)?.estado
}

test('1: primeira regeneração executa tudo e gera base e cil', () => {
  const reg = new Regenerador()
  const r = reg.regenera(entrada())
  assert.deepEqual(r.recalculadas, ['sk', 'base', 'furo1', 'cil', 'pad'])
  for (const id of ['sk', 'base', 'furo1', 'cil', 'pad']) assert.equal(estado(r, id), 'ok', id)
  assert.ok(Math.abs(volume(r.corpos.get('base')!) - (VOL_BASE - VOL_FURO)) <= 0.003 * VOL_BASE)
  assert.ok(Math.abs(volume(r.corpos.get('cil')!) - VOL_CIL) <= 0.02 * VOL_CIL)
  assert.ok(r.ms >= 0)
  reg.dispose()
})

test('2: regenerar sem mudança não recalcula nada', () => {
  const reg = new Regenerador()
  reg.regenera(entrada())
  const r = reg.regenera(entrada())
  assert.deepEqual(r.recalculadas, [])
  assert.equal(estado(r, 'pad'), 'ok')
  assert.ok(r.corpos.has('base') && r.corpos.has('cil'))
  reg.dispose()
})

test('3: mudar o diâmetro recalcula da feature alterada em diante', () => {
  const reg = new Regenerador()
  reg.regenera(entrada())
  const r = reg.regenera(entrada({ furo: { diametro: 6 } }))
  assert.deepEqual(r.recalculadas, ['furo1', 'cil', 'pad'])
  assert.ok(!r.recalculadas.includes('sk') && !r.recalculadas.includes('base'))
  reg.dispose()
})

test('4: mudar o perfil do sketch recalcula de base em diante', () => {
  const reg = new Regenerador()
  reg.regenera(entrada())
  const r = reg.regenera(entrada({ larg: 50 }))
  assert.deepEqual(r.recalculadas, ['base', 'furo1', 'cil', 'pad'])
  assert.ok(Math.abs(volume(r.corpos.get('base')!) - (50 * 30 * 10 - VOL_FURO)) <= 0.003 * 50 * 30 * 10)
  reg.dispose()
})

test('5: erro suspende o resto; corrigir restaura tudo', () => {
  const reg = new Regenerador()
  reg.regenera(entrada())
  const r = reg.regenera(entrada({ furo: { posicoes: [[500, 500]] } }))
  const erro = r.status.get('furo1')?.erro
  assert.equal(estado(r, 'furo1'), 'erro')
  assert.ok(erro && erro.causa.length > 0 && erro.correcao.length > 0)
  assert.equal(estado(r, 'cil'), 'suspensa')
  assert.equal(estado(r, 'pad'), 'suspensa')
  assert.equal(estado(r, 'base'), 'ok')
  assert.deepEqual([...r.corpos.keys()], ['base'])
  assert.ok(Math.abs(volume(r.corpos.get('base')!) - VOL_BASE) < 1e-3 * VOL_BASE)

  const fix = reg.regenera(entrada())
  assert.deepEqual(fix.recalculadas, ['furo1', 'cil', 'pad'])
  for (const id of ['sk', 'base', 'furo1', 'cil', 'pad']) assert.equal(estado(fix, id), 'ok', id)
  reg.dispose()
})

test('6: marcador revert as features depois dele; null restaura tudo', () => {
  const reg = new Regenerador()
  reg.regenera(entrada())
  const r = reg.regenera(entrada({ marcador: 'furo1' }))
  assert.equal(estado(r, 'furo1'), 'ok')
  assert.equal(estado(r, 'cil'), 'revertida')
  assert.equal(estado(r, 'pad'), 'revertida')
  assert.deepEqual([...r.corpos.keys()], ['base'])

  const todos = reg.regenera(entrada())
  assert.deepEqual(todos.recalculadas, ['cil', 'pad'])
  for (const id of ['sk', 'base', 'furo1', 'cil', 'pad']) assert.equal(estado(todos, id), 'ok', id)
  assert.ok(todos.corpos.has('cil'))
  reg.dispose()
})

test('7: feature suprimida não executa e as seguintes seguem', () => {
  const reg = new Regenerador()
  const r = reg.regenera(entrada({ furo: { suprimida: true } }))
  assert.equal(estado(r, 'furo1'), 'suprimida')
  assert.ok(Math.abs(volume(r.corpos.get('base')!) - VOL_BASE) < 1e-3 * VOL_BASE)
  assert.equal(estado(r, 'cil'), 'ok')
  assert.equal(estado(r, 'pad'), 'ok')
  reg.dispose()
})

test('8: 100 regenerações com recálculo não crescem a memória', () => {
  const reg = new Regenerador()
  const gc = (globalThis as { gc?: () => void }).gc
  const passo = (k: number): ResultadoRegen => reg.regenera(entrada({ furo: { diametro: k % 2 ? 6 : 5 } }))

  for (let k = 0; k < 20; k++) passo(k)
  gc?.()
  const antes = process.memoryUsage()

  let ultimo: ResultadoRegen | undefined
  for (let k = 20; k < 120; k++) ultimo = passo(k)
  gc?.()
  const depois = process.memoryUsage()

  assert.ok(ultimo && ultimo.recalculadas.includes('furo1'))
  const dAB = depois.arrayBuffers - antes.arrayBuffers
  const dRss = depois.rss - antes.rss
  console.log(`memoria: arrayBuffers ${antes.arrayBuffers} -> ${depois.arrayBuffers} (delta ${dAB} bytes); rss delta ${dRss} bytes; gc ${gc ? 'sim' : 'nao'}`)
  assert.ok(dAB < 2 * 1024 * 1024, `arrayBuffers cresceu ${dAB} bytes`)
  reg.dispose()
})
