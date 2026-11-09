// Ferramentas de desenho do sketch: CIRCULO (centro-raio, 2P, 3P, TTR), ARCO (3 pontos ou tangente), POLIGONO e SLOT (oblongo).
// Máquinas de estado puras: cada passo devolve prompt, opcoes, previa e, ao fechar, a adicao (ids locais '@n', únicos por instância = por comando).
import type { EntSk, Pt, RestSk, SketchFeature } from '@3dm/core/sketch'
// Valores de geometria vêm do arquivo direto: o índice de @3dm/core/sketch ainda aponta para comandos.ts (inexistente).
import { acha } from '../../../core/src/sketch/selecao.ts'
import { anguloDe, dist, EPS, noArco, projetaNaLinha } from '../../../core/src/sketch/geometria.ts'
import { T } from '../textos.ts'
import type { ContextoFerr, EntradaFerr, FabricaFerramenta, Forma, Passo } from './ferramenta.ts'

interface PtRef { p: Pt; ref?: string } // ponto clicado; ref = id de ponto existente sob o snap

const contador = () => { let n = 0; return () => `@${++n}` }

/** Ponto novo vira entidade; devolve o id local. */
function novoPonto(novo: () => string, p: Pt, ent: EntSk[]): string {
  const id = novo()
  ent.push({ tipo: 'ponto', id, x: p.x, y: p.y })
  return id
}

/** Reusa o ref do snap; sem ref, cria o ponto. */
const pontoId = (pr: PtRef, novo: () => string, ent: EntSk[]): string => pr.ref ?? novoPonto(novo, pr.p, ent)

const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase()

/** Opção digitada (palavra inteira ou inicial, sem maiúsculas nem acento) que casa com uma de `opcoes`, ou null. */
function opcaoEscolhida(e: EntradaFerr, opcoes: string[]): string | null {
  if (e.tipo !== 'opcao') return null
  const d = norm(e.opcao)
  return opcoes.find(o => d !== '' && (d === norm(o) || d === norm(o).charAt(0))) ?? null
}

/** Circuncentro de a, b, c; null se colineares. Com b' = b - a e c' = c - a: centro = a + (c'y|b'|^2 - b'y|c'|^2, b'x|c'|^2 - c'x|b'|^2) / (2 cruz), cruz = b'x c'y - b'y c'x. */
function circuncentro(a: Pt, b: Pt, c: Pt): Pt | null {
  const bx = b.x - a.x, by = b.y - a.y, cx = c.x - a.x, cy = c.y - a.y
  const cruz = bx * cy - by * cx
  if (Math.abs(cruz) <= 1e-9 * Math.hypot(bx, by) * Math.hypot(cx, cy)) return null
  const b2 = bx * bx + by * by, c2 = cx * cx + cy * cy
  return { x: a.x + (cy * b2 - by * c2) / (2 * cruz), y: a.y + (bx * c2 - cx * b2) / (2 * cruz) }
}

/** Extremos (a, b) do arco anti-horário de a até b que passa por m: troca x e y se o sentido natural não passar por m. */
const ordena = (c: Pt, x: PtRef, m: Pt, y: PtRef): [PtRef, PtRef] => (noArco(m, c, x.p, y.p) ? [x, y] : [y, x])

const meio = (p: Pt, q: Pt): Pt => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 })

const pontoDe = (sk: SketchFeature, id: string): Pt | undefined => {
  const e = sk.entidades.find(x => x.id === id)
  return e?.tipo === 'ponto' ? e : undefined
}

/** Reta com normal unitária n: pontos x com n·x = c. */
interface Reta { n: Pt; c: number }
const retaDe = (a: Pt, b: Pt): Reta => {
  const L = dist(a, b)
  const n = { x: -(b.y - a.y) / L, y: (b.x - a.x) / L }
  return { n, c: n.x * a.x + n.y * a.y }
}

/** Alvo do TTR: linha (vira reta infinita na tangência) ou círculo, com o ponto clicado. */
type Alvo = { k: 'reta'; id: string; p: Pt; reta: Reta } | { k: 'circ'; id: string; p: Pt; c: Pt; R: number }

// ponytail: tolerância fixa em mm; se o clique falhar com zoom longe, passar o raio de pega da vista.
const TOL_ALVO = 2

