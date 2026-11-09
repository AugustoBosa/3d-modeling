import { test } from 'node:test'
import assert from 'node:assert/strict'
import { impressoraPorId, impressoras } from '../printers/index.ts'
import { filamentoPorId, filamentos } from '../filaments/index.ts'

test('volumes das impressoras (PROJETO_BASE §3.1, §3.2)', () => {
  assert.deepEqual(impressoraPorId('anycubic-i3-mega-s')?.volume, { x: 210, y: 210, z: 205 })
  assert.deepEqual(impressoraPorId('bambu-p2s')?.volume, { x: 256, y: 256, z: 256 })
  assert.equal(impressoras.length, 2)
})

test('densidades dos filamentos (§3.4)', () => {
  const d = Object.fromEntries(filamentos.map(f => [f.id, f.densidade]))
  assert.deepEqual(d, { pla: 1.24, petg: 1.27, tpu: 1.21, 'abs-asa': 1.05 })
})

test('consistência: filamento padrão existe e compat cobre todas as impressoras', () => {
  for (const p of impressoras) assert.ok(filamentoPorId(p.filamentoPadrao), p.id)
  for (const f of filamentos) for (const p of impressoras) assert.match(f.compat[p.id] ?? '', /^(ok|aviso)$/, `${f.id} × ${p.id}`)
  assert.equal(filamentoPorId('tpu')!.compat['anycubic-i3-mega-s'], 'aviso')
  assert.equal(filamentoPorId('abs-asa')!.compat['anycubic-i3-mega-s'], 'aviso')
  assert.equal(impressoraPorId('anycubic-i3-mega-s')!.camaraFechada, false)
})
