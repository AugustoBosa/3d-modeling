import { test } from 'node:test'
import assert from 'node:assert/strict'

// Worker falso: guarda as mensagens e deixa o teste dizer quando fica "pronto".
class WorkerFalso {
  onmessage: ((e: { data: unknown }) => void) | null = null
  onerror: (() => void) | null = null
  msgs: { id: number }[] = []
  constructor() { workers.push(this) }
  postMessage(m: { id: number }) { this.msgs.push(m) }
  terminate() {}
}
const workers: WorkerFalso[] = []
Object.assign(globalThis, { Worker: WorkerFalso })
const { criaGeometria, DEBOUNCE_MS } = await import('../src/worker/cliente.ts')

const espera = (ms: number) => new Promise(r => setTimeout(r, ms))
const doc = {} as Parameters<ReturnType<typeof criaGeometria>['pede']>[0]

test('reinicia antes do "pronto": o pedido pendente resolve null em vez de travar', async () => {
  const g = criaGeometria()
  workers[0].onmessage!({ data: 'pronto' })
  g.reinicia() // worker 2, ainda carregando
  const p = g.pede(doc)
  g.reinicia() // worker 2 morre sem avisar "pronto"
  assert.equal(await Promise.race([p, espera(200).then(() => 'travou')]), null)

  // o worker novo segue atendendo
  const w = workers.at(-1)!
  w.onmessage!({ data: 'pronto' })
  const q = g.pede(doc)
  await espera(DEBOUNCE_MS + 20)
  w.onmessage!({ data: { id: w.msgs[0].id } })
  assert.deepEqual(await q, { id: w.msgs[0].id })
  g.dispose()
})
