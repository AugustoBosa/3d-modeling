// Worker de geometria: o WASM do manifold carrega pelo top-level await dos imports (por isso 'pronto' só sai depois).
import { Regenerador } from '@3dm/core/regen'
import { processa } from './processa.ts'
import type { Pedido, Resposta } from './processa.ts'

const reg = new Regenerador()
const w = self as unknown as { postMessage(m: Resposta | 'pronto', t?: Transferable[]): void; onmessage: ((e: MessageEvent<Pedido>) => void) | null }

w.onmessage = ({ data: q }) => {
  const r = processa(q, reg)
  const transf = 'corpos' in r ? r.corpos.flatMap((c) => [c.pos.buffer, c.idx.buffer]) as ArrayBuffer[] : []
  w.postMessage(r, transf)
}
w.postMessage('pronto')
