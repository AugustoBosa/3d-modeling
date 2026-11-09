// Edições geométricas do sketch: aparar, estender, offset, fillet 2D e chanfro. Todas MUTAM o SketchFeature.
// Operações impossíveis lançam Error em pt-BR com causa e correção (o chamador mostra a mensagem).
import type { EntSk, Pt, SketchFeature } from './tipos.ts'
import { novoId } from './tipos.ts'
import { apagar } from './edicao.ts'
import { anguloDe, dist, interCirculoCirculo, interLinhaCirculo, interSegmentos, noArco, projetaNaLinha, varreduraArco } from './geometria.ts'

const TAU = 2 * Math.PI
const EPS = 1e-9
const LADOS: Lado[] = ['a', 'b']

type Lado = 'a' | 'b'
type Linha = Extract<EntSk, { tipo: 'linha' }>
type Curva = Extract<EntSk, { tipo: 'linha' | 'arco' }>

/** Geometria sem limites para interseções: linha (segmento ou reta inteira) ou círculo (inteiro ou arco). */
type Geo =
  | { k: 'lin'; seg: boolean; a: Pt; b: Pt }
  | { k: 'cir'; c: Pt; r: number; arco?: { a: Pt; b: Pt } }

const unit = (v: Pt): Pt => {
  const m = Math.hypot(v.x, v.y)
  return { x: v.x / m, y: v.y / m }
}
const refsDe = (e: EntSk): string[] =>
  e.tipo === 'ponto' ? [] : e.tipo === 'linha' ? [e.a, e.b] : e.tipo === 'circulo' ? [e.c] : [e.c, e.a, e.b]

function achar(sk: SketchFeature, id: string): EntSk {
  const e = sk.entidades.find((x) => x.id === id)
  if (!e) throw new Error(`A entidade "${id}" não existe no sketch. Selecione-a de novo.`)
  return e
}

function ptoDe(sk: SketchFeature, id: string): Pt {
  const e = sk.entidades.find((x) => x.id === id)
  if (!e || e.tipo !== 'ponto') throw new Error(`O ponto "${id}" não existe no sketch. Refaça a seleção.`)
  return { x: e.x, y: e.y }
}

function linhaDe(sk: SketchFeature, id: string): Linha {
  const e = achar(sk, id)
  if (e.tipo !== 'linha') throw new Error(`"${id}" não é uma linha. Para o canto, escolha duas linhas.`)
  return e
}

function novoPonto(sk: SketchFeature, q: Pt): string {
  const id = novoId(sk, 'p')
  sk.entidades.push({ id, tipo: 'ponto', x: q.x, y: q.y })
  return id
}

function geoDe(sk: SketchFeature, e: EntSk): Geo | null {
  if (e.tipo === 'linha') return { k: 'lin', seg: true, a: ptoDe(sk, e.a), b: ptoDe(sk, e.b) }
  if (e.tipo === 'circulo') return { k: 'cir', c: ptoDe(sk, e.c), r: e.r }
  if (e.tipo === 'arco') {
    const c = ptoDe(sk, e.c), a = ptoDe(sk, e.a)
    return { k: 'cir', c, r: dist(c, a), arco: { a, b: ptoDe(sk, e.b) } }
  }
  return null
}

/** Geometrias que limitam: não-construção, não-ponto, exceto `alvo`. */
function limites(sk: SketchFeature, alvo: string): Geo[] {
  const out: Geo[] = []
  for (const e of sk.entidades) {
    if (e.id === alvo || e.construcao) continue
    const g = geoDe(sk, e)
    if (g) out.push(g)
  }
  return out
}

/** Interseções brutas (reta inteira contra reta inteira, reta contra círculo inteiro). Filtradas depois por `dentro`. */
function brutos(g: Geo, h: Geo): Pt[] {
  if (g.k === 'lin' && h.k === 'lin') {
    const q = interSegmentos(g.a, g.b, h.a, h.b, false)
    return q ? [q] : []
  }
  if (g.k === 'lin' && h.k === 'cir') return interLinhaCirculo(g.a, g.b, h.c, h.r)
  if (g.k === 'cir' && h.k === 'lin') return interLinhaCirculo(h.a, h.b, g.c, g.r)
  if (g.k === 'cir' && h.k === 'cir') return interCirculoCirculo(g.c, g.r, h.c, h.r)
  return []
}

/** q está no trecho que a geometria cobre (segmento ou arco). Reta e círculo inteiro cobrem tudo. */
function dentro(g: Geo, q: Pt): boolean {
  if (g.k === 'lin') {
    if (!g.seg) return true
    const t = projetaNaLinha(q, g.a, g.b).t
    return t >= -EPS && t <= 1 + EPS
  }
  return !g.arco || noArco(q, g.c, g.arco.a, g.arco.b)
}

