import { test } from 'node:test'
import assert from 'node:assert/strict'
import { novoDocumento } from '../src/doc/index.ts'
import type { Documento, Feature } from '../src/doc/index.ts'
import { entradaDe, perfisDoSketch, planoDoSketch, valoresParametros } from '../src/features/index.ts'
import { matrizPlano } from '../src/kernel/index.ts'
import { Regenerador } from '../src/regen/index.ts'
import type { ResultadoRegen } from '../src/regen/index.ts'
import { bbox, volume } from '../src/malha/index.ts'
import { planoParaMundo } from '../src/sketch/tipos.ts'
import type { EntSk, RestSk, SketchFeature } from '../src/sketch/tipos.ts'

const pt = (id: string, x: number, y: number): EntSk => ({ id, tipo: 'ponto', x, y })
const ln = (id: string, a: string, b: string): EntSk => ({ id, tipo: 'linha', a, b })

// retângulo cotado: p1 fixo, lados horizontal/vertical, L (base) e W (altura); `aberto` tira o lado l4
function sketch(aberto = false): SketchFeature {
  const entidades: EntSk[] = [
    pt('p1', 0, 0), pt('p2', 80, 0), pt('p3', 80, 50), pt('p4', 0, 50),
    ln('l1', 'p1', 'p2'), ln('l2', 'p2', 'p3'), ln('l3', 'p3', 'p4'), ln('l4', 'p4', 'p1'),
  ]
  const restricoes: RestSk[] = [
    { id: 'r1', tipo: 'fixa', e: ['p1'], xy: [0, 0] },
    { id: 'r2', tipo: 'horizontal', e: ['l1'] },
    { id: 'r3', tipo: 'horizontal', e: ['l3'] },
    { id: 'r4', tipo: 'vertical', e: ['l2'] },
    { id: 'r5', tipo: 'vertical', e: ['l4'] },
    { id: 'r6', tipo: 'distancia', e: ['l1'], expr: 'L' },
    { id: 'r7', tipo: 'distancia', e: ['l2'], expr: 'W' },
  ]
  return {
    id: 'sk1', tipo: 'sketch', plano: { base: 'XY', offset: 0 },
    entidades: aberto ? entidades.filter((e) => e.id !== 'l4') : entidades,
    restricoes: aberto ? restricoes.filter((r) => r.id !== 'r5') : restricoes,
  }
}

function docCom(...extras: Feature[]): Documento {
  const doc = novoDocumento()
  doc.parametros = { L: { expr: '80' }, W: { expr: '50' }, H: { expr: 'L/4' } }
  doc.features = [sketch(), ...extras]
  return doc
}

const extrude = (extra: Partial<Feature> = {}): Feature => ({ id: 'e1', tipo: 'extrude', sketch: 'sk1', distancia: 'H', ...extra })
// furo passante no centro da face de topo (z = H)
const furo: Feature = {
  id: 'f1', tipo: 'furo', plano: { origem: ['0', '0', 'H'], normal: [0, 0, 1], eixoX: [1, 0, 0] },
  posicoes: [['L/2', 'W/2']], tipoFuro: 'simples', diametro: 5,
}

function regenera(reg: Regenerador, doc: Documento): ResultadoRegen {
  return reg.regenera(entradaDe(doc))
}

test('valoresParametros: avalia H = L/4 com L = 80', () => {
  const v = valoresParametros(docCom())
  assert.equal(v.L, 80)
  assert.equal(v.H, 20)
})

test('valoresParametros: expressão inválida vira mensagem', () => {
  const doc = docCom()
  doc.parametros.X = { expr: '???' }
  assert.equal(typeof valoresParametros(doc).X, 'string')
})

test('planoDoSketch: mesma transformação de planoParaMundo nas 3 bases', () => {
  for (const base of ['XY', 'XZ', 'YZ'] as const) {
    const plano = { base, offset: 7 }
    const m = Array.from(matrizPlano(planoDoSketch(plano)))
    const p = [3, 4, 0, 1]
    const mundo = [0, 1, 2].map((i) => m[i] * p[0] + m[4 + i] * p[1] + m[8 + i] * p[2] + m[12 + i] * p[3])
    planoParaMundo(plano, 3, 4).forEach((x, i) => assert.ok(Math.abs(mundo[i] - x) < 1e-9, `${base}[${i}]: ${mundo[i]} != ${x}`))
  }
})

test('extrude com parâmetros: volume 80*50*20 (rollback em e1 para isolar o corpo)', () => {
  const doc = docCom(extrude(), furo)
  doc.marcadorHistorico = 'e1'
  const reg = new Regenerador()
  try {
    const r = regenera(reg, doc)
    assert.equal(r.status.get('e1')?.estado, 'ok')
    assert.equal(r.status.get('f1')?.estado, 'revertida')
    assert.ok(Math.abs(volume(r.corpos.get('e1')!) - 80000) <= 0.01)
    assert.ok(Math.abs(bbox(r.corpos.get('e1')!).max[2] - 20) < 1e-6)
  } finally {
    reg.dispose()
  }
})

