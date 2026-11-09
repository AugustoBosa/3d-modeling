import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { bbox, fechada } from '@3dm/core/malha'
import { sketchResolvido } from '@3dm/core/sketch'
import { criaSessao } from '../src/headless.ts'
import { regenera } from '../src/modelo.ts'
import type { Sessao } from '../src/sessao.ts'
import type { Tool } from '../src/tool.ts'
import { toolsF3b2 } from '../src/tools-f3b2.ts'

const pasta = () => mkdtempSync(path.join(os.tmpdir(), 'f3b2-'))
const nova = (): Sessao => criaSessao(pasta())

const chama = async (nome: string, s: Sessao, args: Record<string, unknown>): Promise<any> =>
  (toolsF3b2 as Tool[]).find(t => t.nome === nome)!.executa(s, args)

const RETANGULO = '<svg xmlns="http://www.w3.org/2000/svg" width="20mm" height="10mm" viewBox="0 0 20 10"><rect x="0" y="0" width="20" height="10"/></svg>'

test('importar_svg de retângulo gera 1 contorno, 1 perfil e largura 20', async () => {
  const s = nova()
  const r = await chama('importar_svg', s, { svg: RETANGULO, plano: 'XY' })
  assert.equal(r.ok, true)
  assert.equal(r.contornos, 1)
  assert.equal(r.perfis, 1)
  assert.ok(Math.abs(r.largura - 20) < 0.01)
})

test('importar_svg com escala 2 dobra as coordenadas do sketch', async () => {
  const s = nova()
  const r = await chama('importar_svg', s, { svg: RETANGULO, plano: 'XY', escala: 2 })
  const xs = sketchResolvido(s.doc, r.sketch)!.sk.entidades.flatMap(e => (e.tipo === 'ponto' ? [e.x] : []))
  assert.equal(Math.max(...xs), 40)
})

test('importar_svg por caminho relativo lê o arquivo da pasta do projeto', async () => {
  const dir = pasta()
  writeFileSync(path.join(dir, 'peca.svg'), RETANGULO)
  const s = criaSessao(dir)
  const r = await chama('importar_svg', s, { svg: 'peca.svg', plano: 'XY' })
  assert.equal(r.contornos, 1)
  await assert.rejects(chama('importar_svg', s, { svg: 'nao-existe.svg', plano: 'XY' }), /Correção/)
})

test('importar_svg rejeita caminho que sai da pasta do projeto', async () => {
  await assert.rejects(chama('importar_svg', nova(), { svg: '../fora.svg', plano: 'XY' }), /fora da pasta/)
})

test('importar_svg rejeita SVG sem formas fechadas', async () => {
  const vazio = '<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm" viewBox="0 0 10 10"></svg>'
  await assert.rejects(chama('importar_svg', nova(), { svg: vazio, plano: 'XY' }), /não tem contornos fechados.*Correção/)
})

test('texto_3d Oi gera corpo fechado com espessura 2', async () => {
  const s = nova()
  const r = await chama('texto_3d', s, { texto: 'Oi', tamanho: 10, espessura: 2 })
  assert.equal(r.ok, true)
  const malha = regenera(s).corpos.get(r.id)!
  assert.ok(malha, 'corpo da extrusão existe')
  assert.ok(fechada(malha))
  const b = bbox(malha)
  assert.ok(Math.abs(b.max[2] - b.min[2] - 2) < 0.01)
})

test('texto_3d com posicao [5,5] desloca o corpo em x e y', async () => {
  const a = nova()
  const b = nova()
  const ra = await chama('texto_3d', a, { texto: 'Oi', tamanho: 10, espessura: 2 })
  const rb = await chama('texto_3d', b, { texto: 'Oi', tamanho: 10, espessura: 2, posicao: [5, 5] })
  const ba = bbox(regenera(a).corpos.get(ra.id)!)
  const bb = bbox(regenera(b).corpos.get(rb.id)!)
  assert.ok(Math.abs(bb.min[0] - ba.min[0] - 5) < 0.01)
  assert.ok(Math.abs(bb.min[1] - ba.min[1] - 5) < 0.01)
})

test('texto_3d com só espaços rejeita', async () => {
  await assert.rejects(chama('texto_3d', nova(), { texto: '   ', tamanho: 10, espessura: 2 }), /texto vazio/)
})

test('texto_3d desfeito duas vezes volta a zero features', async () => {
  const s = nova()
  await chama('texto_3d', s, { texto: 'Oi', tamanho: 10, espessura: 2 })
  assert.equal(s.doc.features.length, 2)
  s.desfaz()
  s.desfaz()
  assert.equal(s.doc.features.length, 0)
})