/** Linha (com comprimento) ou círculo sob o clique; null se for outra coisa ou nada. */
function alvoEm(sk: SketchFeature, p: Pt): Alvo | null {
  const id = acha(sk, p, TOL_ALVO)
  const e = sk.entidades.find(x => x.id === id)
  if (e?.tipo === 'linha') {
    const a = pontoDe(sk, e.a), b = pontoDe(sk, e.b)
    return a && b && dist(a, b) > EPS ? { k: 'reta', id: e.id, p, reta: retaDe(a, b) } : null
  }
  if (e?.tipo === 'circulo') {
    const c = pontoDe(sk, e.c)
    return c ? { k: 'circ', id: e.id, p, c: { x: c.x, y: c.y }, R: e.r } : null
  }
  return null
}

/** Duas retas: centros a r dos dois lados (4 combinações). Paralelas -> nenhum centro. */
function retaRetaTTR(r1: Reta, r2: Reta, r: number): Pt[] {
  const det = r1.n.x * r2.n.y - r1.n.y * r2.n.x
  if (Math.abs(det) <= EPS) return []
  const out: Pt[] = []
  for (const s1 of [1, -1]) for (const s2 of [1, -1]) {
    const k1 = r1.c + s1 * r, k2 = r2.c + s2 * r // n1·O = k1, n2·O = k2
    out.push({ x: (k1 * r2.n.y - r1.n.y * k2) / det, y: (r1.n.x * k2 - r2.n.x * k1) / det })
  }
  return out
}

/** Reta e círculo: centro a r da reta (dos dois lados) e a R+r (por fora) ou |R-r| (por dentro) do centro do círculo. */
function retaCircTTR(reta: Reta, cir: { c: Pt; R: number }, r: number): Pt[] {
  const { n } = reta
  const out: Pt[] = []
  for (const s of [1, -1]) {
    const h = n.x * cir.c.x + n.y * cir.c.y - (reta.c + s * r) // distância com sinal do centro do círculo à reta deslocada
    const f = { x: cir.c.x - h * n.x, y: cir.c.y - h * n.y } // pé da perpendicular ao centro do círculo
    for (const D of [cir.R + r, Math.abs(cir.R - r)]) {
      const w2 = D * D - h * h
      if (w2 < -EPS) continue
      const w = Math.sqrt(Math.max(0, w2))
      out.push({ x: f.x - w * n.y, y: f.y + w * n.x })
      if (w > EPS) out.push({ x: f.x + w * n.y, y: f.y - w * n.x })
    }
  }
  return out
}

/** Centros dos círculos de raio r tangentes aos dois alvos. Círculo×círculo não entra (devolve []). */
function centrosTTR(a: Alvo, b: Alvo, r: number): Pt[] {
  if (a.k === 'reta' && b.k === 'reta') return retaRetaTTR(a.reta, b.reta, r)
  if (a.k === 'reta' && b.k === 'circ') return retaCircTTR(a.reta, b, r)
  if (a.k === 'circ' && b.k === 'reta') return retaCircTTR(b.reta, a, r)
  return []
}

