// Cotas: DIM inteligente (PROJETO_BASE §6.5), cotas temporárias (estilo Revit) e posição do rótulo. Funções puras (mm, graus).
import type { EntSk, Pt, RestSk, SketchFeature, TipoRestSk } from './tipos.ts'
import { EPS, dist, interSegmentos } from './geometria.ts'
import { mede } from './ponte.ts'

/** Até 4 casas decimais, sem zeros à toa: 80, 12.5. */
const fmt = (v: number): string => String(Number(v.toFixed(4)))

const ent = (sk: SketchFeature, id: string): EntSk | undefined => sk.entidades.find((x) => x.id === id)
const pt = (sk: SketchFeature, id: string): Pt | undefined => {
  const e = ent(sk, id)
  return e?.tipo === 'ponto' ? { x: e.x, y: e.y } : undefined
}
const centro = (sk: SketchFeature, id: string): Pt | undefined => {
  const e = ent(sk, id)
  return e?.tipo === 'circulo' || e?.tipo === 'arco' ? pt(sk, e.c) : undefined
}
/** Extremos de uma linha (1 id) ou dos dois pontos (2 ids). */
function extremos(sk: SketchFeature, ids: string[]): [Pt, Pt] | null {
  if (ids.length === 2) {
    const p = pt(sk, ids[0]), q = pt(sk, ids[1])
    return p && q ? [p, q] : null
  }
  const l = ent(sk, ids[0])
  if (ids.length !== 1 || l?.tipo !== 'linha') return null
  const p = pt(sk, l.a), q = pt(sk, l.b)
  return p && q ? [p, q] : null
}
const vetor = (sk: SketchFeature, l: { a: string; b: string }): [number, number] | undefined => {
  const p = pt(sk, l.a), q = pt(sk, l.b)
  return p && q ? [q.x - p.x, q.y - p.y] : undefined
}
const mesmos = (x: string[], y: string[]): boolean =>
  x.length === y.length && [...x].sort().join() === [...y].sort().join()

/** DIM inteligente: pelo que foi selecionado, a cota a criar (sem id), ou null.
 *  1 linha -> distancia (comprimento, também quando é quase H/V); 1 círculo -> diametro (modo 'R' -> raio); 1 arco -> raio;
 *  2 pontos -> distancia (modo 'H' -> distanciaH, 'V' -> distanciaV); 2 linhas não paralelas -> angulo; o resto -> null.
 *  Se já existe cota do mesmo tipo nas mesmas entidades, devolve essa com `duplicada: true`. */
export function dimInteligente(
  sk: SketchFeature, ids: string[], modo?: 'H' | 'V' | 'R',
): (Omit<RestSk, 'id'> & { duplicada?: boolean; existenteId?: string }) | null {
  if (ids.length === 0 || ids.length > 2) return null
  const e1 = ent(sk, ids[0])
  const e2 = ids.length === 2 ? ent(sk, ids[1]) : undefined
  if (!e1 || (ids.length === 2 && !e2)) return null

  let tipo: TipoRestSk
  if (ids.length === 1) {
    if (e1.tipo === 'linha') tipo = 'distancia'
    else if (e1.tipo === 'circulo') tipo = modo === 'R' ? 'raio' : 'diametro'
    else if (e1.tipo === 'arco') tipo = 'raio'
    else return null
  } else if (e1.tipo === 'ponto' && e2?.tipo === 'ponto') {
    tipo = modo === 'H' ? 'distanciaH' : modo === 'V' ? 'distanciaV' : 'distancia'
  } else if (e1.tipo === 'linha' && e2?.tipo === 'linha') {
    // paralelas: distância entre linhas não existe no solver
    const u = vetor(sk, e1), w = vetor(sk, e2)
    if (!u || !w || Math.abs(u[0] * w[1] - u[1] * w[0]) <= EPS * Math.hypot(u[0], u[1]) * Math.hypot(w[0], w[1])) return null
    tipo = 'angulo'
  } else return null

  const dup = sk.restricoes.find((r) => r.tipo === tipo && mesmos(r.e, ids))
  if (dup) {
    const { id, ...resto } = dup
    return { ...resto, duplicada: true, existenteId: id }
  }
  const v = mede(sk, { tipo, e: ids })
  return v === null ? null : { tipo, e: [...ids], expr: fmt(v) }
}

