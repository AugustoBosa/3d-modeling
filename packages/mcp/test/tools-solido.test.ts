import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { definirParametro } from '@3dm/core/doc'
import { bbox, fechada, volume } from '@3dm/core/malha'
import { criaSessao } from '../src/headless.ts'
import { regenera } from '../src/modelo.ts'
import type { Sessao } from '../src/sessao.ts'
import { toolsSketch } from '../src/tools-sketch.ts'
import { toolsSolido } from '../src/tools-solido.ts'
import type { Tool } from '../src/tool.ts'

const achaTool = (lista: Tool[], nome: string) => {
  const t = lista.find((x) => x.nome === nome)
  if (!t) throw new Error(`tool ausente: ${nome}`)
  return t
}
const tool = (nome: string) => achaTool([...toolsSolido, ...toolsSketch], nome)
const novaSessao = (): Sessao => criaSessao(mkdtempSync(path.join(os.tmpdir(), 'solido-')))
const corpo = (s: Sessao, id: string) => {
  const m = regenera(s).corpos.get(id)
  if (!m) throw new Error(`corpo ausente: ${id}`)
  return m
}
/** Sketch retangular 40x30 em sk1 (XY). */
const retangulo = (s: Sessao) => {
  tool('sketch_criar').executa(s, { plano: 'XY' })
  tool('sketch_adicionar').executa(s, { sketch: 'sk1', entidades: [{ tipo: 'retangulo', x: 0, y: 0, largura: 40, altura: 30 }] })
}

test('primitiva caixa [10,20,30] vira o corpo cx1 de volume 6000, fechado', () => {
  const s = novaSessao()
  const r = tool('primitiva').executa(s, { tipo: 'caixa', dim: [10, 20, 30] }) as { id: string; ok: boolean }
  assert.equal(r.id, 'cx1')
  assert.equal(r.ok, true)
  const m = corpo(s, 'cx1')
  assert.equal(Math.round(volume(m)), 6000)
  assert.ok(fechada(m))
})

test('extrudar 10 do retângulo 40x30 gera volume 12000 e z de 0 a 10', () => {
  const s = novaSessao()
  retangulo(s)
  const r = tool('extrudar').executa(s, { sketch: 'sk1', distancia: 10 }) as { id: string }
  const m = corpo(s, r.id)
  assert.ok(Math.abs(volume(m) - 12000) < 1, `volume = ${volume(m)}`)
  const b = bbox(m)
  assert.ok(Math.abs(b.min[2]) < 1e-6 && Math.abs(b.max[2] - 10) < 1e-6)
})

test('extrudar aceita expressão de parâmetro: H = 7 dá altura 7', () => {
  const s = novaSessao()
  retangulo(s)
  s.executa(definirParametro('H', '7'))
  const r = tool('extrudar').executa(s, { sketch: 'sk1', distancia: 'H' }) as { id: string }
  assert.ok(Math.abs(bbox(corpo(s, r.id)).max[2] - 7) < 1e-6)
})

test('shell aberto no topo reduz o volume da caixa', () => {
  const s = novaSessao()
  tool('primitiva').executa(s, { tipo: 'caixa', dim: [10, 20, 30] })
  tool('shell').executa(s, { alvo: 'cx1', espessura: 2, abrir: ['topo'] })
  const v = volume(corpo(s, 'cx1'))
  assert.ok(v < 6000 - 1000 && v > 0, `volume = ${v}`)
})

test('shell oco e sem faces abertas continua fechado e com volume menor', () => {
  const s = novaSessao()
  tool('primitiva').executa(s, { tipo: 'caixa', dim: [10, 20, 30] })
  tool('shell').executa(s, { alvo: 'cx1', espessura: 2, abrir: [] })
  const m = corpo(s, 'cx1')
  assert.ok(volume(m) < 6000)
  assert.ok(fechada(m))
})

test('booleana subtrai um cilindro atravessando a caixa', () => {
  const s = novaSessao()
  tool('primitiva').executa(s, { tipo: 'caixa', dim: [40, 40, 10] })
  tool('primitiva').executa(s, { tipo: 'cilindro', dim: [5, 20], pos: [20, 20, -5] })
  tool('booleana').executa(s, { op: 'subtrair', alvo: 'cx1', ferramentas: ['ci1'] })
  const v = volume(corpo(s, 'cx1'))
  const esperado = 16000 - Math.PI * 25 * 10
  assert.ok(Math.abs(v - esperado) < 20, `volume = ${v}, esperado ~${esperado}`)
})

