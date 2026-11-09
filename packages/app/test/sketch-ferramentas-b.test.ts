import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { EntSk } from '@3dm/core/sketch'
import { arco, circulo, poligono, slot } from '../src/sketch/ferramentas-b.ts'
import type { ContextoFerr, EntradaFerr } from '../src/sketch/ferramenta.ts'
import { T } from '../src/textos.ts'

const pt = (x: number, y: number, ref?: string): EntradaFerr => ({ tipo: 'ponto', p: { x, y }, ref })
const val = (v: number): EntradaFerr => ({ tipo: 'valor', v })
const opc = (opcao: string): EntradaFerr => ({ tipo: 'opcao', opcao })
const d = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.hypot(q.x - p.x, q.y - p.y)

const coord = (ent: EntSk[], id: string) => {
  const e = ent.find(x => x.id === id)
  if (!e || e.tipo !== 'ponto') throw new Error(`ponto ${id} nao encontrado`)
  return e
}

const raiosDosArcos = (ent: EntSk[], r: number) => {
  for (const e of ent) {
    if (e.tipo !== 'arco') continue
    assert.ok(Math.abs(d(coord(ent, e.c), coord(ent, e.a)) - r) < 1e-9)
    assert.ok(Math.abs(d(coord(ent, e.c), coord(ent, e.b)) - r) < 1e-9)
  }
}

test('circulo: centro e raio digitado', () => {
  const t = circulo()
  t.entra(pt(0, 0))
  const s = t.entra(val(5))
  assert.equal(s.fim, true)
  assert.deepEqual(s.adicao, {
    entidades: [{ tipo: 'ponto', id: '@1', x: 0, y: 0 }, { tipo: 'circulo', id: '@2', c: '@1', r: 5 }],
    restricoes: [],
  })
})

test('circulo: raio pelo ponto (distancia centro-ponto)', () => {
  const t = circulo()
  t.entra(pt(0, 0))
  const s = t.entra(pt(3, 4))
  assert.equal(s.fim, true)
  assert.deepEqual(s.adicao!.entidades.at(-1), { tipo: 'circulo', id: '@2', c: '@1', r: 5 })
})

test('circulo: opcao Diametro e valor 20 dao raio 10', () => {
  const t = circulo()
  t.entra(pt(0, 0))
  const p = t.entra(opc('Diametro'))
  assert.equal(p.prompt, T.ferr.circD)
  assert.deepEqual(p.opcoes, [])
  const s = t.entra(val(20))
  assert.deepEqual(s.adicao!.entidades.at(-1), { tipo: 'circulo', id: '@2', c: '@1', r: 10 })
})

test('circulo: centro com ref reutiliza o ponto', () => {
  const t = circulo()
  t.entra(pt(0, 0, 'p3'))
  const s = t.entra(val(2))
  assert.deepEqual(s.adicao!.entidades, [{ tipo: 'circulo', id: '@1', c: 'p3', r: 2 }])
})

test('circulo: raio <= 0 e opcao desconhecida devolvem o mesmo passo', () => {
  const t = circulo()
  t.entra(pt(0, 0))
  const antes = t.entra(opc('zzz'))
  assert.equal(antes.fim, false)
  assert.deepEqual(t.entra(val(0)), antes)
  assert.deepEqual(t.entra(val(-3)), antes)
})

test('arco 3P: centro, extremos e P2 entre a e b no sentido anti-horario', () => {
  const t = arco()
  t.entra(pt(5, 0))
  t.entra(pt(0, 5))
  const s = t.entra(pt(-5, 0))
  assert.equal(s.fim, true)
  assert.deepEqual(s.adicao!.entidades, [
    { tipo: 'ponto', id: '@1', x: 0, y: 0 },
    { tipo: 'ponto', id: '@2', x: 5, y: 0 },
    { tipo: 'ponto', id: '@3', x: -5, y: 0 },
    { tipo: 'arco', id: '@4', c: '@1', a: '@2', b: '@3' },
  ])
  // angulos: a = 0, P2 = pi/2, b = pi; P2 deve estar em (0, pi)
  const ang = (x: number, y: number) => { const t = Math.atan2(y, x); return t < 0 ? t + 2 * Math.PI : t }
  const TAU = 2 * Math.PI
  const varB = (ang(-5, 0) - ang(5, 0) + TAU) % TAU
  const varP2 = (ang(0, 5) - ang(5, 0) + TAU) % TAU
  assert.ok(varP2 > 0 && varP2 < varB)
})