export interface CotaTemp { de: Pt; para: Pt; valor: number; tipo: 'distanciaH' | 'distanciaV' | 'distancia'; e: string[] }

/** Cotas temporárias (não entram no documento). Ponto: H e V até o ponto mais próximo em cada sentido (outros pontos e a origem 0,0).
 *  Linha: comprimento. Círculo/arco: nenhuma. Na origem, `e` tem só o id do ponto (não vira cota permanente). */
export function cotasTemporarias(sk: SketchFeature, id: string): CotaTemp[] {
  const e = ent(sk, id)
  if (e?.tipo === 'linha') {
    const pq = extremos(sk, [id])
    return pq ? [{ de: pq[0], para: pq[1], valor: dist(pq[0], pq[1]), tipo: 'distancia', e: [id] }] : []
  }
  if (e?.tipo !== 'ponto') return []

  type Ref = { p: Pt; id?: string }
  const refs: Ref[] = [
    { p: { x: 0, y: 0 } },
    ...sk.entidades.flatMap((x): Ref[] => (x.tipo === 'ponto' && x.id !== id ? [{ p: { x: x.x, y: x.y }, id: x.id }] : [])),
  ]
  const dirs = [
    { eixo: 'x', sinal: -1, tipo: 'distanciaH' }, // esquerda
    { eixo: 'x', sinal: 1, tipo: 'distanciaH' }, // direita
    { eixo: 'y', sinal: -1, tipo: 'distanciaV' }, // abaixo
    { eixo: 'y', sinal: 1, tipo: 'distanciaV' }, // acima
  ] as const

  const cotas: CotaTemp[] = []
  for (const d of dirs) {
    // quanto > 0 = o ponto de referência está nesse sentido; menor quanto = mais próximo
    const quanto = (p: Pt) => (p[d.eixo] - e[d.eixo]) * d.sinal
    const cands = refs.filter((r) => quanto(r.p) > EPS)
    if (cands.length === 0) continue
    const r = cands.reduce((m, c) => (quanto(c.p) < quanto(m.p) ? c : m))
    cotas.push({ de: r.p, para: { x: e.x, y: e.y }, valor: quanto(r.p), tipo: d.tipo, e: r.id ? [r.id, id] : [id] })
  }
  return cotas
}

/** Posição sugerida do rótulo e texto de uma cota existente. null se a cota não se mede. `ref` põe o texto entre parênteses. */
export function ancoraCota(sk: SketchFeature, r: RestSk): { p: Pt; texto: string } | null {
  const v = mede(sk, r)
  if (v === null) return null
  const txt = (t: string) => (r.ref ? `(${t})` : t)
  switch (r.tipo) {
    case 'distancia':
    case 'distanciaH':
    case 'distanciaV': {
      const pq = extremos(sk, r.e)
      if (!pq) return null
      const [p, q] = pq
      const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2, d = dist(p, q)
      let at: Pt = { x: mx, y: my }
      if (r.tipo === 'distanciaH') at = { x: mx, y: Math.max(p.y, q.y) + 4 }
      else if (r.tipo === 'distanciaV') at = { x: Math.max(p.x, q.x) + 4, y: my }
      else if (d > EPS) at = { x: mx - ((q.y - p.y) / d) * 4, y: my + ((q.x - p.x) / d) * 4 }
      return { p: at, texto: txt(fmt(v)) }
    }
    case 'diametro':
    case 'raio': {
      const c = centro(sk, r.e[0])
      if (!c) return null
      const R = r.tipo === 'raio' ? v : v / 2
      return r.tipo === 'diametro'
        ? { p: { x: c.x, y: c.y + R + 4 }, texto: txt(`Ø${fmt(v)}`) }
        : { p: { x: c.x + R + 4, y: c.y }, texto: txt(`R${fmt(v)}`) }
    }
    case 'angulo': {
      const l1 = extremos(sk, [r.e[0]]), l2 = extremos(sk, [r.e[1]])
      if (!l1 || !l2) return null
      // vértice = interseção das retas; se paralelas, média dos quatro extremos
      const vert = interSegmentos(l1[0], l1[1], l2[0], l2[1], false) ?? {
        x: (l1[0].x + l1[1].x + l2[0].x + l2[1].x) / 4,
        y: (l1[0].y + l1[1].y + l2[0].y + l2[1].y) / 4,
      }
      return { p: vert, texto: txt(`${fmt(v)}°`) }
    }
    default: return null
  }
}
