import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candidatosOsnap, resolveSnap } from '../src/sketch/snap.ts';
import type { Alvo, OpcoesSnap, TipoSnap } from '../src/sketch/snap.ts';
import type { EntSk, Pt, SketchFeature } from '../src/sketch/tipos.ts';

const P = (x: number, y: number): Pt => ({ x, y });
const near = (p: Pt | null | undefined, q: Pt, tol = 1e-6) => {
  assert.ok(p, 'esperava ponto');
  assert.ok(Math.hypot(p.x - q.x, p.y - q.y) < tol, `(${p.x}, ${p.y}) != (${q.x}, ${q.y})`);
};
const sk = (...entidades: EntSk[]): SketchFeature => ({ id: 'sk1', tipo: 'sketch', plano: { base: 'XY', offset: 0 }, entidades, restricoes: [] });
const pt = (id: string, x: number, y: number): EntSk => ({ id, tipo: 'ponto', x, y });
const linha = (id: string, a: string, b: string): EntSk => ({ id, tipo: 'linha', a, b });
const circ = (id: string, c: string, r: number): EntSk => ({ id, tipo: 'circulo', c, r });
const arco = (id: string, c: string, a: string, b: string): EntSk => ({ id, tipo: 'arco', c, a, b });
const base: OpcoesSnap = { tol: 1, osnap: true, ortho: false, polar: false, grade: false, passoGrade: 5, polarGraus: 15 };
const opc = (o: Partial<OpcoesSnap> = {}): OpcoesSnap => ({ ...base, ...o });
const ache = (c: Alvo[], tipo: TipoSnap) => c.find(a => a.tipo === tipo);
const ptoAng = (graus: number, r = 10): Pt => P(r * Math.cos((graus * Math.PI) / 180), r * Math.sin((graus * Math.PI) / 180));

test('extremidade: ponto perto do cursor, com ref = id do ponto', () => {
  const c = candidatosOsnap(sk(pt('p1', 10, 10)), P(10.4, 10.2), opc());
  assert.equal(c.length, 1);
  assert.equal(c[0].tipo, 'extremidade');
  assert.equal(c[0].ref, 'p1');
});

test('medio: ponto médio de linha e do arco', () => {
  const l = candidatosOsnap(sk(pt('p1', 0, 0), pt('p2', 10, 0), linha('l1', 'p1', 'p2')), P(5.2, 0.1), opc());
  const m = ache(l, 'medio');
  near(m?.p, P(5, 0));
  assert.equal(m?.ref, 'l1');
  // quarto de volta de a=(10,0) a b=(0,10): ponto médio em 45 graus
  const s = sk(pt('pc', 0, 0), pt('pa', 10, 0), pt('pb', 0, 10), arco('a1', 'pc', 'pa', 'pb'));
  const a = candidatosOsnap(s, P(7.1, 7.0), opc());
  near(ache(a, 'medio')?.p, P(10 * Math.SQRT1_2, 10 * Math.SQRT1_2));
  assert.equal(ache(a, 'medio')?.ref, 'a1');
});

test('centro: centro de círculo, ref = id do ponto central', () => {
  const c = candidatosOsnap(sk(pt('pc', 0, 0), circ('c1', 'pc', 10)), P(0.3, 0.2), opc());
  const cen = ache(c, 'centro');
  near(cen?.p, P(0, 0));
  assert.equal(cen?.ref, 'pc');
});

test('quadrante: 0/90/180/270 graus do círculo', () => {
  const c = candidatosOsnap(sk(pt('pc', 0, 0), circ('c1', 'pc', 10)), P(-0.1, -9.8), opc());
  near(ache(c, 'quadrante')?.p, P(0, -10));
  assert.equal(ache(c, 'quadrante')?.ref, 'c1');
});

test('quadrante do arco só vale se o ponto pertence ao arco', () => {
  // arco de 0 a 90 graus: o quadrante de 180 graus (-10, 0) não existe
  const s = sk(pt('pc', 0, 0), pt('pa', 10, 0), pt('pb', 0, 10), arco('a1', 'pc', 'pa', 'pb'));
  const c = candidatosOsnap(s, P(-10, 0.1), opc());
  assert.equal(c.length, 0);
});

test('intersecao: linha x linha', () => {
  const s = sk(pt('a', 0, 0), pt('b', 10, 10), pt('c', 0, 10), pt('d', 10, 0), linha('l1', 'a', 'b'), linha('l2', 'c', 'd'));
  near(ache(candidatosOsnap(s, P(5.1, 4.9), opc()), 'intersecao')?.p, P(5, 5));
});

test('intersecao: linha x círculo', () => {
  const s = sk(pt('pa', -10, 0), pt('pb', 10, 0), pt('pc', 0, 0), linha('l1', 'pa', 'pb'), circ('c1', 'pc', 5));
  near(ache(candidatosOsnap(s, P(5.1, 0.1), opc()), 'intersecao')?.p, P(5, 0));
});

