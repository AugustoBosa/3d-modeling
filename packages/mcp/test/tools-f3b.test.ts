import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { adicionaFeature } from '@3dm/core/features'
import { bbox } from '@3dm/core/malha'
import { criaSessao } from '../src/headless.ts'
import { regenera } from '../src/modelo.ts'
import type { Sessao } from '../src/sessao.ts'
import type { Tool } from '../src/tool.ts'
import { toolsF3b } from '../src/tools-f3b.ts'

const pasta = () => mkdtempSync(path.join(os.tmpdir(), 'f3b-'))

/** Sessão vazia. */
function vazia(): Sessao {
  const s = criaSessao(pasta())
  s.novo()
  return s
}

/** Sessão com a caixa cx1 de 10×20×30 no projeto. */
function caixa(): Sessao {
  const s = vazia()
  s.executa(adicionaFeature({ id: 'cx1', tipo: 'caixa', pos: [0, 0, 0], dim: [10, 20, 30] }))
  return s
}

// async: um throw síncrono da tool vira rejeição, que o assert.rejects captura.
const f3b = async (nome: string, s: Sessao, args: Record<string, unknown> = {}): Promise<any> =>
  (toolsF3b as Tool[]).find(t => t.nome === nome)!.executa(s, args)

test('filamento_definir pla e depois petg grava e retorna', async () => {
  const s = vazia()
  assert.equal((await f3b('filamento_definir', s, { filamento: 'pla' })).filamento, 'pla')
  assert.equal(s.doc.filamento, 'pla')
  assert.equal((await f3b('filamento_definir', s, { filamento: 'petg' })).filamento, 'petg')
  assert.equal(s.doc.filamento, 'petg')
})

test('filamento_definir null remove o filamento do projeto', async () => {
  const s = vazia()
  await f3b('filamento_definir', s, { filamento: 'pla' })
  const r = await f3b('filamento_definir', s, { filamento: null })
  assert.equal(r.filamento, null)
  assert.equal(s.doc.filamento, undefined)
})

test('filamento_definir com id desconhecido rejeita', async () => {
  await assert.rejects(f3b('filamento_definir', vazia(), { filamento: 'xyz' }), /filamento desconhecido/)
})

test('filamento_definir desfaz para o filamento anterior', async () => {
  const s = vazia()
  await f3b('filamento_definir', s, { filamento: 'pla' })
  await f3b('filamento_definir', s, { filamento: 'petg' })
  s.desfaz()
  assert.equal(s.doc.filamento, 'pla')
})

test('slots_definir grava o slot 2 com filamento e cor', async () => {
  const s = vazia()
  const r = await f3b('slots_definir', s, { slot: 2, filamento: 'petg', cor: '#ff0000' })
  assert.equal(r.ok, true)
  assert.deepEqual(s.doc.slots!['2'], { filamento: 'petg', cor: '#ff0000' })
  assert.deepEqual(r.slots['2'], { filamento: 'petg', cor: '#ff0000' })
})

test('slots_definir sem filamento nem cor remove o slot', async () => {
  const s = vazia()
  await f3b('slots_definir', s, { slot: 2, filamento: 'petg', cor: '#ff0000' })
  await f3b('slots_definir', s, { slot: 2 })
  assert.equal(s.doc.slots!['2'], undefined)
})

test('slots_definir só com filamento rejeita e explica a correção', async () => {
  await assert.rejects(f3b('slots_definir', vazia(), { slot: 2, filamento: 'petg' }), /precisa de filamento e cor juntos.*Correção/)
})

test('slots_definir com slot 0 ou 17 rejeita', async () => {
  await assert.rejects(f3b('slots_definir', vazia(), { slot: 0, filamento: 'pla', cor: '#ffffff' }), /slot inválido: 0/)
  await assert.rejects(f3b('slots_definir', vazia(), { slot: 17, filamento: 'pla', cor: '#ffffff' }), /slot inválido: 17/)
})

test('apoiar_na_face com normal +X põe a caixa de pé: min z 0 e altura 10', async () => {
  const s = caixa()
  const r = await f3b('apoiar_na_face', s, { corpo: 'cx1', normal: [1, 0, 0] })
  assert.equal(r.ok, true)
  assert.ok(s.doc.features.some(f => f.id === r.id))
  const b = bbox(regenera(s).corpos.get('cx1')!)
  assert.ok(Math.abs(b.min[2]) < 0.01)
  assert.ok(Math.abs((b.max[2] - b.min[2]) - 10) < 0.01)
})

test('apoiar_na_face sem corpo usa o último corpo', async () => {
  const s = caixa()
  const r = await f3b('apoiar_na_face', s, { normal: [0, 0, -1] })
  assert.equal(r.ok, true)
})

test('apoiar_na_face com corpo inexistente lista os corpos', async () => {
  await assert.rejects(f3b('apoiar_na_face', caixa(), { corpo: 'nope', normal: [1, 0, 0] }), /corpo desconhecido: nope.*cx1/)
})

test('apoiar_na_face com normal a 45° entre faces rejeita e lista as normais', async () => {
  await assert.rejects(
    f3b('apoiar_na_face', caixa(), { corpo: 'cx1', normal: [0.7, 0.7, 0] }),
    /Nenhuma face plana.*Normais disponíveis: .*\[1, 0, 0\].*Correção: use uma delas/,
  )
})
