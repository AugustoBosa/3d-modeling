// Operações de edição do sketch. Todas MUTAM o SketchFeature recebido (o chamador faz o snapshot para undo).
import type { EntSk, Pt, SketchFeature } from './tipos.ts'
import { novoId, ORIGEM } from './tipos.ts'

type Transf = (p: Pt) => Pt

const mapa = (sk: SketchFeature) => new Map(sk.entidades.map((e) => [e.id, e] as const))
/** Ids de pontos que a entidade usa (ponto: nenhum; o próprio ponto é tratado à parte). */
const refs = (e: EntSk): string[] =>
  e.tipo === 'ponto' ? [] : e.tipo === 'linha' ? [e.a, e.b] : e.tipo === 'circulo' ? [e.c] : [e.c, e.a, e.b]
const exigeInteiro = (n: number) => {
  if (!Number.isInteger(n) || n < 1) throw new Error('A quantidade deve ser um inteiro maior ou igual a 1.')
}
const translacao = (dx: number, dy: number): Transf => (p) => ({ x: p.x + dx, y: p.y + dy })
const rotacao = (c: Pt, graus: number): Transf => {
  const r = (graus * Math.PI) / 180, co = Math.cos(r), si = Math.sin(r)
  return (p) => ({ x: c.x + (p.x - c.x) * co - (p.y - c.y) * si, y: c.y + (p.x - c.x) * si + (p.y - c.y) * co })
}
function refletir(a: Pt, b: Pt): Transf {
  const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy
  return (p) => {
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / d2 // pé da perpendicular em a-b
    return { x: 2 * (a.x + t * dx) - p.x, y: 2 * (a.y + t * dy) - p.y }
  }
}

/** Aplica f às coordenadas dos pontos indicados (in place). */
function transformaPontos(sk: SketchFeature, pts: string[], f: Transf): void {
  const set = new Set(pts)
  for (const e of sk.entidades) if (e.tipo === 'ponto' && set.has(e.id)) {
    const q = f({ x: e.x, y: e.y })
    e.x = q.x; e.y = q.y
  }
}

/** ids de entidades -> ids dos pontos que elas movem (linha: a,b; círculo: c; arco: c,a,b; ponto: ele mesmo). Sem repetir. */
export function pontosDe(sk: SketchFeature, ids: string[]): string[] {
  const ent = mapa(sk)
  const out = new Set<string>()
  for (const id of ids) {
    const e = ent.get(id)
    if (!e) continue
    if (e.tipo === 'ponto') out.add(e.id)
    else for (const r of refs(e)) out.add(r)
  }
  return [...out].filter((id) => id !== ORIGEM && ent.get(id)?.tipo === 'ponto')
}

/** Pontos a duplicar: os de pontosDe e, se uma entidade copiada usa a origem, a origem também (a cópia ganha ponto próprio). */
function pontosCopia(sk: SketchFeature, ids: string[]): string[] {
  const ent = mapa(sk)
  const out = new Set(pontosDe(sk, ids))
  for (const id of ids) {
    const e = ent.get(id)
    if (e && e.tipo !== 'ponto') for (const r of refs(e)) out.add(r)
  }
  return [...out].filter((id) => ent.get(id)?.tipo === 'ponto')
}

export function mover(sk: SketchFeature, ids: string[], dx: number, dy: number): void {
  transformaPontos(sk, pontosDe(sk, ids), translacao(dx, dy))
}

/** Cria cópias das entidades de `ids` (e de seus pontos, uma por ponto) com f aplicado. Devolve ids das cópias de topo.
 *  inverte: arcos copiados trocam a<->b (necessário quando f é reflexão, para manter a varredura anti-horária). */
function clonar(sk: SketchFeature, ids: string[], f: Transf, inverte: boolean): string[] {
  const ent = mapa(sk)
  const mp = new Map<string, string>()
  for (const id of pontosCopia(sk, ids)) {
    const p = ent.get(id)
    if (!p || p.tipo !== 'ponto') continue
    const q = f({ x: p.x, y: p.y })
    const nid = novoId(sk, 'p')
    sk.entidades.push({ ...p, id: nid, x: q.x, y: q.y })
    mp.set(id, nid)
  }
  const novos: string[] = []
  for (const id of new Set(ids)) {
    const e = ent.get(id)
    if (!e) continue
    if (e.tipo === 'ponto') { if (id !== ORIGEM) novos.push(mp.get(id)!) }
    else if (e.tipo === 'linha') {
      const nid = novoId(sk, 'l')
      sk.entidades.push({ ...e, id: nid, a: mp.get(e.a)!, b: mp.get(e.b)! })
      novos.push(nid)
    } else if (e.tipo === 'circulo') {
      const nid = novoId(sk, 'c')
      sk.entidades.push({ ...e, id: nid, c: mp.get(e.c)! })
      novos.push(nid)
    } else {
      const nid = novoId(sk, 'a')
      const [a, b] = inverte ? [mp.get(e.b)!, mp.get(e.a)!] : [mp.get(e.a)!, mp.get(e.b)!]
      sk.entidades.push({ ...e, id: nid, c: mp.get(e.c)!, a, b })
      novos.push(nid)
    }
  }
  return novos
}

