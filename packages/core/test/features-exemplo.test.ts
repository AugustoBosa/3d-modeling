// Regressão do exemplo "caixa com tampa": carrega o .3dm.json, regenera e checa geometria, parâmetros e hash.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { lerDocumento } from '../src/doc/index.ts'
import type { Documento } from '../src/doc/index.ts'
import { entradaDe } from '../src/features/index.ts'
import { Regenerador } from '../src/regen/index.ts'
import type { ResultadoRegen } from '../src/regen/index.ts'
import { bbox, fechada, normaliza, stl, volume } from '../src/malha/index.ts'
import type { Malha } from '../src/malha/index.ts'
import { Manifold, TOL_EXPORT, wasm } from '../src/kernel/index.ts'

const EXEMPLO = new URL('../../../examples/caixa-com-tampa.3dm.json', import.meta.url)
const REF = new URL('./ref_hashes.json', import.meta.url)
const CHAVE = 'caixa-com-tampa'
const IDS = ['sk1', 'ex1', 'sh1', 'sk2', 'ex2', 'sk3', 'ex3']

const carrega = (): Documento => lerDocumento(readFileSync(EXEMPLO, 'utf8'))
// Caixa com fundo de `p` mm e paredes de `p` mm, topo aberto: bloco externo menos a cavidade (H - p de altura).
const volCaixa = (L: number, W: number, H: number, p = 2) => L * W * H - (L - 2 * p) * (W - 2 * p) * (H - p)
const hashDe = (m: Malha) => createHash('sha256').update(stl(m)).digest('hex')

function comRegen<T>(fn: (reg: Regenerador) => T): T {
  const reg = new Regenerador()
  try {
    return fn(reg)
  } finally {
    reg.dispose()
  }
}

function regenera(reg: Regenerador, doc: Documento, tol?: number): ResultadoRegen {
  return reg.regenera(entradaDe(doc, tol === undefined ? {} : { tol }))
}

function todosOk(r: ResultadoRegen): void {
  for (const id of IDS) assert.equal(r.status.get(id)?.estado, 'ok', `feature ${id}`)
}

test('exemplo: lê, todas as features ok, caixa e tampa fechadas, volume da caixa', () => {
  comRegen((reg) => {
    const r = regenera(reg, carrega())
    todosOk(r)
    assert.ok(fechada(r.corpos.get('ex1')!))
    assert.ok(fechada(r.corpos.get('ex2')!))
    const esperado = volCaixa(80, 50, 30)
    assert.ok(Math.abs(volume(r.corpos.get('ex1')!) - esperado) <= 0.005 * esperado)
  })
})

test('L = 100: regenera em <= 300 ms, recalcula a partir de ex1 e volume novo', () => {
  comRegen((reg) => {
    const doc = carrega()
    regenera(reg, doc)
    doc.parametros.L.expr = '100'
    const r = regenera(reg, doc)
    console.log(`regeneração com L=100: ${r.ms.toFixed(1)} ms; recalculadas: ${r.recalculadas.join(', ')}`)
    todosOk(r)
    assert.ok(r.ms <= 300, `regeneração demorou ${r.ms.toFixed(1)} ms`)
    assert.equal(r.recalculadas[0], 'ex1')
    assert.ok(fechada(r.corpos.get('ex1')!))
    const esperado = volCaixa(100, 50, 30)
    assert.ok(Math.abs(volume(r.corpos.get('ex1')!) - esperado) <= 0.005 * esperado)
  })
})

test('folga = 0.3: só a aba (ex3) recalcula; a caixa não entra em recalculadas', () => {
  comRegen((reg) => {
    const doc = carrega()
    regenera(reg, doc)
    doc.parametros.folga.expr = '0.3'
    const r = regenera(reg, doc)
    todosOk(r)
    assert.deepEqual(r.recalculadas, ['ex3'])
    assert.ok(fechada(r.corpos.get('ex2')!))
  })
})

test('hash STL (TOL_EXPORT) dos corpos bate com ref_hashes.json (ou grava se ATUALIZA_HASHES=1)', () => {
  const hashes = comRegen((reg) => {
    const r = regenera(reg, carrega(), TOL_EXPORT)
    todosOk(r)
    return { ex1: hashDe(r.corpos.get('ex1')!), ex2: hashDe(r.corpos.get('ex2')!) }
  })
  const ref: Record<string, Record<string, string>> = existsSync(REF) ? JSON.parse(readFileSync(REF, 'utf8')) : {}
  if (process.env.ATUALIZA_HASHES === '1' || !ref[CHAVE]) {
    ref[CHAVE] = hashes
    writeFileSync(REF, JSON.stringify(ref, null, 2) + '\n')
    console.log(`ref_hashes.json gravado (chave ${CHAVE}): ${JSON.stringify(hashes)}`)
    return
  }
  assert.deepEqual(hashes, ref[CHAVE])
})

