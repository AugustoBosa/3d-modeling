// Regeneração de um pedido, sem DOM e sem self: roda no worker (gera.worker.ts) e nos testes do Node.
import type { Documento } from '@3dm/core/doc'
import { entradaDe } from '@3dm/core/features'
import { normaliza } from '@3dm/core/malha'
import type { Regenerador, StatusFeature } from '@3dm/core/regen'

export type Pedido = { id: number; tipo: 'regen'; doc: Documento; tol?: number }
export interface CorpoBuf { id: string; pos: Float32Array; idx: Uint32Array }
export type Resposta =
  | { id: number; ms: number; recalculadas: string[]; status: [string, StatusFeature][]; corpos: CorpoBuf[] }
  | { id: number; erro: string }

export function processa(q: Pedido, reg: Regenerador): Resposta {
  const t0 = performance.now()
  try {
    const r = reg.regenera(entradaDe(q.doc, { tol: q.tol }))
    const corpos: CorpoBuf[] = []
    for (const [id, m] of r.corpos) {
      const { pos, idx } = normaliza(m)
      // copia sempre: o Regenerador guarda as malhas no cache, e transferir o buffer original as deixaria vazias
      corpos.push({ id, pos: pos.slice(), idx: idx.slice() })
    }
    return { id: q.id, ms: performance.now() - t0, recalculadas: r.recalculadas, status: [...r.status], corpos }
  } catch (e) {
    return { id: q.id, erro: e instanceof Error ? e.message : String(e) }
  }
}