test('arco 3P: troca a e b quando o sentido natural nao passa por P2', () => {
  const t = arco()
  t.entra(pt(-5, 0))
  t.entra(pt(0, 5))
  const s = t.entra(pt(5, 0))
  assert.deepEqual(s.adicao!.entidades, [
    { tipo: 'ponto', id: '@1', x: 0, y: 0 },
    { tipo: 'ponto', id: '@2', x: 5, y: 0 },
    { tipo: 'ponto', id: '@3', x: -5, y: 0 },
    { tipo: 'arco', id: '@4', c: '@1', a: '@2', b: '@3' },
  ])
})

test('arco 3P: pontos colineares ignoram o P3', () => {
  const t = arco()
  t.entra(pt(0, 0))
  t.entra(pt(1, 1))
  const s = t.entra(pt(2, 2))
  assert.equal(s.fim, false)
  assert.equal(s.adicao, undefined)
  assert.equal(s.prompt, T.ferr.arcoP3)
})

test('arco 3P: ref de P1 reutiliza o ponto', () => {
  const t = arco()
  t.entra(pt(5, 0, 'p7'))
  t.entra(pt(0, 5))
  const s = t.entra(pt(-5, 0))
  assert.deepEqual(s.adicao!.entidades, [
    { tipo: 'ponto', id: '@1', x: 0, y: 0 },
    { tipo: 'ponto', id: '@2', x: -5, y: 0 },
    { tipo: 'arco', id: '@3', c: '@1', a: 'p7', b: '@2' },
  ])
})

test('poligono inscrito n=6: vertices a distancia r do centro', () => {
  const t = poligono()
  t.entra(pt(0, 0))
  t.entra(val(6))
  const s = t.entra(pt(3, 0))
  assert.equal(s.fim, true)
  const ent = s.adicao!.entidades
  const pontos = ent.filter(e => e.tipo === 'ponto')
  assert.equal(pontos.length, 6)
  for (const p of pontos) if (p.tipo === 'ponto') assert.ok(Math.abs(Math.hypot(p.x, p.y) - 3) < 1e-9)
  assert.equal(ent.filter(e => e.tipo === 'linha').length, 6)
  const rs = s.adicao!.restricoes
  assert.equal(rs.length, 5)
  assert.ok(rs.every(r => r.tipo === 'igual' && r.e.length === 2))
})

test('poligono circunscrito: ponto medio de cada lado a distancia r', () => {
  const t = poligono()
  t.entra(pt(0, 0))
  t.entra(val(6))
  t.entra(opc('Circunscrito'))
  const s = t.entra(val(3))
  assert.equal(s.fim, true)
  const ent = s.adicao!.entidades
  for (const l of ent) {
    if (l.tipo !== 'linha') continue
    const a = coord(ent, l.a), b = coord(ent, l.b)
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    assert.ok(Math.abs(Math.hypot(m.x, m.y) - 3) < 1e-9)
  }
  // primeiro vertice no angulo 0 (entrada por valor), a distancia r / cos(pi/6)
  const v1 = coord(ent, '@1')
  assert.ok(Math.abs(v1.y) < 1e-9)
  assert.ok(Math.abs(v1.x - 3 / Math.cos(Math.PI / 6)) < 1e-9)
})

test('poligono: lados invalidos sao ignorados', () => {
  const t = poligono()
  t.entra(pt(0, 0))
  for (const v of [2, 65, 3.5, 0]) assert.equal(t.entra(val(v)).prompt, T.ferr.polN)
  assert.equal(t.entra(pt(1, 0)).prompt, T.ferr.polN)
  assert.equal(t.entra(val(3)).prompt, T.ferr.polR)
})

test('slot: centros (0,0),(20,0) e largura 10 geram arcos de raio 5', () => {
  const t = slot()
  t.entra(pt(0, 0))
  t.entra(pt(20, 0))
  const s = t.entra(val(10))
  assert.equal(s.fim, true)
  const ent = s.adicao!.entidades
  assert.equal(ent.filter(e => e.tipo === 'arco').length, 2)
  assert.equal(ent.filter(e => e.tipo === 'linha').length, 2)
  raiosDosArcos(ent, 5)
  const rs = s.adicao!.restricoes
  assert.equal(rs.filter(r => r.tipo === 'tangente').length, 4)
  assert.equal(rs.filter(r => r.tipo === 'igual').length, 1)
})

test('slot: largura pelo ponto = 2 x distancia a reta dos centros', () => {
  const t = slot()
  t.entra(pt(0, 0))
  t.entra(pt(20, 0))
  const s = t.entra(pt(10, 5))
  assert.equal(s.fim, true)
  raiosDosArcos(s.adicao!.entidades, 5)
})