export const circulo: FabricaFerramenta = (ctx) => {
  const novo = contador()
  let modo: 'escolha' | 'raio' | 'p2' | 'p3' | 'ttr' = 'escolha'
  let centro: PtRef | null = null
  let diam = false
  let pts: Pt[] = [] // 2P e 3P: pontos clicados
  let alvos: Alvo[] = [] // TTR: linhas ou círculos clicados
  let ultimo: Pt | null = null

  const passo = (): Passo => {
    if (modo === 'escolha') return { prompt: T.ferrB.circC2, opcoes: [T.ferrB.op.p2, T.ferrB.op.p3, T.ferrB.op.ttr], previa: [], fim: false }
    if (modo === 'p2') return { prompt: pts.length ? T.ferrB.circ2p2 : T.ferrB.circ2p1, opcoes: [], previa: pts.map((p): Forma => ({ k: 'ponto', p })), fim: false }
    if (modo === 'p3') return { prompt: T.ferrB.circ3p, opcoes: [], previa: pts.map((p): Forma => ({ k: 'ponto', p })), fim: false }
    if (modo === 'ttr') return { prompt: alvos.length === 2 ? T.ferrB.ttrRaio : alvos.length ? T.ferrB.ttr2 : T.ferrB.ttr1, opcoes: [], previa: [], fim: false }
    return { prompt: diam ? T.ferr.circD : T.ferr.circR, opcoes: diam ? [] : [T.ferr.op.diametro], previa: centro ? [{ k: 'ponto', p: centro.p }] : [], fim: false }
  }

  // Círculo de centro c e raio raio; `ligados` = ids de entidades a que ele fica tangente (TTR).
  const fecha = (c: PtRef, raio: number, ligados: string[] = []): Passo => {
    const ent: EntSk[] = []
    const idC = pontoId(c, novo, ent)
    const idCirc = novo()
    ent.push({ tipo: 'circulo', id: idCirc, c: idC, r: raio })
    const restricoes = ligados.map((id): RestSk => ({ id: novo(), tipo: 'tangente', e: [idCirc, id] }))
    return { prompt: diam ? T.ferr.circD : T.ferr.circR, opcoes: [], previa: [{ k: 'circulo', c: c.p, r: raio }], fim: true, adicao: { entidades: ent, restricoes } }
  }

  function entra(e: EntradaFerr): Passo {
    if (modo === 'escolha') {
      if (e.tipo === 'ponto') { centro = { p: e.p, ref: e.ref }; ultimo = e.p; modo = 'raio' }
      else {
        const op = opcaoEscolhida(e, [T.ferrB.op.p2, T.ferrB.op.p3, T.ferrB.op.ttr])
        if (op) modo = op === T.ferrB.op.p2 ? 'p2' : op === T.ferrB.op.p3 ? 'p3' : 'ttr'
      }
      return passo()
    }
    if (modo === 'raio' && centro) {
      if (e.tipo === 'opcao') {
        if (opcaoEscolhida(e, [T.ferr.op.diametro])) diam = true
        return passo()
      }
      if (e.tipo === 'ponto') {
        const r = dist(centro.p, e.p) // raio pelo ponto, nos dois modos (em diametro, o cursor mostra o raio)
        if (r <= EPS) return passo()
        ultimo = e.p
        return fecha(centro, r)
      }
      if (!(e.v > 0)) return passo()
      return fecha(centro, diam ? e.v / 2 : e.v)
    }
    if (modo === 'p2' || modo === 'p3') {
      if (e.tipo !== 'ponto') return passo()
      if (pts.length < (modo === 'p2' ? 1 : 2)) { pts.push(e.p); ultimo = e.p; return passo() }
      if (modo === 'p2') {
        const d = dist(pts[0], e.p)
        if (d <= EPS) return passo()
        ultimo = e.p
        return fecha({ p: meio(pts[0], e.p) }, d / 2)
      }
      const c = circuncentro(pts[0], pts[1], e.p)
      if (!c) return passo() // colineares: ignora o 3º
      ultimo = e.p
      return fecha({ p: c }, dist(c, pts[0]))
    }
    if (modo === 'ttr') {
      if (alvos.length < 2) {
        if (e.tipo !== 'ponto') return passo()
        const sk = ctx?.sk()
        const a = sk ? alvoEm(sk, e.p) : null
        if (!a || alvos.some(x => x.id === a.id)) return passo()
        if (a.k === 'circ' && alvos[0]?.k === 'circ') return { ...passo(), prompt: T.ferrB.ttrErro } // círculo×círculo: não entra
        alvos.push(a)
        ultimo = e.p
        return passo()
      }
      if (e.tipo !== 'valor' || !(e.v > 0)) return passo()
      const cs = centrosTTR(alvos[0], alvos[1], e.v)
      if (!cs.length) return { ...passo(), prompt: T.ferrB.ttrErro }
      const m = meio(alvos[0].p, alvos[1].p)
      const c = cs.reduce((x, y) => (dist(x, m) <= dist(y, m) ? x : y)) // entre as soluções, a mais perto do meio dos cliques
      return fecha({ p: c }, e.v, alvos.map(a => a.id))
    }
    return passo()
  }

  return {
    nome: 'CIRCULO',
    inicio: passo,
    entra,
    cursor(p) {
      if (modo === 'raio' && centro) { const r = dist(centro.p, p); return r > EPS ? [{ k: 'circulo', c: centro.p, r }] : [] }
      if (modo === 'p2' && pts.length === 1) { const r = dist(pts[0], p) / 2; return r > EPS ? [{ k: 'circulo', c: meio(pts[0], p), r }] : [] }
      if (modo === 'p3' && pts.length === 2) { const c = circuncentro(pts[0], pts[1], p); return c ? [{ k: 'circulo', c, r: dist(c, p) }] : [] }
      return []
    },
    get ultimo() { return ultimo },
  }
}

