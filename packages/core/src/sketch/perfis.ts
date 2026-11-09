// Detecção de perfis (regiões fechadas) de um sketch. Pura, sem DOM.
// Nós = pontos fundidos (restrição 'coincidente' ou distância < FUSAO). Linhas e arcos são arestas.
// Componente com todos os nós de grau 2 = laço fechado; grau 1 = contorno aberto (pontas soltas).
import { EPS, areaAssinada, dist, discretizaArco, discretizaCirculo, interCirculoCirculo, interLinhaCirculo, interSegmentos, noArco, pontoNoPoligono } from './geometria.ts'
import type { EntSk, Pt, SketchFeature } from './tipos.ts'

export interface Perfil { poligono: Pt[]; furos: Pt[][] }   // poligono anti-horário (area>0); furos horários (area<0)
export interface ResultadoPerfis {
  perfis: Perfil[]
  pontasSoltas: string[]               // ids de PONTOS que são extremidade de um único traço (contorno aberto)
  autointersecoes: [string, string][]  // pares de ids de entidades (linha/arco/círculo, não construção) que se cruzam fora dos extremos compartilhados
}

type Linha = Extract<EntSk, { tipo: 'linha' }>
type Arco = Extract<EntSk, { tipo: 'arco' }>
// na/nb = nó (raiz da união-busca) de pa/pb
interface Trecho { ent: Linha | Arco; pa: string; pb: string; na: string; nb: string }
// forma geométrica de uma entidade para testar interseções
type Forma = { tipo: 'seg'; a: Pt; b: Pt } | { tipo: 'arco'; c: Pt; r: number; a: Pt; b: Pt } | { tipo: 'circ'; c: Pt; r: number }

const FUSAO = 1e-6 // mm: distância para fundir pontos e reconhecer extremo compartilhado

export function detectaPerfis(sk: SketchFeature): ResultadoPerfis {
  const ents = sk.entidades.filter(e => !e.construcao)
  const pts = new Map<string, Pt>()
  for (const e of sk.entidades) if (e.tipo === 'ponto') pts.set(e.id, { x: e.x, y: e.y })

  // união-busca de pontos
  const pai = new Map<string, string>()
  for (const k of pts.keys()) pai.set(k, k)
  const raiz = (k: string): string => { let r = k; while (pai.get(r) !== r) r = pai.get(r)!; return r }
  const une = (x: string, y: string) => { const rx = raiz(x), ry = raiz(y); if (rx !== ry) pai.set(rx, ry) }
  const ids = [...pts.keys()]
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++)
      if (dist(pts.get(ids[i])!, pts.get(ids[j])!) < FUSAO) une(ids[i], ids[j])
  for (const r of sk.restricoes)
    if (r.tipo === 'coincidente' && r.e.length >= 2 && pts.has(r.e[0]) && pts.has(r.e[1])) une(r.e[0], r.e[1])

  // arestas (trechos) e lacos já fechados (círculo inteiro, arco que volta ao mesmo nó)
  const trechos: Trecho[] = []
  const lacos: Pt[][] = []
  for (const e of ents) {
    if (e.tipo === 'ponto') continue
    if (e.tipo === 'circulo') {
      const c = pts.get(e.c)
      if (c) lacos.push(discretizaCirculo(c, e.r))
      continue
    }
    if (!pts.has(e.a) || !pts.has(e.b)) continue
    if (e.tipo === 'arco' && !pts.has(e.c)) continue
    const na = raiz(e.a), nb = raiz(e.b)
    if (na !== nb) trechos.push({ ent: e, pa: e.a, pb: e.b, na, nb })
    else if (e.tipo === 'arco') lacos.push(discretizaArco(pts.get(e.c)!, pts.get(e.a)!, pts.get(e.b)!))
    // linha de comprimento zero: ignorada
  }

  // grau e adjacência dos nós
  const grau = new Map<string, number>()
  const adj = new Map<string, number[]>()
  trechos.forEach((t, i) => {
    for (const n of [t.na, t.nb]) {
      grau.set(n, (grau.get(n) ?? 0) + 1)
      adj.set(n, [...(adj.get(n) ?? []), i])
    }
  })

  // componentes conexas do grafo
  const visto = new Set<string>()
  const pontas = new Set<string>()
  for (const n0 of adj.keys()) {
    if (visto.has(n0)) continue
    visto.add(n0)
    const pilha = [n0]
    const tIdx = new Set<number>()
    while (pilha.length) {
      const n = pilha.pop()!
      for (const i of adj.get(n)!) {
        tIdx.add(i)
        for (const m of [trechos[i].na, trechos[i].nb]) if (!visto.has(m)) { visto.add(m); pilha.push(m) }
      }
    }
    const comp = [...tIdx]
    const nosComp = comp.flatMap(i => [trechos[i].na, trechos[i].nb])
    // junção em T/Y (grau >= 3): sem perfil e sem ponta solta para esta componente
    if (nosComp.some(n => grau.get(n)! >= 3)) continue
    if (nosComp.some(n => grau.get(n) === 1)) {
      for (const i of comp) {
        const t = trechos[i]
        if (grau.get(t.na) === 1) pontas.add(t.pa)
        if (grau.get(t.nb) === 1) pontas.add(t.pb)
      }
    } else {
      lacos.push(percorre(comp, trechos, adj, pts))
    }
  }

  // aninhamento: profundidade = nº de lacos que contêm este; pai = o mais interno que o contém
  const validos = lacos.filter(l => l.length >= 3 && Math.abs(areaAssinada(l)) > EPS)
  const conts = validos.map((l, i) => validos.flatMap((_, j) => j !== i && pontoNoPoligono(l[0], validos[j]) ? [j] : []))
  const paiDe = conts.map(cs => cs.length ? cs.reduce((m, j) => conts[j].length > conts[m].length ? j : m) : -1)
  const furos = new Map<number, Pt[][]>()
  validos.forEach((l, i) => {
    if (conts[i].length % 2 === 1) furos.set(paiDe[i], [...(furos.get(paiDe[i]) ?? []), orienta(l, -1)])
  })
  const perfis: Perfil[] = []
  validos.forEach((l, i) => {
    if (conts[i].length % 2 === 0) perfis.push({ poligono: orienta(l, 1), furos: furos.get(i) ?? [] })
  })

  // autointersecções: pares de entidades que se cruzam fora de extremo compartilhado
  const itens = ents.flatMap(e => { const f = formaDe(e, pts); return f ? [{ id: e.id, f }] : [] })
  const autointersecoes: [string, string][] = []
  for (let i = 0; i < itens.length; i++)
    for (let j = i + 1; j < itens.length; j++) {
      const A = itens[i], B = itens[j]
      const cruz = interFormas(A.f, B.f)
      if (cruz.some(p => !(emExtremo(p, A.f) && emExtremo(p, B.f)))) autointersecoes.push([A.id, B.id])
    }

  return { perfis, pontasSoltas: [...pontas], autointersecoes }
}

