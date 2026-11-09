import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { adicionaFeature, entradaDe } from '../src/features/index.ts'
import { novoDocumento } from '../src/doc/index.ts'
import type { Documento } from '../src/doc/index.ts'
import { Regenerador } from '../src/regen/index.ts'
import { bbox, fechada, volume } from '../src/malha/index.ts'
import { carregaFonte, sketchDeTexto, textoParaContornos } from '../src/texto/index.ts'

type Pt = [number, number]
const perto = (a: number, b: number, tol: number) => assert.ok(Math.abs(a - b) <= tol, `esperado ${b} ± ${tol}, obtido ${a}`)
const areaAbs = (c: Pt[]) => Math.abs(c.reduce((s, p, i) => { const q = c[(i + 1) % c.length]!; return s + p[0] * q[1] - q[0] * p[1] }, 0)) / 2
const dentro = (p: Pt, c: Pt[]): boolean => {
  let inside = false
  for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
    const [xi, yi] = c[i]!, [xj, yj] = c[j]!
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
// Área líquida: contorno de profundidade par soma, ímpar (furo) subtrai.
const areaLiquida = (cs: Pt[][]) => cs.reduce((s, c, i) => {
  const prof = cs.filter((o, j) => j !== i && dentro(c[0]!, o)).length
  return s + (prof % 2 === 0 ? 1 : -1) * areaAbs(c)
}, 0)

const FONTE = new URL('../../../node_modules/@fontsource/roboto/files/roboto-latin-400-normal.woff', import.meta.url)
const f = carregaFonte(((b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))(readFileSync(FONTE)))
const larguraAltura = (cs: Pt[][]) => {
  const xs = cs.flat().map((p) => p[0]), ys = cs.flat().map((p) => p[1])
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), minY: Math.min(...ys) }
}

test('carregaFonte: bytes inválidos dão erro claro', () => {
  assert.throws(() => carregaFonte(new ArrayBuffer(8)), /fonte inválida/)
})

test("'I' 10 mm: 1 contorno, altura ≈ altura de maiúscula Roboto (6,5 a 8 mm), área > 0, linha de base em y=0", () => {
  const cs = textoParaContornos(f, 'I', 10)
  assert.equal(cs.length, 1)
  const { h, minY } = larguraAltura(cs)
  assert.ok(h >= 6.5 && h <= 8, `altura ${h}`)
  perto(minY, 0, 1e-6)
  assert.ok(areaAbs(cs[0]!) > 0)
})

test("'O' 10 mm: 2 contornos (externo e furo)", () => {
  assert.equal(textoParaContornos(f, 'O', 10).length, 2)
})

test("'HI' é mais largo que 'I'", () => {
  const i = larguraAltura(textoParaContornos(f, 'I', 10)).w
  const hi = larguraAltura(textoParaContornos(f, 'HI', 10)).w
  assert.ok(hi > i)
})

test('texto vazio: lista vazia', () => {
  assert.deepEqual(textoParaContornos(f, '', 10), [])
})

test("integração: 'Lo' 10 mm extrudado 2 mm: fechado, volume ≈ área líquida × 2 (±2%), bbox Z em [0, 2]", () => {
  const cs = textoParaContornos(f, 'Lo', 10)
  const doc: Documento = novoDocumento()
  const cmd = sketchDeTexto(cs, { base: 'XY', offset: 0 })
  cmd.fazer(doc)
  adicionaFeature({ id: 'ex1', tipo: 'extrude', sketch: cmd.id, distancia: 2 }).fazer(doc)
  const reg = new Regenerador()
  try {
    const r = reg.regenera(entradaDe(doc))
    const m = r.corpos.get('ex1')!
    assert.equal(r.status.get('ex1')?.estado, 'ok')
    assert.ok(fechada(m))
    const v = volume(m)
    assert.ok(v > 0)
    perto(v / (areaLiquida(cs) * 2), 1, 0.02)
    const b = bbox(m)
    perto(b.min[2], 0, 1e-6)
    perto(b.max[2], 2, 1e-6)
  } finally {
    reg.dispose()
  }
})