test('slot: centros coincidentes e largura 0 sao ignorados', () => {
  const t = slot()
  t.entra(pt(1, 1))
  assert.equal(t.entra(pt(1, 1)).prompt, T.ferr.slotP2)
  t.entra(pt(4, 5))
  assert.equal(t.entra(pt(1, 1)).fim, false)
  assert.equal(t.entra(val(0)).fim, false)
})

test('ids locais sao unicos dentro de um comando', () => {
  const p = poligono()
  p.entra(pt(0, 0)); p.entra(val(6))
  const sp = p.entra(pt(3, 0))
  const sl = slot()
  sl.entra(pt(0, 0)); sl.entra(pt(20, 0))
  const ss = sl.entra(val(10))
  for (const s of [sp, ss]) {
    const a = s.adicao!
    const ids = [...a.entidades.map(e => e.id), ...a.restricoes.map(r => r.id)]
    assert.equal(new Set(ids).size, ids.length)
  }
})

// Contexto falso: o sketch ativo é só a lista de entidades dada.
const P = (id: string, x: number, y: number): EntSk => ({ tipo: 'ponto', id, x, y })
const L = (id: string, a: string, b: string): EntSk => ({ tipo: 'linha', id, a, b })
const C = (id: string, c: string, r: number): EntSk => ({ tipo: 'circulo', id, c, r })
const ctxCom = (entidades: EntSk[]): ContextoFerr => ({ sk: () => ({ id: 'sk1', tipo: 'sketch', plano: { base: 'XY', offset: 0 }, entidades, restricoes: [] }) })
const duasLinhas = [P('pa', -10, 0), P('pb', 10, 0), L('l1', 'pa', 'pb'), P('pc', 10, -10), P('pd', 10, 10), L('l2', 'pc', 'pd')]
const linhaECirculo = [P('pc0', 0, 0), C('k1', 'pc0', 10), P('pe', -30, 11), P('pf', 30, 11), L('l3', 'pe', 'pf')]
const duasParalelas = [P('pa', -10, 0), P('pb', 10, 0), L('l1', 'pa', 'pb'), P('pc', -10, 4), P('pd', 10, 4), L('l2', 'pc', 'pd')]
const doisCirculos = [P('pc0', 0, 0), C('k1', 'pc0', 10), P('pc1', 30, 0), C('k2', 'pc1', 5)]

test('circulo 2P: diametro entre os dois pontos', () => {
  const t = circulo()
  assert.equal(t.inicio().prompt, T.ferrB.circC2)
  assert.deepEqual(t.inicio().opcoes, [T.ferrB.op.p2, T.ferrB.op.p3, T.ferrB.op.ttr])
  assert.equal(t.entra(opc('2P')).prompt, T.ferrB.circ2p1)
  assert.equal(t.entra(pt(0, 0)).prompt, T.ferrB.circ2p2)
  const s = t.entra(pt(10, 0))
  assert.equal(s.fim, true)
  assert.deepEqual(s.adicao, {
    entidades: [{ tipo: 'ponto', id: '@1', x: 5, y: 0 }, { tipo: 'circulo', id: '@2', c: '@1', r: 5 }],
    restricoes: [],
  })
})

test('circulo 3P: centro e raio pelos tres pontos', () => {
  const t = circulo()
  t.entra(opc('3P'))
  t.entra(pt(5, 0)); t.entra(pt(0, 5))
  const s = t.entra(pt(-5, 0))
  assert.equal(s.fim, true)
  const ent = s.adicao!.entidades
  const c = coord(ent, '@1')
  assert.ok(Math.abs(c.x) < 1e-9 && Math.abs(c.y) < 1e-9)
  assert.ok(Math.abs((ent.at(-1) as { r: number }).r - 5) < 1e-9)
})

test('circulo 3P: pontos colineares ignoram o 3o', () => {
  const t = circulo()
  t.entra(opc('3P'))
  t.entra(pt(0, 0)); t.entra(pt(1, 1))
  const s = t.entra(pt(2, 2))
  assert.equal(s.fim, false)
  assert.equal(s.adicao, undefined)
  assert.equal(s.prompt, T.ferrB.circ3p)
})

