import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { z } from 'zod'
import { adicionaFeature } from '@3dm/core/features'
import { definirParametro } from '@3dm/core/doc'
import { criaSessao } from '../src/headless.ts'
import { regenera } from '../src/modelo.ts'
import type { Sessao } from '../src/sessao.ts'
import type { Tool } from '../src/tool.ts'
import { toolsExtra } from '../src/tools-extra.ts'
import { toolsSketch } from '../src/tools-sketch.ts'
import { toolsSolido } from '../src/tools-solido.ts'

const tool = (nome: string): Tool => {
  const t = [...toolsExtra, ...toolsSketch, ...toolsSolido].find((x) => x.nome === nome)
  if (!t) throw new Error(`tool ausente: ${nome}`)
  return t
}
const chama = (s: Sessao, nome: string, args: Record<string, unknown> = {}): any => tool(nome).executa(s, args)
const novaSessao = (): Sessao => criaSessao(mkdtempSync(path.join(os.tmpdir(), 'tools-extra-')))

/** Sketch sk1 com um retângulo 40x30 (XY). */
function retangulo(s: Sessao): void {
  chama(s, 'sketch_criar', { plano: 'XY' })
  chama(s, 'sketch_adicionar', { sketch: 'sk1', entidades: [{ tipo: 'retangulo', x: 0, y: 0, largura: 40, altura: 30 }] })
}
const estado = (s: Sessao): any => chama(s, 'sketch_estado', { sketch: 'sk1' })
const linhas = (e: any): any[] => e.entidades.filter((x: any) => x.tipo === 'linha')
const xsDosPontos = (e: any): number[] => e.entidades.filter((x: any) => x.tipo === 'ponto').map((p: any) => Math.round(p.x))

test('exemplos de todas as tools validam contra o schema de entrada', () => {
  for (const t of toolsExtra) {
    const r = z.object(t.entrada).safeParse(t.exemplo)
    assert.ok(r.success, `exemplo inválido em ${t.nome}`)
  }
})

test('sketch_estado do retângulo: 1 perfil, 4 linhas, sem pontas soltas', () => {
  const s = novaSessao()
  retangulo(s)
  const e = estado(s)
  assert.equal(e.perfis, 1)
  assert.equal(linhas(e).length, 4)
  assert.equal(e.pontasSoltas, 0)
})

test('sketch_editar mover muda as coordenadas e desfazer restaura', () => {
  const s = novaSessao()
  retangulo(s)
  const base = linhas(estado(s))[0].id
  chama(s, 'sketch_editar', { sketch: 'sk1', operacao: 'mover', ids: [base], dx: 10, dy: 0 })
  const movido = xsDosPontos(estado(s))
  assert.ok(movido.includes(10) && movido.includes(50), `xs = ${movido}`)
  s.desfaz()
  const volta = xsDosPontos(estado(s))
  assert.ok(!volta.includes(10) && volta.includes(40), `xs = ${volta}`)
})

test('sketch_editar apagar uma linha deixa pontas soltas', () => {
  const s = novaSessao()
  retangulo(s)
  const base = linhas(estado(s))[0].id
  chama(s, 'sketch_editar', { sketch: 'sk1', operacao: 'apagar', ids: [base] })
  const e = estado(s)
  assert.ok(e.pontasSoltas >= 2, `pontasSoltas = ${e.pontasSoltas}`)
  assert.equal(e.perfis, 0)
})

test('cota: distancia 80 vira 90 pela tool cota', () => {
  const s = novaSessao()
  retangulo(s)
  const base = linhas(estado(s))[0].id
  chama(s, 'sketch_restringir', { sketch: 'sk1', restricoes: [{ tipo: 'distancia', e: [base], expr: '80' }] })
  const cota = estado(s).restricoes.find((r: any) => r.tipo === 'distancia' && r.expr === '80')
  assert.ok(cota, 'cota 80 ausente')
  chama(s, 'sketch_editar', { sketch: 'sk1', operacao: 'cota', restricao: cota.id, expr: '90' })
  const depois = estado(s).restricoes.find((r: any) => r.id === cota.id)
  assert.equal(depois.expr, '90')
})