/** Duplica as entidades deslocadas por (dx,dy). Devolve os ids das NOVAS entidades de topo. Não copia restrições. */
export function copiar(sk: SketchFeature, ids: string[], dx: number, dy: number): string[] {
  return clonar(sk, ids, translacao(dx, dy), false)
}

/** Anti-horário: rotação de `graus` em torno de `centro`. */
export function girar(sk: SketchFeature, ids: string[], centro: Pt, graus: number): void {
  transformaPontos(sk, pontosDe(sk, ids), rotacao(centro, graus))
}

export function escalar(sk: SketchFeature, ids: string[], base: Pt, fator: number): void {
  if (!(fator > 0)) throw new Error('O fator de escala deve ser maior que zero.')
  const pts = pontosDe(sk, ids)
  transformaPontos(sk, pts, (p) => ({ x: base.x + (p.x - base.x) * fator, y: base.y + (p.y - base.y) * fator }))
  const set = new Set(pts)
  for (const e of sk.entidades) if (e.tipo === 'circulo' && set.has(e.c)) e.r *= fator
}

/** Espelha em torno da reta a-b. manter=true: cria a cópia espelhada (devolve ids novos); manter=false: move. */
export function espelhar(sk: SketchFeature, ids: string[], a: Pt, b: Pt, manter: boolean): string[] {
  if (a.x === b.x && a.y === b.y) throw new Error('A reta de espelhamento precisa de dois pontos distintos.')
  const f = refletir(a, b)
  if (manter) return clonar(sk, ids, f, true)
  const pts = pontosDe(sk, ids)
  transformaPontos(sk, pts, f)
  // arco com centro e extremos todos movidos: reflexão inverte a varredura, então troca a<->b
  const set = new Set(pts)
  for (const e of sk.entidades) if (e.tipo === 'arco' && set.has(e.c) && set.has(e.a) && set.has(e.b)) [e.a, e.b] = [e.b, e.a]
  return []
}

export function arrayRetangular(sk: SketchFeature, ids: string[], nx: number, ny: number, dx: number, dy: number): string[] {
  exigeInteiro(nx); exigeInteiro(ny)
  const novos: string[] = []
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) if (i || j) novos.push(...clonar(sk, ids, translacao(i * dx, j * dy), false))
  return novos
}

/** n itens no total (original incluso). Círculo completo (360): espaçamento 360/n; senão grausTotal/(n-1). */
export function arrayPolar(sk: SketchFeature, ids: string[], centro: Pt, n: number, grausTotal: number): string[] {
  exigeInteiro(n)
  const passo = grausTotal % 360 === 0 ? grausTotal / n : grausTotal / (n - 1)
  const novos: string[] = []
  for (let k = 1; k < n; k++) novos.push(...clonar(sk, ids, rotacao(centro, k * passo), false))
  return novos
}

/** Apaga as entidades e o que depende delas (linhas/arcos/círculos que usam um ponto apagado; restrições que citam algo apagado).
 *  Pontos órfãos são mantidos. */
export function apagar(sk: SketchFeature, ids: string[]): void {
  const rem = new Set(ids.filter((id) => id !== ORIGEM))
  for (const e of sk.entidades) if (refs(e).some((r) => rem.has(r))) rem.add(e.id)
  sk.entidades = sk.entidades.filter((e) => !rem.has(e.id))
  sk.restricoes = sk.restricoes.filter((r) => !r.e.some((id) => rem.has(id)))
}

/** Liga/desliga `construcao`. Se há mistura (ou todas desligadas), liga tudo; se todas ligadas, desliga. */
export function alternaConstrucao(sk: SketchFeature, ids: string[]): void {
  const set = new Set(ids)
  const sel = sk.entidades.filter((e) => set.has(e.id))
  const ligar = !sel.every((e) => e.construcao)
  for (const e of sel) e.construcao = ligar
}
