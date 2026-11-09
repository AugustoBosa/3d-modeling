import { test } from 'node:test'
import assert from 'node:assert/strict'
import { adicionaFeature, entradaDe } from '../src/features/index.ts'
import { novoDocumento } from '../src/doc/index.ts'
import type { Documento } from '../src/doc/index.ts'
import { Regenerador } from '../src/regen/index.ts'
import { fechada, volume } from '../src/malha/index.ts'
import { lerSvg, sketchDePolilinhas } from '../src/importar/index.ts'

type Pt = [number, number]
const perto = (a: number, b: number, tol: number) => assert.ok(Math.abs(a - b) <= tol, `esperado ${b} ± ${tol}, obtido ${a}`)
const area = (c: Pt[]) => Math.abs(c.reduce((s, p, i) => { const q = c[(i + 1) % c.length]!; return s + p[0] * q[1] - q[0] * p[1] }, 0)) / 2
const svg = (corpo: string, cabeca = 'width="30" height="30"') => `<svg xmlns="http://www.w3.org/2000/svg" ${cabeca}>${corpo}</svg>`
const PLANO = { base: 'XY' as const, offset: 0 }

// Documento com sketch vindo do SVG e uma extrusão de `distancia` mm sobre ele.
function docExtrudado(contornos: Pt[][], distancia = 5): { doc: Documento; sk: string } {
  const doc = novoDocumento()
  const cmd = sketchDePolilinhas(contornos, PLANO)
  cmd.fazer(doc)
  adicionaFeature({ id: 'ex1', tipo: 'extrude', sketch: cmd.id, distancia }).fazer(doc)
  return { doc, sk: cmd.id }
}

// Regenera e entrega o volume do corpo `ex1` e se a malha é fechada (dentro de comRegen: malhas são liberadas ao fim).
function medeCorpo(doc: Documento): { volume: number; fechada: boolean; ok: boolean } {
  const reg = new Regenerador()
  try {
    const r = reg.regenera(entradaDe(doc))
    const m = r.corpos.get('ex1')
    return { volume: m ? volume(m) : NaN, fechada: m ? fechada(m) : false, ok: r.status.get('ex1')?.estado === 'ok' }
  } finally {
    reg.dispose()
  }
}

test('rect 20x10: 1 contorno de 4 pontos, largura 20, altura 10', () => {
  const r = lerSvg(svg('<rect width="20" height="10"/>', 'width="20" height="10"'))
  assert.equal(r.contornos.length, 1)
  assert.equal(r.contornos[0]!.length, 4)
  perto(r.largura, 20, 1e-9); perto(r.altura, 10, 1e-9)
})

test('circle r=5: área ≈ pi·25 (±2%)', () => {
  const r = lerSvg(svg('<circle cx="5" cy="5" r="5"/>', 'width="10" height="10"'))
  assert.equal(r.contornos.length, 1)
  perto(area(r.contornos[0]!) / (Math.PI * 25), 1, 0.02)
})

test('path absoluto e relativo dão o mesmo contorno; Y invertido: (0,0) com altura 10 vira y=10', () => {
  const abs = lerSvg('<svg height="10"><path d="M0 0 L10 0 L10 10 Z"/></svg>')
  const rel = lerSvg('<svg height="10"><path d="m0 0 l10 0 l0 10 z"/></svg>')
  assert.deepEqual(rel.contornos, abs.contornos)
  assert.equal(abs.contornos[0]!.length, 3)
  assert.deepEqual(abs.contornos[0]![0], [0, 10])
})

test('path com curva C fecha: contorno com muitos pontos e área positiva', () => {
  const r = lerSvg(svg('<path d="M0 0 C 0 10 10 10 10 0 Z"/>'))
  assert.equal(r.contornos.length, 1)
  assert.ok(r.contornos[0]!.length >= 8)
  assert.ok(area(r.contornos[0]!) > 1)
})

test('path com arco A fecha: semicírculo r=5 tem área ≈ pi·25/2 (±2%)', () => {
  const r = lerSvg(svg('<path d="M0 0 A5 5 0 0 1 10 0 Z"/>'))
  assert.equal(r.contornos.length, 1)
  perto(area(r.contornos[0]!) / (Math.PI * 25 / 2), 1, 0.02)
})

test('contorno com menos de 3 pontos é descartado', () => {
  const r = lerSvg(svg('<path d="M0 0 L10 0"/>'))
  assert.equal(r.contornos.length, 0)
})

test('integração: retângulo 20x10 extrudado 5 mm dá volume 1000, fechado', () => {
  const { doc } = docExtrudado(lerSvg(svg('<rect width="20" height="10"/>', 'width="20" height="10"')).contornos)
  const m = medeCorpo(doc)
  assert.ok(m.ok)
  assert.ok(m.fechada)
  perto(m.volume, 1000, 10)
})

test('integração: círculo r=10 extrudado 5 mm: volume ≈ área do SVG × 5 (±1%), fechado', () => {
  const r = lerSvg(svg('<circle cx="15" cy="15" r="10"/>'))
  const { doc } = docExtrudado(r.contornos)
  const m = medeCorpo(doc)
  assert.ok(m.ok)
  assert.ok(m.fechada)
  perto(m.volume / (area(r.contornos[0]!) * 5), 1, 0.01)
})

test('integração: 30x30 com 10x10 dentro vira furo: volume (900-100)×5', () => {
  const r = lerSvg(svg('<rect width="30" height="30"/><rect x="10" y="10" width="10" height="10"/>'))
  assert.equal(r.contornos.length, 2)
  const { doc } = docExtrudado(r.contornos)
  const m = medeCorpo(doc)
  assert.ok(m.ok)
  perto(m.volume, (900 - 100) * 5, 0.01 * 4000)
})

test('desfazer remove o sketch do documento', () => {
  const doc = novoDocumento()
  const cmd = sketchDePolilinhas(lerSvg(svg('<rect width="20" height="10"/>', 'width="20" height="10"')).contornos, PLANO)
  cmd.fazer(doc)
  assert.equal(doc.features.length, 1)
  cmd.desfazer(doc)
  assert.equal(doc.features.length, 0)
})