/** Interseções reais de `g` com as entidades limitantes do sketch. */
function hitsContra(sk: SketchFeature, alvo: string, g: Geo): Pt[] {
  return limites(sk, alvo).flatMap((h) => brutos(g, h).filter((q) => dentro(g, q) && dentro(h, q)))
}

/** Ângulo anti-horário de `de` até q, em [0, 2pi). */
function fase(c: Pt, de: Pt, q: Pt): number {
  return (anguloDe(c, q) - anguloDe(c, de) + TAU) % TAU
}

/** Posição de q ao longo da geometria: t na linha (0 a 1) ou ângulo a partir do início do arco/círculo. */
function param(g: Geo, q: Pt): number {
  if (g.k === 'lin') return projetaNaLinha(q, g.a, g.b).t
  return g.arco ? fase(g.c, g.arco.a, q) : anguloDe(g.c, q)
}

/** Leva a ponta `lado` de linha/arco até q. Se o ponto é usado por outra entidade, cria um novo só para esta. */
function moverPonta(sk: SketchFeature, id: string, lado: Lado, q: Pt): void {
  const e = achar(sk, id) as Curva
  const pid = e[lado]
  if (sk.entidades.some((o) => o.id !== id && refsDe(o).includes(pid))) {
    e[lado] = novoPonto(sk, q)
    return
  }
  const p = sk.entidades.find((o) => o.id === pid) as Extract<EntSk, { tipo: 'ponto' }>
  p.x = q.x
  p.y = q.y
}

/** APARAR: remove o trecho de `alvo` que contém o ponto clicado `p`, limitado pelas interseções com as demais entidades. */
export function aparar(sk: SketchFeature, alvo: string, p: Pt): void {
  const ent = achar(sk, alvo)
  const g = geoDe(sk, ent)
  if (!g) throw new Error('Pontos não se aparam. Escolha uma linha, arco ou círculo.')
  const L = g.k === 'lin' ? 1 : g.arco ? varreduraArco(g.c, g.arco.a, g.arco.b) : TAU
  const pc = param(g, p)
  const ts = hitsContra(sk, alvo, g)
    .map((q) => ({ q, t: param(g, q) }))
    .filter((x) => (g.k === 'cir' && !g.arco) || (x.t > EPS && x.t < L - EPS))
    .sort((x, y) => x.t - y.t)
    .filter((x, i, arr) => i === 0 || x.t - arr[i - 1].t > EPS)
  const n = ts.length
  if (n === 0) {
    apagar(sk, [alvo])
    return
  }

  if (ent.tipo === 'circulo') {
    if (n === 1) {
      throw new Error('O círculo cruza outra entidade em um só ponto, então não sobra um arco. Corte-o em mais um ponto ou apague o círculo.')
    }
    // intervalo k = [ts[k], ts[k+1]] (circular) que contém o clique; sobra o arco de ts[k+1] até ts[k]
    const k = (ts.filter((x) => x.t <= pc).length + n - 1) % n
    const a = novoPonto(sk, ts[(k + 1) % n].q)
    const b = novoPonto(sk, ts[k].q)
    sk.entidades[sk.entidades.indexOf(ent)] = { id: alvo, tipo: 'arco', c: ent.c, a, b }
    return
  }

  // linha ou arco: k = intervalo [cortes k-1, cortes k] que contém o clique
  const orig = ent as Curva
  const k = ts.filter((x) => x.t <= pc).length
  if (k > 0 && k < n) {
    const fim = orig.b
    orig.b = novoPonto(sk, ts[k - 1].q)
    const a = novoPonto(sk, ts[k].q)
    sk.entidades.push({ ...orig, id: novoId(sk, orig.tipo === 'linha' ? 'l' : 'a'), a, b: fim })
  } else if (k > 0) {
    orig.b = novoPonto(sk, ts[n - 1].q)
  } else {
    orig.a = novoPonto(sk, ts[0].q)
  }
}