test('perpendicular: pé da perpendicular de ultimo sobre a linha', () => {
  const s = sk(pt('p1', 0, 0), pt('p2', 10, 0), linha('l1', 'p1', 'p2'));
  const c = candidatosOsnap(s, P(4.1, 0.2), opc({ ultimo: P(4, 5) }));
  near(ache(c, 'perpendicular')?.p, P(4, 0));
  assert.equal(ache(c, 'perpendicular')?.ref, 'l1');
});

test('tangente: ponto de tangência de ultimo ao círculo', () => {
  const s = sk(pt('pc', 0, 0), circ('c1', 'pc', 5));
  // de (10,0), tangentes tocam o círculo de raio 5 em (2.5, +-4.330127)
  const c = candidatosOsnap(s, P(2.6, 4.3), opc({ tol: 0.5, ultimo: P(10, 0) }));
  near(ache(c, 'tangente')?.p, P(2.5, 5 * Math.sqrt(3) / 2), 1e-6);
  assert.equal(ache(c, 'tangente')?.ref, 'c1');
});

test('proximo: ponto mais perto sobre a entidade', () => {
  const s = sk(pt('p1', 0, 0), pt('p2', 10, 0), linha('l1', 'p1', 'p2'));
  const c = candidatosOsnap(s, P(3, 0.3), opc());
  near(ache(c, 'proximo')?.p, P(3, 0));
  assert.equal(ache(c, 'proximo')?.ref, 'l1');
  assert.equal(ache(c, 'medio'), undefined);
});

test('prioridade: extremidade vence medio e proximo, mesmo sendo mais longe', () => {
  const s = sk(pt('p1', 5, 0.1), pt('pa', 0, 0), pt('pb', 10, 0), linha('l1', 'pa', 'pb'));
  const c = candidatosOsnap(s, P(5, 0), opc());
  assert.equal(c[0].tipo, 'extremidade');
  assert.equal(c[0].ref, 'p1');
  assert.ok(c.findIndex(a => a.tipo === 'medio') > 0);
  assert.ok(c.findIndex(a => a.tipo === 'proximo') > c.findIndex(a => a.tipo === 'medio'));
});

test('tol: fora da tolerância não captura, dentro captura', () => {
  const s = sk(pt('p1', 10, 10));
  assert.deepEqual(candidatosOsnap(s, P(10, 12), opc()), []);
  assert.equal(candidatosOsnap(s, P(10, 12), opc({ tol: 3 })).length, 1);
});

test('excluir: ignora ponto e entidade excluídos', () => {
  const s = sk(pt('p1', 10, 10));
  assert.deepEqual(candidatosOsnap(s, P(10.1, 10.1), opc(), ['p1']), []);
  const l = sk(pt('pa', 0, 0), pt('pb', 10, 0), linha('l1', 'pa', 'pb'));
  const c = candidatosOsnap(l, P(5, 0.2), opc(), ['l1']);
  assert.equal(c.some(a => a.ref === 'l1'), false);
});

test('ORTHO: projeta no eixo mais próximo a partir de ultimo', () => {
  const o = opc({ osnap: false, ortho: true, ultimo: P(0, 0) });
  const h = resolveSnap(sk(), P(10, 3), o);
  assert.equal(h?.tipo, 'ortho');
  near(h?.p, P(10, 0));
  near(resolveSnap(sk(), P(3, 10), o)?.p, P(0, 10));
});

test('ORTHO com Shift inverte o ORTHO', () => {
  assert.equal(resolveSnap(sk(), P(10, 3), opc({ osnap: false, ortho: true, shift: true, ultimo: P(0, 0) })), null);
  near(resolveSnap(sk(), P(3, 10), opc({ osnap: false, ortho: false, shift: true, ultimo: P(0, 0) }))?.p, P(0, 10));
});

test('POLAR em 15, 30 e 45 graus', () => {
  const po = (g: number, cursor: number) => resolveSnap(sk(), ptoAng(cursor), opc({ osnap: false, polar: true, polarGraus: g, ultimo: P(0, 0) }));
  const a = po(15, 16);
  assert.equal(a?.tipo, 'polar');
  near(a?.p, ptoAng(15));
  near(po(30, 31)?.p, ptoAng(30));
  near(po(45, 43)?.p, ptoAng(45));
  assert.equal(po(45, 40), null); // a 5 graus de 45: fora dos 3 graus de captura
});

test('ORTHO e POLAR não ficam ligados juntos: ORTHO vence', () => {
  const r = resolveSnap(sk(), ptoAng(16), opc({ osnap: false, ortho: true, polar: true, polarGraus: 15, ultimo: P(0, 0) }));
  assert.equal(r?.tipo, 'ortho');
});

test('GRADE arredonda ao passo de 5', () => {
  const r = resolveSnap(sk(), P(12.4, 7.6), opc({ osnap: false, grade: true, passoGrade: 5 }));
  assert.equal(r?.tipo, 'grade');
  near(r?.p, P(10, 10));
});

test('OSNAP vence ORTHO e GRADE', () => {
  const r = resolveSnap(sk(pt('p', 10, 10)), P(10.2, 9.9), opc({ ortho: true, grade: true, ultimo: P(0, 0) }));
  assert.equal(r?.tipo, 'extremidade');
});

test('nada ligado: null', () => {
  assert.equal(resolveSnap(sk(), P(1, 2), opc({ osnap: false })), null);
});
