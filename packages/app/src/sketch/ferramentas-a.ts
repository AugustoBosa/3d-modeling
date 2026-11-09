// Ferramentas de desenho: LINHA, POLILINHA, RETANGULO, PONTO e CONSTRUCAO. Máquinas de estado puras (contrato em ferramenta.ts).
import type { Adicao, EntSk, Pt, RestSk } from '@3dm/core/sketch'
import type { Passo, Ferramenta, FabricaFerramenta, EntradaFerr, Forma } from './ferramenta.ts'
import { T } from '../textos.ts'

const EPS = 1e-9
const iguais = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y) < EPS
// palavra inteira ou inicial, sem diferenciar maiúsculas
const casa = (digitado: string, palavra: string) => {
  const d = digitado.trim().toLowerCase(), p = palavra.toLowerCase()
  return d === p || d === p[0]
}
const ptEnt = (id: string, p: Pt, cons: boolean): EntSk => ({ id, tipo: 'ponto', x: p.x, y: p.y, construcao: cons })
const segEnt = (id: string, a: string, b: string, cons: boolean): EntSk => ({ id, tipo: 'linha', a, b, construcao: cons })

interface Vertice { p: Pt; id: string; nova: boolean } // nova = ponto ainda não emitido em nenhuma adição

// LINHA, POLILINHA e CONSTRUCAO: cadeia de segmentos. Cada segmento vira uma adição; o ponto final é o início do próximo.
function cadeia(nome: string, cons: boolean): Ferramenta {
  const pts: Vertice[] = []
  let n = 0
  const novo = () => `@${++n}`

  const passo = (adicao?: Adicao, fim = false): Passo => ({
    prompt: pts.length ? T.ferr.linhaPn : T.ferr.linhaP1,
    opcoes: [
      ...(pts.length >= 3 ? [T.ferr.op.fechar] : []), // Fechar: só com 2 segmentos ou mais
      ...(pts.length >= 2 ? [T.ferr.op.desfazer] : []),
    ],
    previa: pts.slice(1).map((v, i): Forma => ({ k: 'linha', a: pts[i].p, b: v.p })),
    ...(adicao ? { adicao } : {}),
    fim,
  })

  return {
    nome,
    inicio: () => passo(),
    entra(e: EntradaFerr): Passo {
      if (e.tipo === 'valor') return passo() // distância direta: o chamador converte em ponto
      if (e.tipo === 'opcao') {
        if (pts.length >= 3 && casa(e.opcao, T.ferr.op.fechar)) {
          const ent = segEnt(novo(), pts[pts.length - 1].id, pts[0].id, cons)
          return passo({ entidades: [ent], restricoes: [] }, true)
        }
        if (pts.length >= 2 && casa(e.opcao, T.ferr.op.desfazer)) {
          pts.pop() // o último segmento emitido sai pelo chamador (projeto.desfaz)
          return { ...passo(), desfazUltima: true }
        }
        return passo()
      }
      if (pts.length && iguais(pts[pts.length - 1].p, e.p)) return passo() // clique repetido no mesmo ponto
      if (!pts.length) {
        pts.push({ p: e.p, id: e.ref ?? novo(), nova: !e.ref })
        return passo()
      }
      const a = pts[pts.length - 1]
      const entidades: EntSk[] = []
      if (a.nova) { entidades.push(ptEnt(a.id, a.p, cons)); a.nova = false }
      let id = e.ref
      if (!id) { id = novo(); entidades.push(ptEnt(id, e.p, cons)) }
      entidades.push(segEnt(novo(), a.id, id, cons))
      pts.push({ p: e.p, id, nova: false })
      return passo({ entidades, restricoes: [] })
    },
    cursor: (p: Pt): Forma[] => (pts.length ? [{ k: 'linha', a: pts[pts.length - 1].p, b: p }] : []),
    get ultimo() { return pts.length ? pts[pts.length - 1].p : null },
  }
}

export const linha: FabricaFerramenta = () => cadeia('LINHA', false)
export const polilinha: FabricaFerramenta = () => cadeia('POLILINHA', false)
export const construcao: FabricaFerramenta = () => cadeia('CONSTRUCAO', true)