/** ESTENDER: prolonga a ponta de `alvo` mais perto de `p` até a primeira entidade limite à frente. */
export function estender(sk: SketchFeature, alvo: string, p: Pt): void {
  const ent = achar(sk, alvo)
  if (ent.tipo !== 'linha' && ent.tipo !== 'arco') throw new Error('Só linhas e arcos têm ponta para estender.')
  const pa = ptoDe(sk, ent.a), pb = ptoDe(sk, ent.b)
  const fim: Lado = dist(p, pb) < dist(p, pa) ? 'b' : 'a'
  const E = fim === 'b' ? pb : pa
  const F = fim === 'b' ? pa : pb
  let q: Pt | undefined
  if (ent.tipo === 'linha') {
    // reta de F para E; só conta o que está além de E
    const hits = hitsContra(sk, alvo, { k: 'lin', seg: false, a: F, b: E })
      .map((x) => ({ x, t: projetaNaLinha(x, F, E).t }))
      .filter((h) => h.t > 1 + EPS)
    q = hits.sort((u, v) => u.t - v.t)[0]?.x
  } else {
    // arco: círculo inteiro; conta o que está na folga além da ponta, no sentido do prolongamento
    const c = ptoDe(sk, ent.c)
    const folga = TAU - varreduraArco(c, pa, pb)
    const hits = hitsContra(sk, alvo, { k: 'cir', c, r: dist(c, pa) })
      .map((x) => ({ x, d: fim === 'b' ? fase(c, E, x) : fase(c, x, E) }))
      .filter((h) => h.d > EPS && h.d < folga - EPS)
    q = hits.sort((u, v) => u.d - v.d)[0]?.x
  }
  if (!q) {
    throw new Error('Nada à frente da ponta para estender até. Escolha uma linha ou arco que cruze o prolongamento.')
  }
  moverPonta(sk, alvo, fim, q)
}

const erroRaioInterno = (r: number, d: number) =>
  new Error(`O offset para dentro (${d} mm) não cabe no raio de ${r} mm: o raio ficaria zero ou negativo. Use uma distância menor que o raio ou ofereça para fora.`)

/** OFFSET: cópia paralela de linha, círculo (r ± d) ou arco (concêntrico) do lado de `lado`. Devolve os ids novos. */
export function offset(sk: SketchFeature, alvo: string, d: number, lado: Pt): string[] {
  if (!(d > 0)) throw new Error('A distância do offset deve ser maior que zero.')
  const ent = achar(sk, alvo)
  if (ent.tipo === 'linha') {
    const a = ptoDe(sk, ent.a), b = ptoDe(sk, ent.b)
    const dx = b.x - a.x, dy = b.y - a.y, comp = Math.hypot(dx, dy)
    const lateral = (dx * (lado.y - a.y) - dy * (lado.x - a.x)) / comp // > 0: lado à esquerda de a->b
    if (Math.abs(lateral) < EPS) {
      throw new Error('O ponto de lado está sobre a linha, então não dá para saber para que lado oferecer. Clique do lado desejado, fora da linha.')
    }
    const s = (Math.sign(lateral) * d) / comp
    const p1 = novoPonto(sk, { x: a.x - dy * s, y: a.y + dx * s })
    const p2 = novoPonto(sk, { x: b.x - dy * s, y: b.y + dx * s })
    const id = novoId(sk, 'l')
    sk.entidades.push({ id, tipo: 'linha', a: p1, b: p2 })
    return [id]
  }
  if (ent.tipo === 'circulo') {
    const c = ptoDe(sk, ent.c)
    const porDentro = dist(lado, c) < ent.r
    if (porDentro && ent.r <= d) throw erroRaioInterno(ent.r, d)
    const id = novoId(sk, 'c')
    sk.entidades.push({ id, tipo: 'circulo', c: ent.c, r: porDentro ? ent.r - d : ent.r + d })
    return [id]
  }
  if (ent.tipo === 'arco') {
    const c = ptoDe(sk, ent.c), a = ptoDe(sk, ent.a), b = ptoDe(sk, ent.b)
    const r = dist(c, a)
    const porDentro = dist(lado, c) < r
    if (porDentro && r <= d) throw erroRaioInterno(r, d)
    const f = (porDentro ? r - d : r + d) / r
    const a2 = novoPonto(sk, { x: c.x + (a.x - c.x) * f, y: c.y + (a.y - c.y) * f })
    const b2 = novoPonto(sk, { x: c.x + (b.x - c.x) * f, y: c.y + (b.y - c.y) * f })
    const id = novoId(sk, 'a')
    sk.entidades.push({ id, tipo: 'arco', c: ent.c, a: a2, b: b2 })
    return [id]
  }
  throw new Error('Offset só se aplica a linha, círculo ou arco. Escolha uma dessas entidades.')
}

/** Canto entre duas linhas: o ponto que compartilham ou, se só se encontram no prolongamento, a interseção das retas.
 *  e1/e2 = ponta de cada linha mais perto do canto; u1/u2 = direção unitária do canto para o outro extremo. */
