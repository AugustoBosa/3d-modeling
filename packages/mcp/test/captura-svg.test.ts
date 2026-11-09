import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lerDocumento } from '@3dm/core/doc'
import { entradaDe } from '@3dm/core/features'
import { bbox, fechada } from '@3dm/core/malha'
import { Regenerador } from '@3dm/core/regen'
import { capturaSvg, VISTAS } from '../src/captura-svg.ts'
import type { CorpoCaptura } from '../src/captura-svg.ts'

// Caixa 10×20×30 (deslocada em x por ox), 8 vértices e 12 triângulos anti-horários vistos de fora.
function caixa(ox = 0): CorpoCaptura {
  const x = ox + 10
  const posicoes = new Float32Array([ox, 0, 0, x, 0, 0, x, 20, 0, ox, 20, 0, ox, 0, 30, x, 0, 30, x, 20, 30, ox, 20, 30])
  const indices = new Uint32Array([
    0, 3, 2, 0, 2, 1, // base (-Z)
    4, 5, 6, 4, 6, 7, // topo (+Z)
    0, 1, 5, 0, 5, 4, // frente (-Y)
    2, 3, 7, 2, 7, 6, // fundo (+Y)
    3, 0, 4, 3, 4, 7, // esquerda (-X)
    1, 2, 6, 1, 6, 5, // direita (+X)
  ])
  return { nome: 'caixa', malha: { posicoes, indices } }
}

// Pontos de cada <polygon> como lista plana [x0, y0, x1, y1, ...].
function poligonos(svg: string): number[][] {
  return [...svg.matchAll(/<polygon points="([^"]+)"/g)].map(m => m[1].split(' ').flatMap(p => p.split(',').map(Number)))
}

function extensao(svg: string): { w: number; h: number } {
  const xs: number[] = [], ys: number[] = []
  for (const pts of poligonos(svg)) for (let i = 0; i < pts.length; i += 2) { xs.push(pts[i]); ys.push(pts[i + 1]) }
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
}

test('a caixa de teste é malha fechada', () => {
  assert.ok(fechada(caixa().malha))
})

test('cada vista é um SVG com cotas e polígonos', () => {
  for (const v of VISTAS) {
    const svg = capturaSvg([caixa()], v)
    assert.ok(svg.startsWith('<svg'), v)
    assert.ok(svg.endsWith('</svg>'), v)
    assert.ok(svg.includes('10 × 20 × 30 mm'), v)
    assert.ok(svg.includes('<polygon'), v)
  }
})

test('vista frente mantém a proporção 10:30 da caixa', () => {
  const e = extensao(capturaSvg([caixa()], 'frente'))
  const razao = e.w / e.h
  assert.ok(Math.abs(razao - 10 / 30) / (10 / 30) < 0.02, `razão ${razao}`)
})

test('mesma entrada gera o mesmo texto', () => {
  const corpos = [caixa(), caixa(50)]
  assert.equal(capturaSvg(corpos, 'iso'), capturaSvg(corpos, 'iso'))
})

test('sem corpos ou sem triângulos lança erro', () => {
  const msg = /Não há geometria para capturar/
  assert.throws(() => capturaSvg([], 'iso'), msg)
  const vazio: CorpoCaptura = { nome: 'vazio', malha: { posicoes: new Float32Array(0), indices: new Uint32Array(0) } }
  assert.throws(() => capturaSvg([vazio], 'iso'), msg)
})

test('dois corpos geram mais polígonos que um', () => {
  const um = poligonos(capturaSvg([caixa()], 'iso')).length
  const dois = poligonos(capturaSvg([caixa(), caixa(50)], 'iso')).length
  assert.ok(dois > um, `${dois} > ${um}`)
})

// Corpos reais: caixa-com-tampa regenerada a partir do exemplo.
const EXEMPLO = new URL('../../../examples/caixa-com-tampa.3dm.json', import.meta.url)
function corposDoExemplo(): CorpoCaptura[] {
  const doc = lerDocumento(readFileSync(EXEMPLO, 'utf8'))
  return [...new Regenerador().regenera(entradaDe(doc)).corpos].map(([nome, malha]) => ({ nome, malha }))
}

// Mesma formatação da cota do capturaSvg: até 2 casas, vírgula decimal.
const fmtMm = (n: number) => Number(n.toFixed(2)).toString().replace('.', ',')

test('enquadramento: exemplo ocupa >= 50% do viewBox em largura ou altura', () => {
  const corpos = corposDoExemplo()
  for (const v of VISTAS) {
    const svg = capturaSvg(corpos, v)
    assert.ok(poligonos(svg).length > 0, `${v}: sem polígonos`)
    const [W, H] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)!.slice(1).map(Number)
    const e = extensao(svg)
    const fw = e.w / W, fh = e.h / H
    console.log(`${v}: largura ${(fw * 100).toFixed(1)}% · altura ${(fh * 100).toFixed(1)}% do viewBox`)
    assert.ok(fw >= 0.5 || fh >= 0.5, `${v}: largura ${fw.toFixed(3)}, altura ${fh.toFixed(3)}`)
  }
})

test('cota do exemplo traz as dimensões da bbox real dos corpos', () => {
  const corpos = corposDoExemplo()
  const caixas = corpos.map(c => bbox(c.malha))
  const dims = [0, 1, 2].map(k => Math.max(...caixas.map(b => b.max[k])) - Math.min(...caixas.map(b => b.min[k])))
  const esperado = `${dims.map(fmtMm).join(' × ')} mm`
  // 30 mm da caixa + 2 mm do rebordo (ex2 sobre z=30).
  assert.equal(esperado, '80 × 50 × 32 mm')
  for (const v of VISTAS) assert.ok(capturaSvg(corpos, v).includes(esperado), `${v}: ${esperado}`)
})
