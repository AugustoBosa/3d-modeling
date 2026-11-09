// Auxílios de precisão do sketch: OSNAP (pontos notáveis), ORTHO, POLAR e GRADE. Funções puras, mm e radianos.
import type { Pt, SketchFeature } from './tipos.ts'
import {
  EPS, dist, projetaNaLinha, interSegmentos, interLinhaCirculo, interCirculoCirculo, noArco, anguloDe, varreduraArco,
} from './geometria.ts'

export type TipoSnap = 'extremidade' | 'medio' | 'centro' | 'quadrante' | 'intersecao' | 'perpendicular' | 'tangente' | 'proximo' | 'grade' | 'polar' | 'ortho'
/** `ref`: id do PONTO existente (extremidade/centro) ou da entidade (proximo/medio/...). */
export interface Alvo { p: Pt; tipo: TipoSnap; ref?: string }
export interface OpcoesSnap {
  tol: number                 // raio de captura em mm (o chamador converte pixels em mm)
  osnap: boolean; ortho: boolean; polar: boolean; grade: boolean
  passoGrade: number          // mm (SNAP)
  polarGraus: number          // incremento, ex. 15
  ultimo?: Pt | null          // último ponto especificado (base de ortho/polar/perpendicular/tangente)
  shift?: boolean             // Shift inverte o ORTHO (como no AutoCAD): ortho vira !ortho
}

const PRIORIDADE: TipoSnap[] = ['extremidade', 'centro', 'medio', 'quadrante', 'intersecao', 'perpendicular', 'tangente', 'proximo']

type Curva =
  | { id: string; tipo: 'linha'; a: Pt; b: Pt }
  | { id: string; tipo: 'circulo'; c: Pt; r: number; pc: string }
  | { id: string; tipo: 'arco'; c: Pt; r: number; a: Pt; b: Pt; pc: string }

const pontosMap = (sk: SketchFeature): Map<string, Pt> => {
  const m = new Map<string, Pt>()
  for (const e of sk.entidades) if (e.tipo === 'ponto') m.set(e.id, { x: e.x, y: e.y })
  return m
}

// Entidades com as coordenadas já resolvidas (ignora as que referenciam ponto inexistente).
function curvas(sk: SketchFeature, m: Map<string, Pt>): Curva[] {
  const out: Curva[] = []
  for (const e of sk.entidades) {
    if (e.tipo === 'linha') {
      const a = m.get(e.a), b = m.get(e.b)
      if (a && b) out.push({ id: e.id, tipo: 'linha', a, b })
    } else if (e.tipo === 'circulo') {
      const c = m.get(e.c)
      if (c) out.push({ id: e.id, tipo: 'circulo', c, r: e.r, pc: e.c })
    } else if (e.tipo === 'arco') {
      const c = m.get(e.c), a = m.get(e.a), b = m.get(e.b)
      if (c && a && b) out.push({ id: e.id, tipo: 'arco', c, r: dist(c, a), a, b, pc: e.c })
    }
  }
  return out
}

const emAngulo = (c: Pt, r: number, t: number): Pt => ({ x: c.x + r * Math.cos(t), y: c.y + r * Math.sin(t) })

// Ponto da curva mais perto de p (na linha: segmento; no arco: só a parte do arco).
function maisPerto(c: Curva, p: Pt): Pt {
  if (c.tipo === 'linha') {
    const t = Math.min(1, Math.max(0, projetaNaLinha(p, c.a, c.b).t))
    return { x: c.a.x + t * (c.b.x - c.a.x), y: c.a.y + t * (c.b.y - c.a.y) }
  }
  const q = emAngulo(c.c, c.r, anguloDe(c.c, p))
  if (c.tipo === 'circulo') return q
  if (noArco(q, c.c, c.a, c.b)) return q
  return dist(p, c.a) <= dist(p, c.b) ? c.a : c.b
}

function interLinhaCurva(l: Extract<Curva, { tipo: 'linha' }>, k: Curva): Pt[] {
  if (k.tipo === 'linha') return []
  return interLinhaCirculo(l.a, l.b, k.c, k.r, true).filter(p => k.tipo === 'circulo' || noArco(p, k.c, k.a, k.b))
}

function interCurvas(x: Curva, y: Curva): Pt[] {
  if (x.tipo === 'linha' && y.tipo === 'linha') {
    const p = interSegmentos(x.a, x.b, y.a, y.b)
    return p ? [p] : []
  }
  if (x.tipo === 'linha') return interLinhaCurva(x, y)
  if (y.tipo === 'linha') return interLinhaCurva(y, x)
  if (x.tipo === 'circulo' && y.tipo === 'circulo') return interCirculoCirculo(x.c, x.r, y.c, y.r)
  return []
}