/** Última linha não-construção do sketch: id, ponto final (extremo b, com id) e direção a→b. */
function ultimaLinha(sk: SketchFeature): { linha: string; p0: PtRef; d: Pt } | null {
  const l = [...sk.entidades].reverse().find(x => x.tipo === 'linha' && !x.construcao)
  if (l?.tipo !== 'linha') return null
  const a = pontoDe(sk, l.a), b = pontoDe(sk, l.b)
  return a && b ? { linha: l.id, p0: { p: b, ref: l.b }, d: { x: b.x - a.x, y: b.y - a.y } } : null
}

/** Arco que sai de p0 na direção d e passa por p1: centro na perpendicular a d em p0, à mesma distância de p0 e p1.
 *  ccw = o anti-horário vai de p0 a p1 (senão, de p1 a p0: a/b já vêm na ordem do documento). null se p1 está na reta de d. */
function arcoTangente(p0: Pt, d: Pt, p1: Pt): { c: Pt; a: Pt; b: Pt; ccw: boolean } | null {
  const L = Math.hypot(d.x, d.y)
  if (L <= EPS) return null
  const vx = p1.x - p0.x, vy = p1.y - p0.y
  const nx = -d.y / L, ny = d.x / L
  const nv = nx * vx + ny * vy
  if (Math.abs(nv) <= EPS * Math.hypot(vx, vy)) return null
  const t = (vx * vx + vy * vy) / (2 * nv)
  const c = { x: p0.x + t * nx, y: p0.y + t * ny }
  return t > 0 ? { c, a: p0, b: p1, ccw: true } : { c, a: p1, b: p0, ccw: false }
}

export const arco: FabricaFerramenta = (ctx) => {
  const novo = contador()
  let p1: PtRef | null = null
  let p2: Pt | null = null
  let tan: { linha: string; p0: PtRef; d: Pt } | null = null // Tangente: linha de origem e ponto inicial
  let ultimo: Pt | null = null

  const passo = (): Passo => {
    if (tan) return { prompt: T.ferrB.arcoTanFim, opcoes: [], previa: [{ k: 'ponto', p: tan.p0.p }], fim: false }
    if (!p1) return { prompt: T.ferrB.arcoP1Op, opcoes: [T.ferrB.op.tangente], previa: [], fim: false }
    if (!p2) return { prompt: T.ferr.arcoP2, opcoes: [], previa: [{ k: 'ponto', p: p1.p }], fim: false }
    return { prompt: T.ferr.arcoP3, opcoes: [], previa: [{ k: 'ponto', p: p1.p }, { k: 'ponto', p: p2 }], fim: false }
  }

  function entra(e: EntradaFerr): Passo {
    if (e.tipo === 'opcao') {
      if (!p1 && !tan && opcaoEscolhida(e, [T.ferrB.op.tangente])) {
        const sk = ctx?.sk()
        const l = sk ? ultimaLinha(sk) : null
        if (!l) return { ...passo(), prompt: T.ferrB.arcoTanErro }
        tan = l
      }
      return passo()
    }
    if (e.tipo !== 'ponto') return passo()
    if (tan) {
      const g = arcoTangente(tan.p0.p, tan.d, e.p)
      if (!g) return passo()
      const ent: EntSk[] = []
      const idP0 = pontoId(tan.p0, novo, ent)
      const idC = novoPonto(novo, g.c, ent)
      const idP1 = pontoId({ p: e.p, ref: e.ref }, novo, ent)
      const idArco = novo()
      ent.push({ tipo: 'arco', id: idArco, c: idC, a: g.ccw ? idP0 : idP1, b: g.ccw ? idP1 : idP0 })
      ultimo = e.p
      return { prompt: T.ferrB.arcoTanFim, opcoes: [], previa: [{ k: 'arco', c: g.c, a: g.a, b: g.b }], fim: true, adicao: { entidades: ent, restricoes: [{ id: novo(), tipo: 'tangente', e: [tan.linha, idArco] }] } }
    }
    if (!p1) { p1 = { p: e.p, ref: e.ref }; ultimo = e.p; return passo() }
    if (!p2) { p2 = e.p; ultimo = e.p; return passo() }
    const c = circuncentro(p1.p, p2, e.p)
    if (!c) return passo() // colineares: ignora o P3
    const ent: EntSk[] = []
    const idC = novoPonto(novo, c, ent)
    const [a, b] = ordena(c, p1, p2, { p: e.p, ref: e.ref })
    const idA = pontoId(a, novo, ent)
    const idB = pontoId(b, novo, ent)
    ent.push({ tipo: 'arco', id: novo(), c: idC, a: idA, b: idB })
    ultimo = e.p
    return { prompt: T.ferr.arcoP3, opcoes: [], previa: [{ k: 'arco', c, a: a.p, b: b.p }], fim: true, adicao: { entidades: ent, restricoes: [] } }
  }

  return {
    nome: 'ARCO',
    inicio: passo,
    entra,
    cursor(p) {
      if (tan) { const g = arcoTangente(tan.p0.p, tan.d, p); return g ? [{ k: 'arco', c: g.c, a: g.a, b: g.b }] : [] }
      if (!p1) return []
      if (!p2) return [{ k: 'linha', a: p1.p, b: p }]
      const c = circuncentro(p1.p, p2, p)
      if (!c) return []
      const [a, b] = ordena(c, p1, p2, { p })
      return [{ k: 'arco', c, a: a.p, b: b.p }]
    },
    get ultimo() { return ultimo },
  }
}