test('feature_suprimir tira o corpo; desfazer volta', () => {
  const s = novaSessao()
  retangulo(s)
  chama(s, 'extrudar', { sketch: 'sk1', distancia: 10 })
  assert.equal(regenera(s).corpos.size, 1)
  chama(s, 'feature_suprimir', { id: 'ex1' })
  assert.equal(regenera(s).corpos.size, 0)
  s.desfaz()
  assert.equal(regenera(s).corpos.size, 1)
})

test('marcador_mover põe e tira o marcador de histórico', () => {
  const s = novaSessao()
  chama(s, 'primitiva', { tipo: 'caixa', dim: [10, 20, 30] })
  chama(s, 'marcador_mover', { id: 'cx1' })
  assert.equal(s.doc.marcadorHistorico, 'cx1')
  chama(s, 'marcador_mover', { id: null })
  assert.equal(s.doc.marcadorHistorico, null)
})

test('feature_mover reordena a feature para o índice pedido', () => {
  const s = novaSessao()
  chama(s, 'primitiva', { tipo: 'caixa', dim: [10, 20, 30] })
  chama(s, 'sketch_criar', { plano: 'XY' })
  assert.equal(s.doc.features[1].id, 'sk1')
  chama(s, 'feature_mover', { id: 'sk1', indice: 0 })
  assert.equal(s.doc.features[0].id, 'sk1')
})

test('parametro_renomear reescreve a expressão; remover em uso lança; livre remove', () => {
  const s = novaSessao()
  s.executa(definirParametro('L', '40'))
  retangulo(s)
  chama(s, 'extrudar', { sketch: 'sk1', distancia: 'L' })
  chama(s, 'parametro_renomear', { de: 'L', para: 'C' })
  const ex = s.doc.features.find((f) => f.id === 'ex1') as any
  assert.equal(ex.distancia, 'C')
  assert.ok(Object.hasOwn(s.doc.parametros, 'C') && !Object.hasOwn(s.doc.parametros, 'L'))

  assert.throws(() => chama(s, 'parametro_remover', { nome: 'C' }), (err: Error) =>
    err.message.includes('é usado por feature ex1') && err.message.includes('Correção'))

  s.executa(definirParametro('X', '5'))
  chama(s, 'parametro_remover', { nome: 'X' })
  assert.equal(Object.hasOwn(s.doc.parametros, 'X'), false)
})

test('medir: distância, ângulo, raio, volume e área de face', () => {
  const s = novaSessao()
  assert.equal(chama(s, 'medir', { modo: 'distancia', a: [0, 0, 0], b: [3, 4, 12] }).valor, 13)
  assert.equal(chama(s, 'medir', { modo: 'angulo', a: [1, 0, 0], vertice: [0, 0, 0], b: [0, 1, 0] }).valor, 90)
  assert.equal(chama(s, 'medir', { modo: 'raio', pontos: [[5, 0, 0], [0, 5, 0], [-5, 0, 0]] }).valor, 5)
  chama(s, 'primitiva', { tipo: 'caixa', dim: [10, 20, 30] })
  assert.equal(chama(s, 'medir', { modo: 'volume', corpo: 'cx1' }).valor, 6000)
  assert.ok(chama(s, 'medir', { modo: 'area_face', corpo: 'cx1', triangulo: 0 }).valor > 0)
})

test('medir volume de corpo inexistente lista os corpos existentes', () => {
  const s = novaSessao()
  s.executa(adicionaFeature({ id: 'cx1', tipo: 'caixa', pos: [0, 0, 0], dim: [10, 20, 30] } as any))
  assert.throws(() => chama(s, 'medir', { modo: 'volume', corpo: 'zz' }), /Corpos: cx1/)
})
