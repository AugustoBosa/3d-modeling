import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { adicionaFeature } from '@3dm/core/features'
import { criaSessao } from '../src/headless.ts'
import type { Sessao } from '../src/sessao.ts'
import { toolsModelo } from '../src/tools-modelo.ts'

const pasta = () => mkdtempSync(path.join(os.tmpdir(), 'tools-modelo-'))

/** Sessão com uma caixa 10×20×30 no projeto. */
function caixa(): Sessao {
  const s = criaSessao(pasta())
  s.novo()
  s.executa(adicionaFeature({ id: 'cx1', tipo: 'caixa', pos: [0, 0, 0], dim: [10, 20, 30] }))
  return s
}

// async: um throw síncrono da tool vira rejeição, que o assert.rejects captura.
const chama = async (nome: string, s: Sessao, args: Record<string, unknown> = {}): Promise<any> =>
  toolsModelo.find(t => t.nome === nome)!.executa(s, args)

test('modelo_info mede a caixa: volume, massa, bbox, triângulos e fechada', async () => {
  const info = await chama('modelo_info', caixa())
  const c = info.corpos[0]
  assert.equal(info.ok, true)
  assert.equal(info.filamento, 'pla')
  assert.ok(Math.abs(c.volume_mm3 - 6000) < 0.01)
  assert.ok(Math.abs(c.massa_g - 7.44) < 0.01)
  assert.deepEqual(c.bbox.tamanho, [10, 20, 30])
  assert.equal(c.triangulos, 12)
  assert.equal(c.fechada, true)
})

test('modelo_info sem sólidos lança', async () => {
  const s = criaSessao(pasta())
  s.novo()
  await assert.rejects(chama('modelo_info', s), /ainda não tem sólidos/)
})

test('verificar_impressao devolve ok booleano e a lista de achados', async () => {
  const r = await chama('verificar_impressao', caixa())
  assert.equal(typeof r.ok, 'boolean')
  assert.ok(Array.isArray(r.achados))
})

test('exportar 3mf grava arquivo ZIP (começa com PK)', async () => {
  const r = await chama('exportar', caixa(), { formato: '3mf' })
  const arq = r.arquivos[0]
  assert.ok(arq.bytes > 0)
  assert.equal(readFileSync(arq.caminho).subarray(0, 2).toString(), 'PK')
})

test('exportar stl de um corpo tem 84 + 50 bytes por triângulo', async () => {
  const s = caixa()
  const { corpos: [c] } = await chama('modelo_info', s)
  const r = await chama('exportar', s, { formato: 'stl', corpo: 'cx1' })
  assert.equal(r.arquivos[0].bytes, 84 + 50 * c.triangulos)
  assert.equal(readFileSync(r.arquivos[0].caminho).length, 84 + 50 * 12)
})

test('exportar com caminho fora da pasta do projeto lança', async () => {
  await assert.rejects(chama('exportar', caixa(), { formato: '3mf', caminho: '../fora.3mf' }), /fora da pasta/)
})

test('captura grava 4 svgs e devolve 4 anexos image/svg+xml', async () => {
  const r = await chama('captura', caixa())
  assert.equal(r.arquivos.length, 4)
  for (const arq of r.arquivos) assert.ok(existsSync(arq))
  assert.equal(r._anexos.length, 4)
  assert.ok(r._anexos.every((a: { mime: string }) => a.mime === 'image/svg+xml'))
})