export const poligono: FabricaFerramenta = () => {
  const novo = contador()
  let centro: Pt | null = null
  let lados = 0
  let inscrito = true
  let ultimo: Pt | null = null

  const passo = (): Passo => {
    if (!centro) return { prompt: T.ferr.polC, opcoes: [], previa: [], fim: false }
    if (!lados) return { prompt: T.ferr.polN, opcoes: [], previa: [{ k: 'ponto', p: centro }], fim: false }
    return { prompt: T.ferr.polR, opcoes: [T.ferr.op.inscrito, T.ferr.op.circunscrito], previa: [{ k: 'ponto', p: centro }], fim: false }
  }

  // r = raio até o vértice (inscrito) ou até o meio do lado (circunscrito); t0 = ângulo do primeiro vértice.
  const fecha = (c: Pt, t0: number, r: number): Passo => {
    const n = lados
    const R = inscrito ? r : r / Math.cos(Math.PI / n)
    const vs: Pt[] = []
    for (let k = 0; k < n; k++) {
      const t = t0 + (2 * Math.PI * k) / n
      vs.push({ x: c.x + R * Math.cos(t), y: c.y + R * Math.sin(t) })
    }
    const ent: EntSk[] = []
    const ids = vs.map(v => novoPonto(novo, v, ent))
    const linhas: string[] = []
    for (let k = 0; k < n; k++) {
      const id = novo()
      ent.push({ tipo: 'linha', id, a: ids[k], b: ids[(k + 1) % n] })
      linhas.push(id)
    }
    const restricoes: RestSk[] = []
    for (let k = 0; k < n - 1; k++) restricoes.push({ id: novo(), tipo: 'igual', e: [linhas[k], linhas[k + 1]] })
    const previa: Forma[] = []
    for (let k = 0; k < n; k++) previa.push({ k: 'linha', a: vs[k], b: vs[(k + 1) % n] })
    return { prompt: T.ferr.polR, opcoes: [], previa, fim: true, adicao: { entidades: ent, restricoes } }
  }

  function entra(e: EntradaFerr): Passo {
    if (!centro) {
      if (e.tipo === 'ponto') { centro = e.p; ultimo = e.p }
      return passo()
    }
    if (!lados) {
      if (e.tipo === 'valor' && Number.isInteger(e.v) && e.v >= 3 && e.v <= 64) lados = e.v
      return passo()
    }
    if (e.tipo === 'opcao') {
      const op = opcaoEscolhida(e, [T.ferr.op.inscrito, T.ferr.op.circunscrito])
      if (op) inscrito = op === T.ferr.op.inscrito
      return passo()
    }
    if (e.tipo === 'ponto') {
      const r = dist(centro, e.p)
      if (r <= EPS) return passo()
      ultimo = e.p
      return fecha(centro, anguloDe(centro, e.p), r)
    }
    if (!(e.v > 0)) return passo()
    return fecha(centro, 0, e.v)
  }

  return {
    nome: 'POLIGONO',
    inicio: passo,
    entra,
    cursor(p) {
      if (!centro || !lados) return []
      const r = dist(centro, p)
      return r > EPS ? [{ k: 'circulo', c: centro, r }] : []
    },
    get ultimo() { return ultimo },
  }
}

