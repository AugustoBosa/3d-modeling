import { test } from 'node:test'
import assert from 'node:assert/strict'
import { direcaoDaVista, metadeOrtografica, type NomeVista } from '../src/ponte/captura.ts'

const VISTAS: NomeVista[] = ['iso', 'frente', 'topo', 'direita']
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0)

test('direcaoDaVista: dir unitária e up perpendicular à dir nas 4 vistas', () => {
  for (const v of VISTAS) {
    const { dir, up } = direcaoDaVista(v)
    assert.ok(Math.abs(Math.hypot(...dir) - 1) < 1e-9, `${v}: dir não é unitária`)
    assert.ok(Math.abs(dot(dir, up)) < 1e-9, `${v}: up não é perpendicular à dir`)
  }
})

test('direcaoDaVista: frente olha de -Y; topo tem up = +Y', () => {
  assert.ok(direcaoDaVista('frente').dir[1] < 0)
  const topo = direcaoDaVista('topo').up
  assert.ok(Math.abs(topo[0]) < 1e-9 && Math.abs(topo[1] - 1) < 1e-9 && Math.abs(topo[2]) < 1e-9)
})

test('metadeOrtografica: frente enquadra a altura da caixa (30) com margem', () => {
  const m = metadeOrtografica([0, 0, 0], [10, 20, 30], 'frente', 1)
  assert.ok(m >= 15, `meia-altura ${m} menor que 15`)
})

test('metadeOrtografica: caixa mais larga que alta cresce com aspecto estreito', () => {
  const caixa = { min: [0, 0, 0] as [number, number, number], max: [40, 10, 5] as [number, number, number] }
  const largo = metadeOrtografica(caixa.min, caixa.max, 'topo', 1)
  const estreito = metadeOrtografica(caixa.min, caixa.max, 'topo', 0.5)
  assert.ok(estreito > largo)
})

test('metadeOrtografica: cresce com o tamanho da caixa', () => {
  const pequena = metadeOrtografica([0, 0, 0], [10, 20, 30], 'iso', 1.3)
  const grande = metadeOrtografica([0, 0, 0], [20, 40, 60], 'iso', 1.3)
  assert.ok(grande > pequena)
  assert.ok(Math.abs(grande / pequena - 2) < 1e-9)
})