function canto(sk: SketchFeature, id1: string, id2: string) {
  if (id1 === id2) throw new Error('Escolha duas linhas diferentes para o canto.')
  const A = linhaDe(sk, id1), B = linhaDe(sk, id2)
  const PA = { a: ptoDe(sk, A.a), b: ptoDe(sk, A.b) }
  const PB = { a: ptoDe(sk, B.a), b: ptoDe(sk, B.b) }
  const par = LADOS.flatMap((x) => LADOS.map((y) => [x, y] as const)).find(([x, y]) => A[x] === B[y])
  let V: Pt, e1: Lado, e2: Lado
  if (par) {
    ;[e1, e2] = par
    V = PA[e1]
  } else {
    const X = interSegmentos(PA.a, PA.b, PB.a, PB.b, false)
    if (!X) throw new Error('As duas linhas são paralelas: não há canto para arredondar ou chanfrar.')
    V = X
    e1 = dist(X, PA.a) <= dist(X, PA.b) ? 'a' : 'b'
    e2 = dist(X, PB.a) <= dist(X, PB.b) ? 'a' : 'b'
  }
  const FA = PA[e1 === 'a' ? 'b' : 'a'], FB = PB[e2 === 'a' ? 'b' : 'a']
  const u1 = unit({ x: FA.x - V.x, y: FA.y - V.y }), u2 = unit({ x: FB.x - V.x, y: FB.y - V.y })
  const th = Math.acos(Math.max(-1, Math.min(1, u1.x * u2.x + u1.y * u2.y)))
  if (th < 1e-9 || Math.PI - th < 1e-9) {
    throw new Error('As duas linhas são paralelas ou colineares: não há canto para arredondar ou chanfrar.')
  }
  return { A, B, V, e1, e2, comum: !!par, u1, u2, th, len1: dist(V, FA), len2: dist(V, FB) }
}

/** FILLET 2D entre duas linhas: arredonda o canto com um arco de raio `r`. r = 0 une as linhas no canto. Devolve o id do arco ('' se r = 0). */
export function fillet(sk: SketchFeature, l1: string, l2: string, r: number): string {
  if (!(r >= 0)) throw new Error('O raio do fillet não pode ser negativo. Use 0 para canto vivo ou um valor positivo.')
  const k = canto(sk, l1, l2)
  if (r === 0) {
    if (!k.comum) {
      moverPonta(sk, l1, k.e1, k.V)
      k.B[k.e2] = k.A[k.e1]
    }
    return ''
  }
  const t = r / Math.tan(k.th / 2) // distância do canto até o ponto de tangência
  const lim = Math.min(k.len1, k.len2)
  if (t >= lim - EPS) {
    throw new Error(`Raio ${r} mm grande demais para os comprimentos das linhas: o máximo é ${(lim * Math.tan(k.th / 2)).toFixed(2)} mm. Use um raio menor ou alongue as linhas.`)
  }
  const bis = unit({ x: k.u1.x + k.u2.x, y: k.u1.y + k.u2.y })
  const dc = r / Math.sin(k.th / 2)
  const C = { x: k.V.x + bis.x * dc, y: k.V.y + bis.y * dc }
  const T1 = { x: k.V.x + k.u1.x * t, y: k.V.y + k.u1.y * t }
  const T2 = { x: k.V.x + k.u2.x * t, y: k.V.y + k.u2.y * t }
  moverPonta(sk, l1, k.e1, T1)
  moverPonta(sk, l2, k.e2, T2)
  const p1 = k.A[k.e1], p2 = k.B[k.e2]
  const cId = novoPonto(sk, C)
  // arco anti-horário de a até b: o menor (< 180°) é o do canto
  const [a, b] = varreduraArco(C, T1, T2) > Math.PI ? [p2, p1] : [p1, p2]
  const arco = novoId(sk, 'a')
  sk.entidades.push({ id: arco, tipo: 'arco', c: cId, a, b })
  for (const l of [l1, l2]) sk.restricoes.push({ id: novoId(sk, 'r'), tipo: 'tangente', e: [arco, l] })
  return arco
}

/** CHANFRO entre duas linhas: corta o canto por uma linha a d1 (na l1) e d2 (na l2) do vértice. Devolve o id da nova linha. */
export function chanfro(sk: SketchFeature, l1: string, l2: string, d1: number, d2: number): string {
  if (!(d1 > 0) || !(d2 > 0)) throw new Error('As distâncias do chanfro devem ser maiores que zero.')
  const k = canto(sk, l1, l2)
  if (d1 >= k.len1 - EPS || d2 >= k.len2 - EPS) {
    throw new Error(`Distância do chanfro grande demais: os trechos até o canto têm ${k.len1.toFixed(2)} mm e ${k.len2.toFixed(2)} mm. Use distâncias menores.`)
  }
  moverPonta(sk, l1, k.e1, { x: k.V.x + k.u1.x * d1, y: k.V.y + k.u1.y * d1 })
  moverPonta(sk, l2, k.e2, { x: k.V.x + k.u2.x * d2, y: k.V.y + k.u2.y * d2 })
  const id = novoId(sk, 'l')
  sk.entidades.push({ id, tipo: 'linha', a: k.A[k.e1], b: k.B[k.e2] })
  return id
}