/** Todos os candidatos de OSNAP perto do cursor (distância <= tol), ordenados por prioridade e depois pela distância. */
export function candidatosOsnap(sk: SketchFeature, cursor: Pt, o: OpcoesSnap, excluir: string[] = []): Alvo[] {
  const ex = new Set(excluir)
  const m = pontosMap(sk)
  const cs = curvas(sk, m).filter(c => !ex.has(c.id))
  const out: Alvo[] = []
  const add = (p: Pt, tipo: TipoSnap, ref?: string) => {
    if (dist(p, cursor) <= o.tol) out.push(ref === undefined ? { p, tipo } : { p, tipo, ref })
  }

  for (const [id, p] of m) if (!ex.has(id)) add(p, 'extremidade', id)

  for (const c of cs) {
    if (c.tipo === 'linha') {
      add({ x: (c.a.x + c.b.x) / 2, y: (c.a.y + c.b.y) / 2 }, 'medio', c.id)
      continue
    }
    if (c.tipo === 'arco') add(emAngulo(c.c, c.r, anguloDe(c.c, c.a) + varreduraArco(c.c, c.a, c.b) / 2), 'medio', c.id)
    if (!ex.has(c.pc)) add(c.c, 'centro', c.pc)
    for (let k = 0; k < 4; k++) {
      const p = emAngulo(c.c, c.r, (k * Math.PI) / 2)
      if (c.tipo === 'circulo' || noArco(p, c.c, c.a, c.b)) add(p, 'quadrante', c.id)
    }
  }

  const perto = cs.filter(c => dist(maisPerto(c, cursor), cursor) <= o.tol)
  for (let i = 0; i < perto.length; i++)
    for (let j = i + 1; j < perto.length; j++)
      for (const p of interCurvas(perto[i], perto[j])) add(p, 'intersecao')

  if (o.ultimo) {
    const u = o.ultimo
    for (const c of cs) {
      if (c.tipo === 'linha') {
        const q = projetaNaLinha(u, c.a, c.b)
        if (q.t >= 0 && q.t <= 1) add(q.pt, 'perpendicular', c.id)
        continue
      }
      const d = dist(u, c.c)
      if (d <= c.r) continue
      const base = Math.atan2(u.y - c.c.y, u.x - c.c.x), alfa = Math.acos(c.r / d)
      for (const s of [1, -1]) {
        const t = emAngulo(c.c, c.r, base + s * alfa)
        if (c.tipo === 'circulo' || noArco(t, c.c, c.a, c.b)) add(t, 'tangente', c.id)
      }
    }
  }

  for (const c of cs) add(maisPerto(c, cursor), 'proximo', c.id)

  out.sort((p, q) => PRIORIDADE.indexOf(p.tipo) - PRIORIDADE.indexOf(q.tipo) || dist(p.p, cursor) - dist(q.p, cursor))
  return out
}

/** OSNAP (se ligado e houver candidato); senão ORTHO ou POLAR (a partir de `ultimo`); senão GRADE; senão cursor livre. */
export function resolveSnap(sk: SketchFeature, cursor: Pt, o: OpcoesSnap, excluir?: string[]): Alvo | null {
  if (o.osnap) {
    const c = candidatosOsnap(sk, cursor, o, excluir)
    if (c.length > 0) return c[0]
  }
  const ortho = o.shift ? !o.ortho : o.ortho
  const u = o.ultimo
  if (u && ortho) {
    const dx = cursor.x - u.x, dy = cursor.y - u.y
    return { p: Math.abs(dx) >= Math.abs(dy) ? { x: cursor.x, y: u.y } : { x: u.x, y: cursor.y }, tipo: 'ortho' }
  }
  if (u && o.polar) {
    const r = dist(u, cursor)
    const passo = (o.polarGraus * Math.PI) / 180
    const ang = anguloDe(u, cursor)
    const alvo = Math.round(ang / passo) * passo
    if (r > EPS && Math.abs(ang - alvo) <= (3 * Math.PI) / 180) {
      return { p: { x: u.x + r * Math.cos(alvo), y: u.y + r * Math.sin(alvo) }, tipo: 'polar' }
    }
  }
  if (o.grade) {
    const g = o.passoGrade
    return { p: { x: Math.round(cursor.x / g) * g, y: Math.round(cursor.y / g) * g }, tipo: 'grade' }
  }
  return ortho ? { p: cursor, tipo: 'ortho' } : null
}