// Amostra o laço (comp = índices de trechos com todos os nós de grau 2) na ordem do contorno.
function percorre(comp: number[], trechos: Trecho[], adj: Map<string, number[]>, pts: Map<string, Pt>): Pt[] {
  const poly: Pt[] = []
  const ini = comp[0]
  let i = ini, no = trechos[ini].na
  do {
    const t = trechos[i]
    for (const p of amostraTrecho(t, no, pts)) poly.push(p)
    no = no === t.na ? t.nb : t.na
    const atual = i
    i = adj.get(no)!.find(k => k !== atual)!
  } while (i !== ini)
  return poly
}

// Pontos do trecho partindo do nó `de`, sem o último ponto (que é o início do próximo trecho).
function amostraTrecho(t: Trecho, de: string, pts: Map<string, Pt>): Pt[] {
  const frente = de === t.na
  const a = pts.get(t.pa)!, b = pts.get(t.pb)!
  if (t.ent.tipo === 'linha') return [frente ? a : b]
  const s = discretizaArco(pts.get(t.ent.c)!, a, b)
  return (frente ? s : s.reverse()).slice(0, -1)
}

const orienta = (poly: Pt[], sinal: 1 | -1): Pt[] =>
  Math.sign(areaAssinada(poly)) === sinal ? poly : [...poly].reverse()

function formaDe(e: EntSk, pts: Map<string, Pt>): Forma | null {
  if (e.tipo === 'linha') {
    const a = pts.get(e.a), b = pts.get(e.b)
    return a && b ? { tipo: 'seg', a, b } : null
  }
  if (e.tipo === 'circulo') {
    const c = pts.get(e.c)
    return c ? { tipo: 'circ', c, r: e.r } : null
  }
  if (e.tipo === 'arco') {
    const c = pts.get(e.c), a = pts.get(e.a), b = pts.get(e.b)
    return c && a && b ? { tipo: 'arco', c, r: dist(c, a), a, b } : null
  }
  return null
}

// Interseções de duas formas (arcos filtrados pelo ângulo).
function interFormas(f: Forma, g: Forma): Pt[] {
  let raw: Pt[] = []
  if (f.tipo === 'seg' && g.tipo === 'seg') {
    const p = interSegmentos(f.a, f.b, g.a, g.b)
    if (p) raw = [p]
  } else if (f.tipo === 'seg' && g.tipo !== 'seg') raw = interLinhaCirculo(f.a, f.b, g.c, g.r, true)
  else if (f.tipo !== 'seg' && g.tipo === 'seg') raw = interLinhaCirculo(g.a, g.b, f.c, f.r, true)
  else if (f.tipo !== 'seg' && g.tipo !== 'seg') raw = interCirculoCirculo(f.c, f.r, g.c, g.r)
  return raw.filter(p => [f, g].every(h => h.tipo !== 'arco' || noArco(p, h.c, h.a, h.b)))
}

// p é um dos extremos de f (círculo não tem extremos).
const emExtremo = (p: Pt, f: Forma): boolean =>
  f.tipo !== 'circ' && (dist(p, f.a) < FUSAO || dist(p, f.b) < FUSAO)
