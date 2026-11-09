import { test } from 'node:test'
import assert from 'node:assert/strict'
import { iniciou } from '../src/boot.ts'

test('iniciou: sem #vista canvas, app não iniciou', () => {
  assert.equal(iniciou({ querySelector: () => null }), false)
})

test('iniciou: com #vista canvas, app iniciou', () => {
  assert.equal(iniciou({ querySelector: () => ({}) as Element }), true)
})
