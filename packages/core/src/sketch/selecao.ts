// Seleção de entidades do sketch: clique (acha), retângulo (porRetangulo) e todas. Funções puras, mm. Sem DOM.
import type { EntSk, Pt, SketchFeature } from './tipos.ts'
import { EPS, dist, interLinhaCirculo, interSegmentos, noArco, projetaNaLinha } from './geometria.ts'

const pontoDe = (sk: SketchFeature, id: string): Pt | undefined => {
  const e = sk.entidades.find((x) => x.id === id)
  return e?.tipo === 'ponto' ? e : undefined
}

/** Distância de p à entidade (curva ou segmento). Infinity se o arco não cobre p ou falta um ponto. `tol` vira tolerância angular no arco. */
function distEnt(sk: SketchFeature, e: EntSk, p: Pt, tol: number): number {
  switch (e.tipo) {
    case 'ponto': return dist(p, e)
    case 'linha': {
      const a = pontoDe(sk, e.a), b = pontoDe(sk, e.b)
      if (!a || !b) return Infinity
      const t = Math.min(1, Math.max(0, projetaNaLinha(p, a, b).t))
      return dist(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) })
    }
    case 'circulo': {
      const c = pontoDe(sk, e.c)
      return c ? Math.abs(dist(p, c) - e.r) : Infinity
    }
    case 'arco': {
      const c = pontoDe(sk, e.c), a = pontoDe(sk, e.a), b = pontoDe(sk, e.b)
      if (!c || !a || !b) return Infinity
      const r = dist(c, a)
      return noArco(p, c, a, b, r > EPS ? tol / r : EPS) ? Math.abs(dist(p, c) - r) : Infinity
    }
  }
}

/** Entidade sob o cursor (tolerância tol em mm). Prioridade: ponto > linha/arco/círculo (a mais perto). Retorna o id ou null. `ignorar` = ids a não considerar. */
export function acha(sk: SketchFeature, p: Pt, tol: number, ignorar: string[] = []): string | null {
  let ponto: string | null = null, dPonto = Infinity
  let curva: string | null = null, dCurva = Infinity
  for (const e of sk.entidades) {
    if (ignorar.includes(e.id)) continue
    if (e.tipo === 'ponto') {
      const d = dist(p, e)
      if (d <= tol && d < dPonto) { dPonto = d; ponto = e.id }
    } else {
      const d = distEnt(sk, e, p, tol)
      if (d <= tol && d < dCurva) { dCurva = d; curva = e.id }
    }
  }
  return ponto ?? curva
}

/** Seleção por retângulo. a.x < b.x (esquerda -> direita) = JANELA: só o que está inteiro dentro.
 *  Caso contrário = CRUZAMENTO: tudo que toca o retângulo. Pontos dentro entram nos dois modos. */
export function porRetangulo(sk: SketchFeature, a: Pt, b: Pt): { ids: string[]; modo: 'janela' | 'cruzamento' } {
  const modo = a.x < b.x ? 'janela' : 'cruzamento'
  const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y)
  const dentro = (p: Pt) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1
  const bordas: [Pt, Pt][] = [
    [{ x: x0, y: y0 }, { x: x1, y: y0 }], [{ x: x1, y: y0 }, { x: x1, y: y1 }],
    [{ x: x1, y: y1 }, { x: x0, y: y1 }], [{ x: x0, y: y1 }, { x: x0, y: y0 }],
  ]
  // pontos que definem a caixa de um círculo (ini/fim undefined) ou de um arco (extremos + cardeais que estão no arco)
  const extremos = (c: Pt, r: number, ini?: Pt, fim?: Pt): Pt[] => {
    const cardeais = [0, 1, 2, 3].map((k) => ({ x: c.x + r * Math.cos((k * Math.PI) / 2), y: c.y + r * Math.sin((k * Math.PI) / 2) }))
    return ini && fim ? [ini, fim, ...cardeais.filter((p) => noArco(p, c, ini, fim))] : cardeais
  }

  const naJanela = (e: EntSk): boolean => {
    switch (e.tipo) {
      case 'ponto': return dentro(e)
      case 'linha': {
        const p = pontoDe(sk, e.a), q = pontoDe(sk, e.b)
        return !!p && !!q && dentro(p) && dentro(q)
      }
      case 'circulo': {
        const c = pontoDe(sk, e.c)
        return !!c && extremos(c, e.r).every(dentro)
      }
      case 'arco': {
        const c = pontoDe(sk, e.c), ini = pontoDe(sk, e.a), fim = pontoDe(sk, e.b)
        return !!c && !!ini && !!fim && extremos(c, dist(c, ini), ini, fim).every(dentro)
      }
    }
  }

  const toca = (e: EntSk): boolean => {
    switch (e.tipo) {
      case 'ponto': return dentro(e)
      case 'linha': {
        const p = pontoDe(sk, e.a), q = pontoDe(sk, e.b)
        if (!p || !q) return false
        return dentro(p) || dentro(q) || bordas.some(([u, v]) => interSegmentos(p, q, u, v) !== null)
      }
      case 'circulo': {
        const c = pontoDe(sk, e.c)
        if (!c) return false
        const dx = Math.max(x0 - c.x, 0, c.x - x1), dy = Math.max(y0 - c.y, 0, c.y - y1)
        return Math.hypot(dx, dy) <= e.r
      }
      case 'arco': {
        const c = pontoDe(sk, e.c), ini = pontoDe(sk, e.a), fim = pontoDe(sk, e.b)
        if (!c || !ini || !fim) return false
        const r = dist(c, ini)
        return dentro(ini) || dentro(fim) ||
          bordas.some(([u, v]) => interLinhaCirculo(u, v, c, r, true).some((p) => noArco(p, c, ini, fim)))
      }
    }
  }

  return { ids: sk.entidades.filter(modo === 'janela' ? naJanela : toca).map((e) => e.id), modo }
}

/** Todas as entidades (id). O modelo de sketch ainda não tem entidade "escondida". */
export function todas(sk: SketchFeature): string[] {
  return sk.entidades.map((e) => e.id)
}