test('furo na face de topo subtrai o cilindro do corpo e1', () => {
  const reg = new Regenerador()
  try {
    const r = regenera(reg, docCom(extrude(), furo))
    assert.equal(r.status.get('f1')?.estado, 'ok')
    const vFuro = Math.PI * 2.5 ** 2 * 20
    assert.ok(Math.abs(volume(r.corpos.get('e1')!) - (80000 - vFuro)) <= 0.05 * vFuro)
  } finally {
    reg.dispose()
  }
})

test('mudar L para 100 (H = L/4 = 25) regenera: volume 100*50*25', () => {
  const doc = docCom(extrude())
  doc.marcadorHistorico = 'e1'
  const reg = new Regenerador()
  try {
    regenera(reg, doc)
    doc.parametros.L.expr = '100'
    const r = regenera(reg, doc)
    assert.equal(r.status.get('e1')?.estado, 'ok')
    assert.ok(Math.abs(volume(r.corpos.get('e1')!) - 125000) <= 0.01)
    assert.ok(Math.abs(bbox(r.corpos.get('e1')!).max[2] - 25) < 1e-6)
  } finally {
    reg.dispose()
  }
})

test('expressão inválida em distancia: e1 com erro e o furo suspenso', () => {
  const reg = new Regenerador()
  try {
    const r = regenera(reg, docCom(extrude({ distancia: '???' }), furo))
    const e1 = r.status.get('e1')
    assert.equal(e1?.estado, 'erro')
    assert.match(e1?.erro?.causa ?? '', /Expressão inválida em "distancia"/)
    assert.ok(e1?.erro?.correcao)
    assert.equal(r.status.get('f1')?.estado, 'suspensa')
  } finally {
    reg.dispose()
  }
})

test('sketch aberto: extrude com erro "contorno aberto"', () => {
  const doc = docCom(extrude())
  doc.features[0] = sketch(true)
  const reg = new Regenerador()
  try {
    const r = regenera(reg, doc)
    assert.equal(r.status.get('e1')?.estado, 'erro')
    assert.match(r.status.get('e1')?.erro?.causa ?? '', /contorno aberto/)
  } finally {
    reg.dispose()
  }
})

test('perfisDoSketch: sketch sem perfil fechado lança em pt-BR', () => {
  const doc = docCom()
  doc.features[0] = { ...sketch(true) }
  assert.throws(() => perfisDoSketch(doc, 'sk1'), /contorno aberto/)
  assert.throws(() => perfisDoSketch(doc, 'skX'), /não existe/)
})

test('extrude até o plano: z 0..30 com origem em expressão', () => {
  const doc = docCom(extrude({ modo: 'ate', ate: { origem: ['0', '0', 'H+10'], normal: [0, 0, 1], eixoX: [1, 0, 0] } }))
  const reg = new Regenerador()
  try {
    const r = regenera(reg, doc)
    assert.equal(r.status.get('e1')?.estado, 'ok')
    const b = bbox(r.corpos.get('e1')!)
    assert.ok(Math.abs(b.min[2]) < 1e-6)
    assert.ok(Math.abs(b.max[2] - 30) < 1e-6)
    assert.ok(Math.abs(volume(r.corpos.get('e1')!) - 80 * 50 * 30) <= 0.01)
  } finally {
    reg.dispose()
  }
})

test('extrude até plano paralelo à extrusão: erro', () => {
  const doc = docCom(extrude({ modo: 'ate', ate: { origem: [0, 0, 30], normal: [1, 0, 0], eixoX: [0, 1, 0] } }))
  const reg = new Regenerador()
  try {
    const r = regenera(reg, doc)
    assert.equal(r.status.get('e1')?.estado, 'erro')
    assert.equal(r.status.get('e1')?.erro?.causa, 'O plano de destino é paralelo à extrusão.')
  } finally {
    reg.dispose()
  }
})

test('extrude até plano atrás do sketch: erro', () => {
  const doc = docCom(extrude({ modo: 'ate', ate: { origem: [0, 0, -5], normal: [0, 0, 1], eixoX: [1, 0, 0] } }))
  const reg = new Regenerador()
  try {
    const r = regenera(reg, doc)
    assert.equal(r.status.get('e1')?.estado, 'erro')
    assert.equal(r.status.get('e1')?.erro?.causa, 'O plano de destino está atrás do sketch.')
  } finally {
    reg.dispose()
  }
})