test('circulo TTR: linha x linha, centro mais perto do meio dos cliques', () => {
  const t = circulo(ctxCom(duasLinhas))
  t.entra(opc('TTR'))
  assert.equal(t.entra(pt(0, 0.5)).prompt, T.ferrB.ttr2)
  assert.equal(t.entra(pt(10, 5)).prompt, T.ferrB.ttrRaio)
  const s = t.entra(val(2))
  assert.equal(s.fim, true)
  const ent = s.adicao!.entidades
  const c = coord(ent, '@1')
  assert.ok(Math.abs(c.x - 8) < 1e-9 && Math.abs(c.y - 2) < 1e-9)
  assert.ok(Math.abs((ent.at(-1) as { r: number }).r - 2) < 1e-9)
  assert.deepEqual(s.adicao!.restricoes.map(r => [r.tipo, r.e]), [['tangente', ['@2', 'l1']], ['tangente', ['@2', 'l2']]])
})

test('circulo TTR: linha x circulo, lado e (fora) escolhidos pelo meio dos cliques', () => {
  const t = circulo(ctxCom(linhaECirculo))
  t.entra(opc('TTR'))
  t.entra(pt(0, 10)) // circulo k1
  t.entra(pt(20, 11)) // linha l3
  const s = t.entra(val(2))
  assert.equal(s.fim, true)
  const c = coord(s.adicao!.entidades, '@1')
  assert.ok(Math.abs(c.x - Math.sqrt(63)) < 1e-9 && Math.abs(c.y - 9) < 1e-9)
  assert.deepEqual(s.adicao!.restricoes.map(r => r.e), [['@2', 'k1'], ['@2', 'l3']])
})

test('circulo TTR: circulo x circulo e linhas paralelas devolvem erro e ficam no passo', () => {
  const t = circulo(ctxCom(doisCirculos))
  t.entra(opc('TTR'))
  t.entra(pt(10, 0))
  const err = t.entra(pt(35, 0))
  assert.equal(err.prompt, T.ferrB.ttrErro)
  assert.equal(err.fim, false)
  assert.equal(err.adicao, undefined)

  const p = circulo(ctxCom(duasParalelas))
  p.entra(opc('TTR'))
  p.entra(pt(0, 0.5)); p.entra(pt(0, 3.5))
  const semSolucao = p.entra(val(2))
  assert.equal(semSolucao.prompt, T.ferrB.ttrErro)
  assert.equal(semSolucao.fim, false)
})

test('circulo TTR: sem contexto ou sem entidade perto mantem o passo', () => {
  const t = circulo()
  t.entra(opc('TTR'))
  const s = t.entra(pt(0, 0.5))
  assert.equal(s.prompt, T.ferrB.ttr1)
  assert.equal(s.adicao, undefined)
  const longe = circulo(ctxCom(duasLinhas))
  longe.entra(opc('TTR'))
  assert.equal(longe.entra(pt(0, 50)).prompt, T.ferrB.ttr1)
})

test('arco tangente: comeca no fim da ultima linha e e tangente a ela (anti-horario)', () => {
  const t = arco(ctxCom([P('pa', 0, 0), P('pb', 10, 0), L('l1', 'pa', 'pb')]))
  assert.equal(t.entra(opc('Tangente')).prompt, T.ferrB.arcoTanFim)
  const s = t.entra(pt(12, 2))
  assert.equal(s.fim, true)
  const ent = s.adicao!.entidades
  const c = coord(ent, '@1')
  assert.ok(Math.abs(c.x - 10) < 1e-9 && Math.abs(c.y - 2) < 1e-9)
  assert.deepEqual(ent.at(-1), { tipo: 'arco', id: '@3', c: '@1', a: 'pb', b: '@2' })
  assert.deepEqual(s.adicao!.restricoes, [{ id: '@4', tipo: 'tangente', e: ['l1', '@3'] }])
})

test('arco tangente: lado horario troca a e b para manter anti-horario', () => {
  const t = arco(ctxCom([P('pa', 0, 0), P('pb', 10, 0), L('l1', 'pa', 'pb')]))
  t.entra(opc('Tangente'))
  const s = t.entra(pt(12, -2))
  assert.equal(s.fim, true)
  assert.deepEqual(s.adicao!.entidades.at(-1), { tipo: 'arco', id: '@3', c: '@1', a: '@2', b: 'pb' })
  assert.deepEqual(s.adicao!.restricoes, [{ id: '@4', tipo: 'tangente', e: ['l1', '@3'] }])
})

test('arco tangente: sem linha anterior devolve erro no prompt', () => {
  const semLinha = arco(ctxCom([P('pa', 0, 0)]))
  const p = semLinha.entra(opc('Tangente'))
  assert.equal(p.prompt, T.ferrB.arcoTanErro)
  assert.equal(p.fim, false)
  assert.equal(arco().entra(opc('Tangente')).prompt, T.ferrB.arcoTanErro)
})
