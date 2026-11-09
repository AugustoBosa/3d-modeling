// Ponte entre o sketch do documento (ids string, cotas com expr) e o solver (índices). Sem DOM.
import type { EntSk, RestSk, SketchFeature } from './tipos.ts'
import { ehDimensao } from './tipos.ts'
import { diagnosticarConflito, resolver } from './solver.ts'
import type { Entidade, Restricao, Sketch } from './solver.ts'
import { avalia } from '../expr/expr.ts'
import type { Parametros } from '../expr/expr.ts'

export interface InfoSketch {
  estado: 'subdefinido' | 'definido' | 'conflito'
  dof: number
  residuo: number
  erros: { restricao: string; mensagem: string }[] // expr de cota inválida (id da restrição + erro do avalia)
  culpadas: string[] // ids de restrições cuja remoção resolve o conflito (diagnosticarConflito); [] se não há conflito
}

/** Remove "=" inicial e espaços: "=L" -> "L". */
export function normalizaExpr(texto: string): string {
  return texto.trim().replace(/^=/, '').trim()
}

/** Converte o sketch para o solver, resolve e GRAVA de volta em `sk` as coordenadas dos pontos e o raio dos círculos. */
export function resolveSketch(sk: SketchFeature, parametros: Parametros, opc: { analisar?: boolean; fixos?: Record<string, [number, number]> } = {}): InfoSketch {
  if (sk.plano.offsetExpr) { const r = avalia(sk.plano.offsetExpr, parametros); if (r.ok) sk.plano.offset = r.valor }
  const idx = new Map<string, number>()
  sk.entidades.forEach((e, i) => idx.set(e.id, i))
  const ix = (id: string): number => {
    const i = idx.get(id)
    if (i === undefined) throw new Error(`Entidade "${id}" não existe no sketch.`)
    return i
  }

  const ents: Entidade[] = sk.entidades.map((e: EntSk): Entidade => {
    switch (e.tipo) {
      case 'ponto': return { tipo: 'ponto', x: e.x, y: e.y }
      case 'linha': return { tipo: 'linha', a: ix(e.a), b: ix(e.b) }
      case 'circulo': return { tipo: 'circulo', c: ix(e.c), r: e.r }
      case 'arco': return { tipo: 'arco', c: ix(e.c), a: ix(e.a), b: ix(e.b) }
    }
  })

  const erros: InfoSketch['erros'] = []
  const rests: Restricao[] = []
  const ids: string[] = [] // ids das restrições que entraram no solver (mesma ordem de `rests`)
  for (const r of sk.restricoes as RestSk[]) {
    if (r.ref) continue
    if (!r.e.every((id) => idx.has(id))) { erros.push({ restricao: r.id, mensagem: 'Entidade da restrição não existe.' }); continue }
    const e = r.e.map(ix)
    if (ehDimensao(r.tipo)) {
      if (!r.expr) { erros.push({ restricao: r.id, mensagem: 'Cota sem valor. Digite um número, como 80.' }); continue }
      const av = avalia(normalizaExpr(r.expr), parametros)
      if (!av.ok) { erros.push({ restricao: r.id, mensagem: av.erro }); continue }
      rests.push({ tipo: r.tipo, e, v: r.tipo === 'angulo' ? (av.valor * Math.PI) / 180 : av.valor })
    } else {
      rests.push({ tipo: r.tipo, e, xy: r.xy })
    }
    ids.push(r.id)
  }

  // pontos movidos pelo usuário ficam presos durante a solução (mover uma linha não arrasta o resto do contorno pela média)
  for (const [id, xy] of Object.entries(opc.fixos ?? {})) if (idx.has(id)) { rests.push({ tipo: 'fixa', e: [ix(id)], xy }); ids.push('') }
  const solver: Sketch = { entidades: ents, restricoes: rests }
  const original = structuredClone(solver) // resolver() grava no próprio sketch; o diagnóstico precisa do original
  const res = resolver(solver, { analisar: opc.analisar ?? true })

  sk.entidades.forEach((e, i) => {
    const s = ents[i]
    if (e.tipo === 'ponto' && s.tipo === 'ponto') { e.x = s.x; e.y = s.y }
    if (e.tipo === 'circulo' && s.tipo === 'circulo') e.r = s.r
  })

  const culpadas = res.estado === 'conflito' ? diagnosticarConflito(original).map((i) => ids[i]).filter(Boolean) : []
  return {
    estado: sk.entidades.length === 0 ? 'definido' : res.estado,
    dof: res.dof,
    residuo: res.residuo,
    erros,
    culpadas,
  }
}

/** Valor atual (mm ou graus) de uma cota de referência ou acionadora, medido na geometria. null se não der. */
export function mede(sk: SketchFeature, r: { tipo: string; e: string[] }): number | null {
  const ach = (id: string) => sk.entidades.find((x) => x.id === id)
  const ponto = (id: string) => { const p = ach(id); return p?.tipo === 'ponto' ? p : undefined }
  const raio = (id: string): number | null => {
    const t = ach(id)
    if (t?.tipo === 'circulo') return t.r
    if (t?.tipo === 'arco') {
      const c = ponto(t.c), a = ponto(t.a)
      return c && a ? Math.hypot(a.x - c.x, a.y - c.y) : null
    }
    return null
  }
  // dois pontos, ou uma linha (seus extremos)
  const par = (): [{ x: number; y: number }, { x: number; y: number }] | null => {
    if (r.e.length === 1) {
      const l = ach(r.e[0])
      if (l?.tipo !== 'linha') return null
      const p = ponto(l.a), q = ponto(l.b)
      return p && q ? [p, q] : null
    }
    if (r.e.length === 2) {
      const p = ponto(r.e[0]), q = ponto(r.e[1])
      return p && q ? [p, q] : null
    }
    return null
  }
  // vetor de uma linha
  const vetor = (id: string): [number, number] | null => {
    const l = ach(id)
    if (l?.tipo !== 'linha') return null
    const p = ponto(l.a), q = ponto(l.b)
    return p && q ? [q.x - p.x, q.y - p.y] : null
  }

  switch (r.tipo) {
    case 'distancia': { const pq = par(); return pq ? Math.hypot(pq[1].x - pq[0].x, pq[1].y - pq[0].y) : null }
    case 'distanciaH': { const pq = par(); return pq ? Math.abs(pq[1].x - pq[0].x) : null }
    case 'distanciaV': { const pq = par(); return pq ? Math.abs(pq[1].y - pq[0].y) : null }
    case 'raio': return r.e.length === 1 ? raio(r.e[0]) : null
    case 'diametro': { const R = r.e.length === 1 ? raio(r.e[0]) : null; return R === null ? null : 2 * R }
    case 'angulo': {
      const u = r.e.length === 2 ? vetor(r.e[0]) : null, w = r.e.length === 2 ? vetor(r.e[1]) : null
      return u && w ? (Math.atan2(u[0] * w[1] - u[1] * w[0], u[0] * w[0] + u[1] * w[1]) * 180) / Math.PI : null
    }
    default: return null
  }
}