/** Pontos de encontro do oblongo de centros c1, c2 e largura w: t = lado +normal (topo), b = lado -normal (base). */
interface Oblongo { t1: Pt; b1: Pt; t2: Pt; b2: Pt }
function oblongo(c1: Pt, c2: Pt, w: number): Oblongo {
  const L = dist(c1, c2), r = w / 2
  const nx = -(c2.y - c1.y) / L * r, ny = (c2.x - c1.x) / L * r
  const de = (c: Pt, s: number): Pt => ({ x: c.x + s * nx, y: c.y + s * ny })
  return { t1: de(c1, 1), b1: de(c1, -1), t2: de(c2, 1), b2: de(c2, -1) }
}

/** Duas linhas e dois arcos anti-horários (topo de c1 para base de c1; base de c2 para topo de c2). */
function formasOblongo(c1: Pt, c2: Pt, g: Oblongo): Forma[] {
  return [
    { k: 'linha', a: g.t1, b: g.t2 },
    { k: 'linha', a: g.b1, b: g.b2 },
    { k: 'arco', c: c1, a: g.t1, b: g.b1 },
    { k: 'arco', c: c2, a: g.b2, b: g.t2 },
  ]
}

export const slot: FabricaFerramenta = () => {
  const novo = contador()
  let c1: PtRef | null = null
  let c2: PtRef | null = null
  let ultimo: Pt | null = null

  const passo = (): Passo => {
    if (!c1) return { prompt: T.ferr.slotP1, opcoes: [], previa: [], fim: false }
    if (!c2) return { prompt: T.ferr.slotP2, opcoes: [], previa: [{ k: 'ponto', p: c1.p }], fim: false }
    return { prompt: T.ferr.slotL, opcoes: [], previa: [{ k: 'ponto', p: c1.p }, { k: 'ponto', p: c2.p }], fim: false }
  }

  const fecha = (o1: PtRef, o2: PtRef, w: number): Passo => {
    const g = oblongo(o1.p, o2.p, w)
    const ent: EntSk[] = []
    const ca = pontoId(o1, novo, ent)
    const cb = pontoId(o2, novo, ent)
    const t1 = novoPonto(novo, g.t1, ent)
    const b1 = novoPonto(novo, g.b1, ent)
    const t2 = novoPonto(novo, g.t2, ent)
    const b2 = novoPonto(novo, g.b2, ent)
    const lt = novo(), lb = novo(), arc1 = novo(), arc2 = novo()
    ent.push({ tipo: 'linha', id: lt, a: t1, b: t2 }, { tipo: 'linha', id: lb, a: b1, b: b2 })
    ent.push({ tipo: 'arco', id: arc1, c: ca, a: t1, b: b1 }, { tipo: 'arco', id: arc2, c: cb, a: b2, b: t2 })
    const restricoes: RestSk[] = [
      { id: novo(), tipo: 'tangente', e: [lt, arc1] },
      { id: novo(), tipo: 'tangente', e: [lt, arc2] },
      { id: novo(), tipo: 'tangente', e: [lb, arc1] },
      { id: novo(), tipo: 'tangente', e: [lb, arc2] },
      { id: novo(), tipo: 'igual', e: [lt, lb] },
    ]
    return { prompt: T.ferr.slotL, opcoes: [], previa: formasOblongo(o1.p, o2.p, g), fim: true, adicao: { entidades: ent, restricoes } }
  }

  function entra(e: EntradaFerr): Passo {
    if (!c1) {
      if (e.tipo === 'ponto') { c1 = { p: e.p, ref: e.ref }; ultimo = e.p }
      return passo()
    }
    if (!c2) {
      if (e.tipo === 'ponto' && dist(c1.p, e.p) > EPS) { c2 = { p: e.p, ref: e.ref }; ultimo = e.p }
      return passo()
    }
    if (e.tipo === 'valor') return e.v > 0 ? fecha(c1, c2, e.v) : passo()
    if (e.tipo === 'ponto') {
      const d = dist(e.p, projetaNaLinha(e.p, c1.p, c2.p).pt) // largura = 2 x distancia do ponto a reta dos centros
      return d > EPS ? fecha(c1, c2, 2 * d) : passo()
    }
    return passo()
  }

  return {
    nome: 'SLOT',
    inicio: passo,
    entra,
    cursor(p) {
      if (!c1) return []
      if (!c2) return [{ k: 'linha', a: c1.p, b: p }]
      const d = dist(p, projetaNaLinha(p, c1.p, c2.p).pt)
      return d > EPS ? formasOblongo(c1.p, c2.p, oblongo(c1.p, c2.p, 2 * d)) : []
    },
    get ultimo() { return ultimo },
  }
}
