import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { SketchFeature } from '@3dm/core/sketch'
import { criaSessao } from '../src/headless.ts'
import { toolsSketch } from '../src/tools-sketch.ts'
import type { Sessao } from '../src/sessao.ts'

const tool = (nome: string) => {
  const t = toolsSketch.find((x) => x.nome === nome)
  if (!t) throw new Error(`tool ausente: ${nome}`)
  return t
}
const novaSessao = (): Sessao => criaSessao(mkdtempSync(path.join(os.tmpdir(), 'sketch-')))
const sketch = (s: Sessao, id: string) => s.doc.features.find((f) => f.id === id) as SketchFeature

test('sketch_criar cria o sketch XY com id sk1', () => {
  const s = novaSessao()
  assert.deepEqual(tool('sketch_criar').executa(s, { plano: 'XY' }), { ok: true, sketch: 'sk1' })
})

test('sketch_adicionar cria retângulo 80x50: 1 perfil, 4 linhas e 4 pontos novos', () => {
  const s = novaSessao()
  tool('sketch_criar').executa(s, { plano: 'XY' })
  const r = tool('sketch_adicionar').executa(s, { sketch: 'sk1', entidades: [{ tipo: 'retangulo', x: 0, y: 0, largura: 80, altura: 50 }] }) as { perfis: number; itens: { ids: string[] }[] }
  assert.equal(r.perfis, 1)
  assert.equal(r.itens[0].ids.length, 8)
  const sk = sketch(s, 'sk1')
  assert.equal(sk.entidades.filter((e) => e.tipo === 'linha').length, 4)
  assert.equal(sk.entidades.filter((e) => e.tipo === 'ponto').length, 5) // p0 da origem + 4 cantos
})

test('sketch_restringir distancia sem expr lança', () => {
  const s = novaSessao()
  tool('sketch_criar').executa(s, { plano: 'XY' })
  tool('sketch_adicionar').executa(s, { sketch: 'sk1', entidades: [{ tipo: 'linha', x1: 0, y1: 0, x2: 50, y2: 0 }] })
  assert.throws(() => tool('sketch_restringir').executa(s, { sketch: 'sk1', restricoes: [{ tipo: 'distancia', e: ['p1', 'p2'] }] }), /precisa de expr/)
})

test('sketch_restringir fixa + distancia 80 deixa a distância entre os pontos em 80', () => {
  const s = novaSessao()
  tool('sketch_criar').executa(s, { plano: 'XY' })
  const add = tool('sketch_adicionar').executa(s, { sketch: 'sk1', entidades: [{ tipo: 'linha', x1: 0, y1: 0, x2: 50, y2: 0 }] }) as { itens: { ids: string[] }[] }
  const [pa, pb] = add.itens[0].ids
  tool('sketch_restringir').executa(s, {
    sketch: 'sk1',
    restricoes: [
      { tipo: 'fixa', e: [pa], xy: [0, 0] },
      { tipo: 'distancia', e: [pa, pb], expr: '80' },
    ],
  })
  const pts = sketch(s, 'sk1').entidades.filter((e) => e.tipo === 'ponto') as { id: string; x: number; y: number }[]
  const a = pts.find((p) => p.id === pa)!, b = pts.find((p) => p.id === pb)!
  assert.ok(Math.abs(Math.hypot(b.x - a.x, b.y - a.y) - 80) < 1e-6, `distância = ${Math.hypot(b.x - a.x, b.y - a.y)}`)
})

test('desfaz remove o retângulo adicionado', () => {
  const s = novaSessao()
  tool('sketch_criar').executa(s, { plano: 'XY' })
  tool('sketch_adicionar').executa(s, { sketch: 'sk1', entidades: [{ tipo: 'retangulo', x: 0, y: 0, largura: 80, altura: 50 }] })
  assert.equal(s.desfaz(), 'ADICIONAR')
  assert.equal(sketch(s, 'sk1').entidades.length, 1) // só a origem p0
})

test('fillet_sketch entre duas linhas de um canto cria um arco', () => {
  const s = novaSessao()
  tool('sketch_criar').executa(s, { plano: 'XY' })
  const add = tool('sketch_adicionar').executa(s, { sketch: 'sk1', entidades: [{ tipo: 'retangulo', x: 0, y: 0, largura: 80, altura: 50 }] }) as { itens: { ids: string[] }[] }
  const [, , , , base, , , esquerda] = add.itens[0].ids
  const r = tool('fillet_sketch').executa(s, { sketch: 'sk1', linha1: base, linha2: esquerda, raio: 5 }) as { arco: string }
  assert.ok(r.arco)
  assert.equal(sketch(s, 'sk1').entidades.filter((e) => e.tipo === 'arco').length, 1)
})

test('sketch inexistente lança erro', () => {
  const s = novaSessao()
  assert.throws(() => tool('sketch_adicionar').executa(s, { sketch: 'sk9', entidades: [{ tipo: 'ponto', x: 0, y: 0 }] }), /não existe/)
})
