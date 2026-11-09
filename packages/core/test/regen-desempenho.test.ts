import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Regenerador } from '../src/regen/index.ts'
import type { EntradaRegen, ItemRegen, ResultadoRegen } from '../src/regen/index.ts'
import type { Perfil, PlanoLocal } from '../src/kernel/index.ts'
import { fechada } from '../src/malha/index.ts'

const PLANO_BASE: PlanoLocal = { origem: [0, 0, 0], normal: [0, 0, 1], eixoX: [1, 0, 0] }
// Furos no fundo: face em z=2 (espessura do fundo da casca), normal +Z, entram para baixo.
const PLANO_FUNDO: PlanoLocal = { origem: [0, 0, 2], normal: [0, 0, 1], eixoX: [1, 0, 0] }
const IDS = ['sk', 'base', 'casca', 'f1', 'f2', 'f3', 'f4', 'pino', 'pino2', 'pad', 'esp', 'uniao']

/** Peça: retângulo L x 50 extrudado 30, casca aberta no topo, 4 furos, 2 pinos, padrão, espelho e união. */
function entrada(larg = 80, manter = false): EntradaRegen {
  const retangulo: Perfil = { externo: [[0, 0], [larg, 0], [larg, 50], [0, 50]], furos: [] }
  const features: ItemRegen[] = [
    { id: 'sk', tipo: 'sketch' },
    { id: 'base', tipo: 'extrude', sketch: 'sk', distancia: 30 },
    { id: 'casca', tipo: 'shell', alvo: 'base', espessura: 2, abrir: ['topo'] },
    { id: 'f1', tipo: 'furo', alvo: 'base', plano: PLANO_FUNDO, posicoes: [[10, 10]], tipoFuro: 'rebaixado', diametro: 3.4, profundidade: 2.5 },
    { id: 'f2', tipo: 'furo', alvo: 'base', plano: PLANO_FUNDO, posicoes: [[70, 10]], tipoFuro: 'simples', diametro: 3.4, profundidade: 2.5 },
    { id: 'f3', tipo: 'furo', alvo: 'base', plano: PLANO_FUNDO, posicoes: [[10, 40]], tipoFuro: 'escareado', diametro: 3.4, profundidade: 2.5 },
    { id: 'f4', tipo: 'furo', alvo: 'base', plano: PLANO_FUNDO, posicoes: [[70, 40]], tipoFuro: 'simples', diametro: 3.4, profundidade: 2.5 },
    { id: 'pino', tipo: 'cilindro', pos: [40, 25, 2], dim: [4, 12] },
    { id: 'pino2', tipo: 'cilindro', pos: [20, 25, 2], dim: [3, 12] },
    { id: 'pad', tipo: 'padrao', modo: 'linear', n: 5, dir: [1, 0, 0], passo: 8, alvo: 'pino' },
    { id: 'esp', tipo: 'espelho', alvo: 'pino', plano: { origem: [40, 0, 0], normal: [1, 0, 0], eixoX: [0, 1, 0] }, manter: true },
    { id: 'uniao', tipo: 'booleana', op: 'unir', alvo: 'base', ferramentas: ['pino', 'pino2'], manter },
  ]
  return { features, marcador: null, resolvedor: () => [retangulo], planoDe: () => PLANO_BASE }
}

function mediana(v: number[]): number {
  const s = [...v].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function ok(r: ResultadoRegen, msg: string): void {
  for (const id of IDS) assert.equal(r.status.get(id)?.estado, 'ok', `${msg}: ${id}`)
}

/** Aquece `aquece` vezes e mede `n` regenerações; `gera(k)` devolve a entrada da rodada k. */
function rodadas(reg: Regenerador, gera: (k: number) => EntradaRegen, aquece: number, n: number) {
  for (let k = 0; k < aquece; k++) reg.regenera(gera(k))
  const tempos: number[] = []
  const resultados: ResultadoRegen[] = []
  for (let k = aquece; k < aquece + n; k++) {
    const e = gera(k)
    const t0 = performance.now()
    const r = reg.regenera(e)
    tempos.push(performance.now() - t0)
    resultados.push(r)
  }
  return { mediana: mediana(tempos), tempos, resultados }
}

test('desempenho: regeneração de peça de 12 features (Node)', () => {
  // (a) regeneração fria: primeira chamada em regenerador vazio
  const regA = new Regenerador()
  const t0 = performance.now()
  const fria = regA.regenera(entrada(80, false))
  const a = performance.now() - t0
  regA.dispose()

  // (b) pior caso: L 80 <-> 81 alternando (recalcula tudo a partir de 'base')
  const regB = new Regenerador()
  regB.regenera(entrada(80, false))
  const b = rodadas(regB, (k) => entrada(k % 2 === 0 ? 81 : 80, false), 3, 10)
  regB.dispose()

  // (c) só a última feature muda: manter da 'uniao' alternando true/false
  const regC = new Regenerador()
  regC.regenera(entrada(80, false))
  const c = rodadas(regC, (k) => entrada(80, k % 2 === 0), 3, 10)
  regC.dispose()

  // (d) sem mudança
  const regD = new Regenerador()
  regD.regenera(entrada(80, false))
  const d = rodadas(regD, () => entrada(80, false), 3, 10)
  regD.dispose()

  const fmt = (x: number) => x.toFixed(2)
  console.log(`(a) regeneração fria (1ª): ${fmt(a)} ms`)
  console.log(`(b) muda 1ª feature (L 80<->81), mediana de 10: ${fmt(b.mediana)} ms`)
  console.log(`    amostras (b): ${b.tempos.map(fmt).join(', ')}`)
  console.log(`(c) muda última feature, mediana de 10: ${fmt(c.mediana)} ms`)
  console.log(`    amostras (c): ${c.tempos.map(fmt).join(', ')}`)
  console.log(`(d) sem mudança, mediana de 10: ${fmt(d.mediana)} ms`)
  console.log(`    amostras (d): ${d.tempos.map(fmt).join(', ')}`)

  // Asserts (depois de imprimir, para que os números sempre apareçam)
  ok(fria, 'fria')
  assert.deepEqual(fria.recalculadas, IDS)
  assert.ok(fechada(fria.corpos.get('base')!), "malha de 'base' não está fechada")

  for (const r of b.resultados) {
    ok(r, 'b')
    assert.deepEqual(r.recalculadas, IDS.slice(1))
  }
  for (const r of c.resultados) {
    ok(r, 'c')
    assert.deepEqual(r.recalculadas, ['uniao'])
  }
  for (const r of d.resultados) {
    ok(r, 'd')
    assert.deepEqual(r.recalculadas, [])
  }

  assert.ok(b.mediana <= 300, `(b) mediana ${fmt(b.mediana)} ms > 300 ms`)
  assert.ok(c.mediana < b.mediana, `(c) ${fmt(c.mediana)} ms não é menor que (b) ${fmt(b.mediana)} ms`)
  assert.ok(d.mediana < 20, `(d) mediana ${fmt(d.mediana)} ms >= 20 ms`)
})
