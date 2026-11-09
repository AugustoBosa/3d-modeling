import { test } from 'node:test'
import assert from 'node:assert/strict'
import { novoDocumento } from '@3dm/core/doc'
import type { Feature } from '@3dm/core/doc'
import { Regenerador } from '@3dm/core/regen'
import { processa } from '../src/worker/processa.ts'
import type { CorpoBuf, Pedido, Resposta } from '../src/worker/processa.ts'

type Ok = Extract<Resposta, { corpos: CorpoBuf[] }>

function sucesso(r: Resposta): Ok {
  assert.ok(!('erro' in r), 'erro' in r ? r.erro : '')
  return r
}

const docDe = (features: Feature[]) => ({ ...novoDocumento(), features })
const base: Feature[] = [
  { id: 'b', tipo: 'caixa', pos: [0, 0, 0], dim: [10, 20, 30] },
  { id: 'c', tipo: 'cilindro', pos: [50, 0, 0], dim: [5, 10] },
] as Feature[]

test('processa: regenera, copia corpos e reaproveita o cache', () => {
  const reg = new Regenerador()
  try {
    const q = (doc: Pedido['doc']): Pedido => ({ id: 1, tipo: 'regen', doc })
    const r1 = sucesso(processa(q(docDe(base)), reg))
    assert.equal(r1.corpos.length, 2)
    for (const c of r1.corpos) assert.ok(c.idx.length / 3 > 0, c.id)
    assert.deepEqual(r1.recalculadas, ['b', 'c'])
    assert.equal(r1.status.find(([id]) => id === 'b')?.[1].estado, 'ok')

    const r2 = sucesso(processa(q(docDe(base)), reg))
    assert.deepEqual(r2.recalculadas, [])
    assert.equal(r2.corpos.length, 2)
  } finally {
    reg.dispose()
  }
})

test('processa: erro em uma feature não derruba o corpo anterior', () => {
  const reg = new Regenerador()
  try {
    const ruim: Feature[] = [base[0], { id: 'c', tipo: 'cilindro', pos: [50, 0, 0], dim: [0, 10] }] as Feature[]
    const r = sucesso(processa({ id: 2, tipo: 'regen', doc: docDe(ruim) }, reg))
    assert.equal(r.status.find(([id]) => id === 'c')?.[1].estado, 'erro')
    assert.ok(r.corpos.some((c) => c.id === 'b'))
  } finally {
    reg.dispose()
  }
})