// RETANGULO: fase do fluxo (cada uma tem um prompt em `passo`).
type Fase = 'inicio' | 'raio' | 'canto1' | 'c2' | 'centro' | 'canto' | 'tres1' | 'tres2' | 'tres3'
interface Canto { p: Pt; ref?: string } // ref = id de ponto existente sob o snap (não se redefine)

const espelho = (c: Pt, p: Pt): Pt => ({ x: 2 * c.x - p.x, y: 2 * c.y - p.y })
// normal unitária à esquerda de A->B
const normalEsq = (A: Pt, B: Pt): Pt => {
  const L = Math.hypot(B.x - A.x, B.y - A.y)
  return { x: -(B.y - A.y) / L, y: (B.x - A.x) / L }
}
// distância com sinal de p à reta A->B (positiva à esquerda)
const alturaDe = (A: Pt, B: Pt, p: Pt): number => {
  const n = normalEsq(A, B)
  return (p.x - A.x) * n.x + (p.y - A.y) * n.y
}
// retângulo girado sobre A->B com altura h (sinal = lado): 4 cantos em ordem
const retangulo3 = (A: Pt, B: Pt, h: number): Pt[] => {
  const n = normalEsq(A, B)
  return [A, B, { x: B.x + n.x * h, y: B.y + n.y * h }, { x: A.x + n.x * h, y: A.y + n.y * h }]
}
const poligono = (cs: Pt[]): Forma[] => cs.map((p, i): Forma => ({ k: 'linha', a: p, b: cs[(i + 1) % cs.length] }))
// retângulo p1-p2 com cantos cortados por s, em sentido anti-horário. ins[k]/outs[k]: onde o corte toca a aresta
// anterior/seguinte do canto k; cen[k]: centro do arredondamento do canto k (só usado no fillet).
function cortes(p1: Pt, p2: Pt, s: number) {
  const x0 = Math.min(p1.x, p2.x), x1 = Math.max(p1.x, p2.x), y0 = Math.min(p1.y, p2.y), y1 = Math.max(p1.y, p2.y)
  const P = [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]
  const u = P.map((p, k) => {
    const q = P[(k + 1) % 4], L = Math.hypot(q.x - p.x, q.y - p.y)
    return { x: (q.x - p.x) / L, y: (q.y - p.y) / L }
  })
  const ins = P.map((p, k) => ({ x: p.x - u[(k + 3) % 4].x * s, y: p.y - u[(k + 3) % 4].y * s }))
  const outs = P.map((p, k) => ({ x: p.x + u[k].x * s, y: p.y + u[k].y * s }))
  const cen = P.map((p, k) => ({ x: ins[k].x + outs[k].x - p.x, y: ins[k].y + outs[k].y - p.y }))
  return { ins, outs, cen }
}
const previaCortado = (p1: Pt, p2: Pt, s: number, fillet: boolean): Forma[] => {
  const { ins, outs, cen } = cortes(p1, p2, s)
  return ins.flatMap((_, k): Forma[] => [
    { k: 'linha', a: outs[k], b: ins[(k + 1) % 4] },
    fillet ? { k: 'arco', c: cen[k], a: ins[k], b: outs[k] } : { k: 'linha', a: ins[k], b: outs[k] },
  ])
}

