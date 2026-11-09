import { test } from 'node:test'
import assert from 'node:assert/strict'
import { acaoDoMouse, passoGrade, teclaNumpad } from '../src/viewport/nav.ts'

test('preset Blender: meio orbita, Shift+meio faz pan', () => {
  assert.equal(acaoDoMouse('blender', 1, false), 'orbitar')
  assert.equal(acaoDoMouse('blender', 1, true), 'pan')
})

test('preset AutoCAD: meio sozinho faz pan (D15), Shift+meio orbita', () => {
  assert.equal(acaoDoMouse('autocad', 1, false), 'pan')
  assert.equal(acaoDoMouse('autocad', 1, true), 'orbitar')
})

test('esquerdo e direito não navegam (ficam para seleção e menu de contexto)', () => {
  for (const p of ['blender', 'autocad'] as const) for (const b of [0, 2]) assert.equal(acaoDoMouse(p, b, false), 'nada')
})

test('numpad 1/3/7: frente, direita, topo; Ctrl inverte', () => {
  assert.deepEqual(teclaNumpad('Numpad1', false), { tipo: 'vista', dir: [0, -1, 0] })
  assert.deepEqual(teclaNumpad('Numpad1', true), { tipo: 'vista', dir: [0, 1, 0] })
  assert.deepEqual(teclaNumpad('Numpad3', false), { tipo: 'vista', dir: [1, 0, 0] })
  assert.deepEqual(teclaNumpad('Numpad3', true), { tipo: 'vista', dir: [-1, 0, 0] })
  assert.deepEqual(teclaNumpad('Numpad7', false), { tipo: 'vista', dir: [0, 0, 1] })
  assert.deepEqual(teclaNumpad('Numpad7', true), { tipo: 'vista', dir: [0, 0, -1] })
})

test('numpad 5 alterna projeção, 9 vista oposta, . enquadra, +/- zoom', () => {
  assert.equal(teclaNumpad('Numpad5', false)?.tipo, 'persp')
  assert.equal(teclaNumpad('Numpad9', false)?.tipo, 'oposta')
  assert.equal(teclaNumpad('NumpadDecimal', false)?.tipo, 'enquadra')
  assert.ok((teclaNumpad('NumpadAdd', false) as { fator: number }).fator < 1)
  assert.ok((teclaNumpad('NumpadSubtract', false) as { fator: number }).fator > 1)
})

test('numpad 2/4/6/8 orbitam; com Ctrl fazem pan; outras teclas são ignoradas', () => {
  assert.equal(teclaNumpad('Numpad4', false)?.tipo, 'orbita')
  assert.equal(teclaNumpad('Numpad4', true)?.tipo, 'pan')
  assert.equal(teclaNumpad('Digit1', false), null)
  assert.equal(teclaNumpad('Numpad0', false), null)
})

test('grade adaptativa 1/10 mm: perto mostra 1 mm, longe sobe de década', () => {
  assert.deepEqual(passoGrade(20), { menor: 1, maior: 10 })
  assert.deepEqual(passoGrade(6), { menor: 1, maior: 10 })
  assert.deepEqual(passoGrade(1), { menor: 10, maior: 100 })
  assert.deepEqual(passoGrade(.05), { menor: 100, maior: 1000 })
})
