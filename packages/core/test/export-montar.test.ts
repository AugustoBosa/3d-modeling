import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { unzipSync, strFromU8 } from 'fflate'
import { exporta, type ArquivoExport } from '../src/export/montar.ts'
import { lerDocumento, novoDocumento, type Documento } from '../src/doc/index.ts'
import { entradaDe } from '../src/features/index.ts'
import { Regenerador } from '../src/regen/index.ts'
import type { Malha } from '../src/malha/index.ts'
import { fechada } from '../src/malha/malha.ts'
import { TOL_EXPORT } from '../src/kernel/index.ts'
import { cuboAberto, doisCorpos } from './malha-fixtures.ts'

const EXEMPLO = new URL('../../../examples/caixa-com-tampa.3dm.json', import.meta.url)
const CORPOS = () => new Map(doisCorpos().map((c) => [c.nome, c.malha]))
const doc = (imp = 'bambu-p2s', extra: Partial<Documento> = {}): Documento => ({ ...novoDocumento(imp), nome: 'Teste', ...extra })
const abre = (a: ArquivoExport) => unzipSync(a.bytes)
const texto = (z: Record<string, Uint8Array>, nome: string) => {
  const b = z[nome]
  assert.ok(b, `arquivo ausente: ${nome}`)
  return strFromU8(b)
}

test('stl por corpo, stl tudo (24 triangulos) e 3mf com slot 2', () => {
  const d = doc('bambu-p2s', { aparencia: { Base: { cor: '#FF0000', slot: 1 }, Tampa: { cor: '#0000FF', slot: 2 } } })
  const porCorpo = exporta({ doc: d, corpos: CORPOS() }, 'stl')
  assert.deepEqual(porCorpo.arquivos.map((a) => a.nome), ['teste-base-bambu-p2s.stl', 'teste-tampa-bambu-p2s.stl'])

  const tudo = exporta({ doc: d, corpos: CORPOS() }, 'stl-tudo')
  assert.equal(tudo.arquivos.length, 1)
  assert.equal(tudo.arquivos[0]!.bytes.length, 84 + 50 * 24)

  const mf = exporta({ doc: d, corpos: CORPOS() }, '3mf')
  assert.equal(mf.arquivos[0]!.nome, 'teste-todos-bambu-p2s.3mf')
  assert.match(texto(abre(mf.arquivos[0]!), 'Metadata/model_settings.config'), /key="extruder" value="2"/)
})

test('corpo aberto bloqueia (sem arquivos); ignoraBloqueio gera', () => {
  const corpos = new Map([['Aberto', cuboAberto(20)]])
  const r = exporta({ doc: doc(), corpos }, 'stl')
  assert.equal(r.bloqueado, true)
  assert.deepEqual(r.arquivos, [])
  assert.ok(r.achados.some((a) => a.codigo === 'malha-aberta'))
  assert.equal(exporta({ doc: doc(), corpos }, 'stl', { ignoraBloqueio: true }).arquivos.length, 1)
})

test('corpo oculto nao sai', () => {
  const r = exporta({ doc: doc(), corpos: CORPOS(), ocultos: new Set(['Tampa']) }, 'stl')
  assert.deepEqual(r.arquivos.map((a) => a.nome), ['teste-base-bambu-p2s.stl'])
})

test('cor da tabela de slots vence a do corpo no project_settings', () => {
  const d = doc('bambu-p2s', {
    aparencia: { Base: { cor: '#FF0000', slot: 1 }, Tampa: { cor: '#0000FF', slot: 2 } },
    slots: { '1': { filamento: 'pla', cor: '#00FF00' }, '2': { filamento: 'pla', cor: '#FFFF00' } },
  })
  const mf = exporta({ doc: d, corpos: CORPOS() }, '3mf')
  const proj = JSON.parse(texto(abre(mf.arquivos[0]!), 'Metadata/project_settings.config'))
  assert.deepEqual(proj.filament_colour, ['#00FF00', '#FFFF00'])
  assert.deepEqual(proj.filament_type, ['PLA', 'PLA'])
})

test('mesma entrada, mesmos bytes', () => {
  const gera = () => exporta({ doc: doc(), corpos: CORPOS() }, '3mf').arquivos[0]!.bytes
  assert.equal(Buffer.compare(Buffer.from(gera()), Buffer.from(gera())), 0)
})

test('TPU na Mega S gera achado flexivel-bowden', () => {
  const r = exporta({ doc: doc('anycubic-i3-mega-s', { filamento: 'tpu' }), corpos: CORPOS() }, 'stl')
  assert.ok(r.achados.some((a) => a.codigo === 'flexivel-bowden'))
})

test('exemplo caixa-com-tampa: gera os 3MF em test/saida/', () => {
  const base = lerDocumento(readFileSync(EXEMPLO, 'utf8'))
  const reg = new Regenerador()
  let corpos: Map<string, Malha>
  try {
    corpos = reg.regenera(entradaDe(base, { tol: TOL_EXPORT })).corpos
  } finally {
    reg.dispose()
  }
  const fechados = new Map([...corpos].filter(([, m]) => fechada(m)))
  assert.ok(fechados.has('ex1') && fechados.has('ex2'))

  const comAparencia = (imp: string, slotTampa: number): Documento => ({
    ...base,
    impressora: imp,
    aparencia: { ex1: { cor: '#b8b4ac', slot: 1 }, ex2: { cor: '#6a8fb0', slot: slotTampa } },
  })
  const p2s = exporta({ doc: comAparencia('bambu-p2s', 2), corpos: fechados }, '3mf')
  const mega = exporta({ doc: comAparencia('anycubic-i3-mega-s', 1), corpos: fechados }, '3mf')
  assert.equal(p2s.bloqueado, false)
  assert.equal(mega.bloqueado, false)

  const pasta = new URL('./saida/', import.meta.url)
  mkdirSync(pasta, { recursive: true })
  writeFileSync(new URL('caixa-com-tampa-bambu-p2s.3mf', pasta), p2s.arquivos[0]!.bytes)
  writeFileSync(new URL('caixa-com-tampa-anycubic-i3-mega-s.3mf', pasta), mega.arquivos[0]!.bytes)

  const zp2s = abre(p2s.arquivos[0]!)
  assert.equal(texto(zp2s, '3D/3dmodel.model').match(/<object /g)?.length, 2)
  assert.ok(zp2s['Metadata/project_settings.config'])
  assert.ok(abre(mega.arquivos[0]!)['Metadata/Slic3r_PE.config'])
})