export const retangulo: FabricaFerramenta = () => {
  let n = 0
  const novo = () => `@${++n}`
  let fase: Fase = 'inicio'
  let corte: 'fillet' | 'chanfro' | null = null // canto cortado (fluxo de 2 cantos): raio ou distância em `val`
  let val = 0
  let a: Canto | null = null // 1º canto, centro ou P1
  let b: Canto | null = null // P2 (3Pontos)
  let cur: Pt | null = null // último cursor: lado da altura digitada como valor
  let ultimo: Pt | null = null

  // cantos p1-p2 válidos (largura e altura > 0; no corte, valor entre 0 e a metade do menor lado)
  const ok2 = (p1: Pt, p2: Pt): boolean => {
    const w = Math.abs(p2.x - p1.x), h = Math.abs(p2.y - p1.y)
    return w >= EPS && h >= EPS && (corte === null || (val > 0 && val < Math.min(w, h) / 2))
  }

  // contorno de 4 cantos (ordem cíclica); h0 = aresta 0 horizontal -> H/V; null -> perpendicular/paralela
  const quadro = (cs: Canto[], h0: boolean | null): Adicao => {
    const entidades: EntSk[] = []
    const ids = cs.map(c => {
      if (c.ref) return c.ref
      const id = novo()
      entidades.push(ptEnt(id, c.p, false))
      return id
    })
    const ls = [novo(), novo(), novo(), novo()]
    ls.forEach((l, i) => entidades.push(segEnt(l, ids[i], ids[(i + 1) % 4], false)))
    const restricoes: RestSk[] = h0 === null
      ? [
          { id: novo(), tipo: 'perpendicular', e: [ls[0], ls[1]] },
          { id: novo(), tipo: 'perpendicular', e: [ls[1], ls[2]] },
          { id: novo(), tipo: 'perpendicular', e: [ls[2], ls[3]] },
          { id: novo(), tipo: 'paralela', e: [ls[0], ls[2]] },
        ]
      : ls.map((l, i): RestSk => ({ id: novo(), tipo: (i % 2 === 0) === h0 ? 'horizontal' : 'vertical', e: [l] }))
    return { entidades, restricoes }
  }

  // retângulo p1-p2 com cantos cortados: arcos (fillet) ou chanfros; linhas encurtadas ou com chanfro entre elas
  const cortado = (p1: Pt, p2: Pt, s: number, fillet: boolean): Adicao => {
    const { ins, outs, cen } = cortes(p1, p2, s)
    const entidades: EntSk[] = []
    const pto = (p: Pt): string => {
      const id = novo()
      entidades.push(ptEnt(id, p, false))
      return id
    }
    const I = ins.map(pto), O = outs.map(pto)
    const restricoes: RestSk[] = []
    const linhas: string[] = [], arcos: string[] = []
    for (let k = 0; k < 4; k++) {
      const ln = novo()
      entidades.push(segEnt(ln, O[k], I[(k + 1) % 4], false))
      linhas.push(ln)
      restricoes.push({ id: novo(), tipo: k % 2 === 0 ? 'horizontal' : 'vertical', e: [ln] })
      if (fillet) {
        const arco = novo()
        entidades.push({ id: arco, tipo: 'arco', c: pto(cen[k]), a: I[k], b: O[k] })
        arcos.push(arco)
      } else entidades.push(segEnt(novo(), I[k], O[k], false))
    }
    if (fillet) for (let k = 0; k < 4; k++) {
      restricoes.push({ id: novo(), tipo: 'tangente', e: [linhas[k], arcos[k]] })
      restricoes.push({ id: novo(), tipo: 'tangente', e: [linhas[(k + 3) % 4], arcos[k]] })
    }
    return { entidades, restricoes }
  }

  const fim = (adicao: Adicao): Passo => ({ prompt: T.ferr.recP2, opcoes: [], previa: [], adicao, fim: true })

  // fecha um retângulo a partir de dois cantos opostos
  const fecha2 = (p1: Pt, p2: Pt, r1?: string, r2?: string): Passo => {
    if (!ok2(p1, p2)) return passo()
    if (corte) return fim(cortado(p1, p2, val, corte === 'fillet'))
    return fim(quadro([{ p: p1, ref: r1 }, { p: { x: p2.x, y: p1.y } }, { p: p2, ref: r2 }, { p: { x: p1.x, y: p2.y } }], true))
  }

  // fecha o retângulo girado sobre A->B com altura h
  const fecha3 = (A: Canto, B: Canto, h: number): Passo => {
    if (Math.abs(h) < EPS) return passo()
    const cs = retangulo3(A.p, B.p, h)
    const h0 = Math.abs(B.p.y - A.p.y) < EPS
    const ortog = h0 || Math.abs(B.p.x - A.p.x) < EPS
    return fim(quadro([A, B, { p: cs[2] }, { p: cs[3] }], ortog ? h0 : null))
  }

  const previa2 = (p1: Pt, p2: Pt): Forma[] => {
    if (!ok2(p1, p2)) return []
    if (corte) return previaCortado(p1, p2, val, corte === 'fillet')
    return poligono([p1, { x: p2.x, y: p1.y }, p2, { x: p1.x, y: p2.y }])
  }

  const passo = (): Passo => {
    const s = (prompt: string, opcoes: string[] = [], previa: Forma[] = []): Passo => ({ prompt, opcoes, previa, fim: false })
    switch (fase) {
      case 'inicio': return s(T.ferrA.recP1Op, [T.ferrA.op.centro, T.ferrA.op.tres, T.ferrA.op.fillet, T.ferrA.op.chanfro])
      case 'raio': return s(corte === 'fillet' ? T.ferrA.recRaio : T.ferrA.recChanfro)
      case 'canto1': return s(T.ferr.recP1)
      case 'c2': return s(T.ferr.recP2, [], [{ k: 'ponto', p: a!.p }])
      case 'centro': return s(T.ferrA.recCentro)
      case 'canto': return s(T.ferrA.recCanto, [], [{ k: 'ponto', p: a!.p }])
      case 'tres1': return s(T.ferrA.recCanto)
      case 'tres2': return s(T.ferrA.rec3p2, [], [{ k: 'ponto', p: a!.p }])
      case 'tres3': return s(T.ferrA.rec3p3, [], [{ k: 'linha', a: a!.p, b: b!.p }])
    }
  }

  return {
    nome: 'RETANGULO',
    inicio: passo,
    entra(e: EntradaFerr): Passo {
      if (e.tipo === 'opcao') {
        if (fase !== 'inicio') return passo()
        if (casa(e.opcao, T.ferrA.op.centro)) fase = 'centro'
        else if (casa(e.opcao, T.ferrA.op.tres)) fase = 'tres1'
        else if (casa(e.opcao, T.ferrA.op.fillet)) { corte = 'fillet'; fase = 'raio' }
        else if (casa(e.opcao, T.ferrA.op.chanfro)) { corte = 'chanfro'; fase = 'raio' }
        return passo()
      }
      if (e.tipo === 'valor') {
        if (fase === 'raio' && e.v > 0) { val = e.v; fase = 'canto1' }
        else if (fase === 'tres3' && a && b && e.v > 0) {
          const lado = cur && alturaDe(a.p, b.p, cur) < 0 ? -1 : 1
          return fecha3(a, b, lado * e.v)
        }
        return passo()
      }
      ultimo = e.p
      const p = e.p
      switch (fase) {
        case 'inicio':
        case 'canto1': a = { p, ref: e.ref }; fase = 'c2'; return passo()
        case 'c2': return fecha2(a!.p, p, a!.ref, e.ref)
        case 'centro': a = { p }; fase = 'canto'; return passo()
        case 'canto': return fecha2(espelho(a!.p, p), p, undefined, e.ref)
        case 'tres1': a = { p, ref: e.ref }; fase = 'tres2'; return passo()
        case 'tres2':
          if (iguais(a!.p, p)) return passo()
          b = { p, ref: e.ref }; fase = 'tres3'; return passo()
        case 'tres3': return fecha3(a!, b!, alturaDe(a!.p, b!.p, p))
        default: return passo() // 'raio': espera o valor
      }
    },
    cursor(p: Pt): Forma[] {
      cur = p
      switch (fase) {
        case 'c2': return previa2(a!.p, p)
        case 'canto': return previa2(espelho(a!.p, p), p)
        case 'tres2': return [{ k: 'linha', a: a!.p, b: p }]
        case 'tres3': {
          const h = alturaDe(a!.p, b!.p, p)
          return Math.abs(h) < EPS ? [] : poligono(retangulo3(a!.p, b!.p, h))
        }
        default: return []
      }
    },
    get ultimo() { return ultimo },
  }
}

// PONTO: um clique, uma adição, fim. Com ref, o ponto já existe e nada é criado.
export const ponto: FabricaFerramenta = () => {
  let ultimo: Pt | null = null
  const passo = (): Passo => ({ prompt: T.ferr.ponto, opcoes: [], previa: [], fim: false })
  return {
    nome: 'PONTO',
    inicio: passo,
    entra(e: EntradaFerr): Passo {
      if (e.tipo !== 'ponto') return passo()
      ultimo = e.p
      const previa: Forma[] = [{ k: 'ponto', p: e.p }]
      if (e.ref) return { prompt: T.ferr.ponto, opcoes: [], previa, fim: true }
      return { prompt: T.ferr.ponto, opcoes: [], previa, adicao: { entidades: [ptEnt('@1', e.p, false)], restricoes: [] }, fim: true }
    },
    cursor: (p: Pt): Forma[] => [{ k: 'ponto', p }],
    get ultimo() { return ultimo },
  }
}