test('furo M3 no topo reduz o volume da caixa e mantém fechado', () => {
  const s = novaSessao()
  tool('primitiva').executa(s, { tipo: 'caixa', dim: [40, 40, 10] })
  const antes = volume(corpo(s, 'cx1'))
  tool('furo').executa(s, {
    plano: { origem: [0, 0, 5], normal: [0, 0, 1], eixoX: [1, 0, 0] },
    posicoes: [[0, 0]],
    preset: 'M3',
    alvo: 'cx1',
  })
  const m = corpo(s, 'cx1')
  assert.ok(volume(m) < antes)
  assert.ok(fechada(m))
})

test('padrao linear n=3 com passo 10 triplica a largura em x', () => {
  const s = novaSessao()
  tool('primitiva').executa(s, { tipo: 'caixa', dim: [10, 10, 10] })
  tool('padrao').executa(s, { alvo: 'cx1', modo: 'linear', n: 3, dir: [1, 0, 0], passo: 10 })
  const b = bbox(corpo(s, 'cx1'))
  assert.ok(Math.abs((b.max[0] - b.min[0]) - 30) < 1e-6, `largura x = ${b.max[0] - b.min[0]}`)
})

test('espelhar caixa afastada da origem une o original e o espelho', () => {
  const s = novaSessao()
  tool('primitiva').executa(s, { tipo: 'caixa', dim: [10, 20, 30], pos: [20, 0, 0] })
  tool('espelhar').executa(s, { alvo: 'cx1', plano: { origem: [0, 0, 0], normal: [1, 0, 0], eixoX: [0, 1, 0] } })
  const m = corpo(s, 'cx1')
  assert.ok(Math.abs(volume(m) - 12000) < 1, `volume = ${volume(m)}`)
  assert.ok(bbox(m).min[0] < 0)
})

test('chanfro na borda do extrude reduz o volume sem erro de regeneração', () => {
  const s = novaSessao()
  retangulo(s)
  tool('extrudar').executa(s, { sketch: 'sk1', distancia: 10 })
  tool('chanfro').executa(s, { feature: 'ex1', tamanho: 1 })
  const r = regenera(s)
  assert.notEqual(r.status.get('ex1')?.estado, 'erro')
  const v = volume(corpo(s, 'ex1'))
  assert.ok(v < 12000 && v > 11800, `volume = ${v}`)
})

test('chanfro em feature que não é extrude lança Error com correção', () => {
  const s = novaSessao()
  tool('primitiva').executa(s, { tipo: 'caixa', dim: [10, 20, 30] })
  assert.throws(() => tool('chanfro').executa(s, { feature: 'cx1', tamanho: 1 }), /features_listar/)
})

test('feature inválida (cilindro dim [0,10]) lança Error com Correção e não altera o projeto', () => {
  const s = novaSessao()
  tool('primitiva').executa(s, { tipo: 'caixa', dim: [10, 20, 30] })
  const antes = JSON.stringify(s.doc.features)
  assert.throws(
    () => tool('primitiva').executa(s, { tipo: 'cilindro', dim: [0, 10] }),
    (e: Error) => e.message.includes('Correção'),
  )
  assert.equal(JSON.stringify(s.doc.features), antes)
})

test('primitiva com número errado de dim lança Error explicando a forma', () => {
  const s = novaSessao()
  assert.throws(() => tool('primitiva').executa(s, { tipo: 'cilindro', dim: [5] }), /primitiva "cilindro" precisa de dim=\[raio, altura\]/)
})

test('feature_editar muda a distância do extrude e o volume', () => {
  const s = novaSessao()
  retangulo(s)
  tool('extrudar').executa(s, { sketch: 'sk1', distancia: 10 })
  tool('feature_editar').executa(s, { id: 'ex1', campos: { distancia: 20 } })
  assert.ok(Math.abs(volume(corpo(s, 'ex1')) - 24000) < 1)
})

test('feature_apagar remove a feature e s.desfaz() a restaura', () => {
  const s = novaSessao()
  retangulo(s)
  tool('extrudar').executa(s, { sketch: 'sk1', distancia: 10 })
  const r = tool('feature_apagar').executa(s, { id: 'ex1' }) as { removida: string }
  assert.equal(r.removida, 'ex1')
  assert.ok(!s.doc.features.some((f) => f.id === 'ex1'))
  s.desfaz()
  assert.ok(s.doc.features.some((f) => f.id === 'ex1'))
})
