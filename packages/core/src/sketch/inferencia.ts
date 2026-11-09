// Inferência automática de restrições para uma adição (linha/arco/ponto) recém-desenhada. Funções puras.
import type { Adicao, Pt, RestSk, SketchFeature, TipoRestSk } from './tipos.ts'
import { EPS, dist, projetaNaLinha, noArco } from './geometria.ts'

const TOL_PONTO = 1e-6 // mm

/** Dada uma adição pronta, devolve restrições a ACRESCENTAR (ids locais '@r1', '@r2'...). `suprimir` (Shift) devolve []. */
export function infere(sk: SketchFeature, a: Adicao, opc: { tolGraus?: number; suprimir?: boolean } = {}): RestSk[] {
  if (opc.suprimir) return []
  const tolRad = ((opc.tolGraus ?? 2) * Math.PI) / 180
  const pontosSk = new Map<string, Pt>()
  for (const e of sk.entidades) if (e.tipo === 'ponto') pontosSk.set(e.id, { x: e.x, y: e.y })
  const todos = new Map(pontosSk)
  for (const e of a.entidades) if (e.tipo === 'ponto') todos.set(e.id, { x: e.x, y: e.y })

  const out: RestSk[] = []
  const chave = (tipo: TipoRestSk, e: string[]) => tipo + ':' + [...e].sort().join('|')
  const vistos = new Set(a.restricoes.map(r => chave(r.tipo, r.e))) // não duplica o que a adição já traz
  const add = (tipo: TipoRestSk, e: string[]) => {
    const k = chave(tipo, e)
    if (vistos.has(k)) return
    vistos.add(k)
    out.push({ id: '@r' + (out.length + 1), tipo, e })
  }

  // Linhas quase horizontais/verticais (ângulo normalizado para (-90, 90] graus).
  for (const l of a.entidades) {
    if (l.tipo !== 'linha') continue
    const p = todos.get(l.a), q = todos.get(l.b)
    if (!p || !q) continue
    const dx = q.x - p.x, dy = q.y - p.y
    if (Math.hypot(dx, dy) < EPS) continue
    let t = Math.atan2(dy, dx)
    if (t > Math.PI / 2) t -= Math.PI
    else if (t <= -Math.PI / 2) t += Math.PI
    if (Math.abs(t) <= tolRad) add('horizontal', [l.id])
    else if (Math.abs(Math.abs(t) - Math.PI / 2) <= tolRad) add('vertical', [l.id])
  }

  // Pontos novos da adição: coincidente com ponto existente, senão sobre linha/círculo/arco existente.
  for (const n of a.entidades) {
    if (n.tipo !== 'ponto' || pontosSk.has(n.id)) continue
    const p: Pt = { x: n.x, y: n.y }
    let coincide = false
    for (const [id, q] of pontosSk) {
      if (dist(p, q) <= TOL_PONTO) {
        add('coincidente', [n.id, id])
        coincide = true
        break
      }
    }
    if (coincide) continue
    for (const c of sk.entidades) {
      if (c.tipo === 'linha') {
        const la = pontosSk.get(c.a), lb = pontosSk.get(c.b)
        if (!la || !lb) continue
        const r = projetaNaLinha(p, la, lb)
        if (r.t >= -EPS && r.t <= 1 + EPS && dist(p, r.pt) <= TOL_PONTO) add('pontoNaCurva', [n.id, c.id])
      } else if (c.tipo === 'circulo') {
        const centro = pontosSk.get(c.c)
        if (centro && Math.abs(dist(p, centro) - c.r) <= TOL_PONTO) add('pontoNaCurva', [n.id, c.id])
      } else if (c.tipo === 'arco') {
        const centro = pontosSk.get(c.c), ea = pontosSk.get(c.a), eb = pontosSk.get(c.b)
        if (!centro || !ea || !eb) continue
        if (Math.abs(dist(p, centro) - dist(centro, ea)) > TOL_PONTO) continue
        if (noArco(p, centro, ea, eb)) add('pontoNaCurva', [n.id, c.id])
      }
    }
  }

  // Arco novo que termina no extremo de uma linha existente, com a mesma direção (tangente, <= 1 grau).
  const senTanTol = Math.sin(Math.PI / 180)
  for (const arco of a.entidades) {
    if (arco.tipo !== 'arco') continue
    const c = todos.get(arco.c)
    if (!c) continue
    for (const ext of [todos.get(arco.a), todos.get(arco.b)]) {
      if (!ext) continue
      const rx = ext.x - c.x, ry = ext.y - c.y
      const rLen = Math.hypot(rx, ry)
      if (rLen < EPS) continue
      for (const l of sk.entidades) {
        if (l.tipo !== 'linha') continue
        const la = pontosSk.get(l.a), lb = pontosSk.get(l.b)
        if (!la || !lb) continue
        if (dist(la, ext) > TOL_PONTO && dist(lb, ext) > TOL_PONTO) continue
        const dx = lb.x - la.x, dy = lb.y - la.y
        const dLen = Math.hypot(dx, dy)
        if (dLen < EPS) continue
        // reta tangente ao arco <=> perpendicular ao raio no ponto de contato
        if (Math.abs(dx * rx + dy * ry) / (dLen * rLen) <= senTanTol) add('tangente', [arco.id, l.id])
      }
    }
  }
  return out
}