// Combinações de parâmetros [L, W, H, parede, folga]: a regeneração tem que continuar válida em todas.
const COMBOS: [number, number, number, number, number][] = [
  [80, 50, 30, 2, 0.2],
  [100, 60, 40, 3, 0.3],
  [60, 40, 25, 1.5, 0.15],
  [120, 80, 50, 2.5, 0.5],
]

function comParametros(L: number, W: number, H: number, parede: number, folga: number): Documento {
  const doc = carrega()
  doc.parametros.L.expr = String(L)
  doc.parametros.W.expr = String(W)
  doc.parametros.H.expr = String(H)
  doc.parametros.parede.expr = String(parede)
  doc.parametros.folga.expr = String(folga)
  return doc
}

function assertBBox(b: { min: number[]; max: number[] }, min: number[], max: number[]): void {
  for (let k = 0; k < 3; k++) {
    assert.ok(Math.abs(b.min[k] - min[k]) <= 1e-3, `min[${k}] = ${b.min[k]}, esperado ${min[k]}`)
    assert.ok(Math.abs(b.max[k] - max[k]) <= 1e-3, `max[${k}] = ${b.max[k]}, esperado ${max[k]}`)
  }
}

function manifoldDe(m: Malha) {
  const { pos, idx } = normaliza(m)
  return new Manifold(new wasm.Mesh({ numProp: 3, vertProperties: pos, triVerts: idx }))
}

for (const [L, W, H, p, f] of COMBOS) {
  test(`L=${L} W=${W} H=${H} parede=${p} folga=${f}: ok, fechadas, bbox, folga, sem interferência, volume`, () => {
    comRegen((reg) => {
      const r = regenera(reg, comParametros(L, W, H, p, f))
      todosOk(r)
      const caixa = r.corpos.get('ex1')!
      const tampa = r.corpos.get('ex2')!
      assert.ok(fechada(caixa), 'ex1 não fechada')
      assert.ok(fechada(tampa), 'ex2 não fechada')

      assertBBox(bbox(caixa), [0, 0, 0], [L, W, H])
      assertBBox(bbox(tampa), [0, 0, H - 3], [L, W, H + p])

      // Só os vértices da aba (z < H): têm que caber na cavidade com folga de cada lado.
      const { pos, idx } = normaliza(tampa)
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, nAba = 0
      for (const v of idx) {
        if (pos[v * 3 + 2] >= H - 1e-6) continue
        nAba++
        minX = Math.min(minX, pos[v * 3])
        maxX = Math.max(maxX, pos[v * 3])
        minY = Math.min(minY, pos[v * 3 + 1])
        maxY = Math.max(maxY, pos[v * 3 + 1])
      }
      assert.ok(nAba > 0, 'aba não encontrada abaixo de H')
      assert.ok(minX >= p + f - 1e-3, `aba x min ${minX} < ${p + f}`)
      assert.ok(maxX <= L - p - f + 1e-3, `aba x max ${maxX} > ${L - p - f}`)
      assert.ok(minY >= p + f - 1e-3, `aba y min ${minY} < ${p + f}`)
      assert.ok(maxY <= W - p - f + 1e-3, `aba y max ${maxY} > ${W - p - f}`)

      // Caixa e tampa não podem se sobrepor (encostar em z = H é permitido: volume zero).
      const ma = manifoldDe(caixa)
      const mb = manifoldDe(tampa)
      const inter = ma.intersect(mb)
      try {
        assert.ok(inter.isEmpty() || inter.volume() < 1e-6, `interseção com volume ${inter.volume()}`)
      } finally {
        inter.delete()
        ma.delete()
        mb.delete()
      }

      const esperado = volCaixa(L, W, H, p)
      assert.ok(Math.abs(volume(caixa) - esperado) <= 0.005 * esperado, `volume ${volume(caixa)} vs ${esperado}`)
    })
  })
}

for (const H of [30, 40]) {
  test(`H=${H}: a tampa acompanha H (z mínimo da aba = H-3)`, () => {
    comRegen((reg) => {
      const doc = carrega()
      doc.parametros.H.expr = String(H)
      const r = regenera(reg, doc)
      todosOk(r)
      const b = bbox(r.corpos.get('ex2')!)
      assert.ok(Math.abs(b.min[2] - (H - 3)) <= 1e-3, `z mínimo ${b.min[2]}, esperado ${H - 3}`)
      assert.ok(Math.abs(b.max[2] - (H + 2)) <= 1e-3, `z máximo ${b.max[2]}, esperado ${H + 2}`)
    })
  })
}
