import { test } from 'node:test'
import assert from 'node:assert/strict'
import { atributoTema, temaEfetivo } from '../src/tema.ts'
import { lePrefs, normaliza, PADRAO, salvaPrefs } from '../src/prefs.ts'
import { alterna, estadoInicial, TECLA_F } from '../src/status.ts'

test('tema: auto segue o sistema (escuro quando não há preferência clara); escolha manual vence', () => {
  assert.equal(temaEfetivo('auto', false), 'escuro')
  assert.equal(temaEfetivo('auto', true), 'claro')
  assert.equal(temaEfetivo('claro', false), 'claro')
  assert.equal(temaEfetivo('escuro', true), 'escuro')
})

test('tema: atributo data-theme segue o tema efetivo; auto nos 4 casos', () => {
  assert.equal(atributoTema('claro'), 'light')
  assert.equal(atributoTema('escuro'), 'dark')
  assert.equal(temaEfetivo('auto', true), 'claro')
  assert.equal(temaEfetivo('auto', false), 'escuro')
  assert.equal(atributoTema(temaEfetivo('auto', true)), 'light')
  assert.equal(atributoTema(temaEfetivo('auto', false)), 'dark')
})

test('prefs: valores inválidos voltam ao padrão; ida e volta pelo armazenamento', () => {
  assert.deepEqual(normaliza(null), PADRAO)
  assert.deepEqual(normaliza({ tema: 'rosa', navegacao: 'x', pixels: 3, teclasBlender: 'sim' }), PADRAO)
  const mem = new Map<string, string>()
  const a = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) }
  assert.deepEqual(lePrefs(a), PADRAO)
  salvaPrefs({ tema: 'claro', navegacao: 'autocad', teclasBlender: false, pixels: 1.5 }, a)
  assert.deepEqual(lePrefs(a), { tema: 'claro', navegacao: 'autocad', teclasBlender: false, pixels: 1.5 })
  mem.set('3dm.prefs', '{lixo')
  assert.deepEqual(lePrefs(a), PADRAO)
  assert.deepEqual(lePrefs({ getItem() { throw new Error('bloqueado') }, setItem() {} }), PADRAO)
})

test('teclas F do AutoCAD: F3 OSNAP, F7 GRID, F8 ORTHO, F9 SNAP, F10 POLAR, F11 OTRACK, F12 DYN', () => {
  assert.deepEqual(TECLA_F, { F3: 'osnap', F7: 'grid', F8: 'ortho', F9: 'snap', F10: 'polar', F11: 'otrack', F12: 'dyn' })
})

test('F8 e F10 são exclusivos; os demais modos são independentes', () => {
  let e = estadoInicial()
  e = alterna(e, 'ortho'); assert.ok(e.ortho && !e.polar)
  e = alterna(e, 'polar'); assert.ok(e.polar && !e.ortho)
  e = alterna(e, 'ortho'); assert.ok(e.ortho && !e.polar)
  e = alterna(e, 'ortho'); assert.ok(!e.ortho && !e.polar) // desligar não liga o outro
  e = alterna(e, 'grid'); assert.equal(e.grid, false)
  assert.equal(alterna(e, 'snap').snap, true)
})
