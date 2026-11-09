import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dist, projetaNaLinha, interSegmentos, interLinhaCirculo, interCirculoCirculo, anguloDe, noArco,
  varreduraArco, discretizaArco, discretizaCirculo, areaAssinada, pontoNoPoligono,
} from '../src/sketch/geometria.ts';
import type { Pt } from '../src/sketch/tipos.ts';

const P = (x: number, y: number): Pt => ({ x, y });
const near = (p: Pt | null, q: Pt, tol = 1e-9) => {
  assert.ok(p, 'esperava ponto');
  assert.ok(dist(p, q) < tol, `(${p.x}, ${p.y}) != (${q.x}, ${q.y})`);
};
// flecha de cada corda <= tol (distância do centro ao ponto médio da corda = r - flecha)
const flechaOk = (c: Pt, r: number, pts: Pt[], tol: number) => {
  for (let i = 0; i + 1 < pts.length; i++) {
    const m = P((pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
    assert.ok(r - dist(c, m) <= tol + 1e-9, `flecha ${r - dist(c, m)} > ${tol}`);
  }
};

test('dist: pitágoras 3-4-5', () => {
  assert.equal(dist(P(0, 0), P(3, 4)), 5);
});

test('projetaNaLinha: ponto fora do segmento tem t < 0 e t em [0,1] dentro', () => {
  const r = projetaNaLinha(P(5, 5), P(0, 0), P(10, 0));
  near(r.pt, P(5, 0));
  assert.equal(r.t, 0.5);
  const f = projetaNaLinha(P(-10, 3), P(0, 0), P(10, 0));
  assert.equal(f.t, -1);
  near(f.pt, P(-10, 0));
});

test('interSegmentos: X cruza; fora do segmento -> null; estendendo -> ponto; paralelas -> null', () => {
  near(interSegmentos(P(0, 0), P(10, 10), P(0, 10), P(10, 0)), P(5, 5));
  assert.equal(interSegmentos(P(0, 0), P(10, 0), P(20, -5), P(20, 5)), null);
  near(interSegmentos(P(0, 0), P(10, 0), P(20, -5), P(20, 5), false), P(20, 0));
  assert.equal(interSegmentos(P(0, 0), P(10, 0), P(0, 1), P(10, 1)), null);
});

test('interLinhaCirculo: secante 2 pontos, tangente 1, sem contato 0, segmento corta', () => {
  const c = P(0, 0);
  const sec = interLinhaCirculo(P(-10, 3), P(10, 3), c, 5);
  assert.equal(sec.length, 2);
  near(sec[0], P(-4, 3));
  near(sec[1], P(4, 3));
  const tan = interLinhaCirculo(P(-10, 5), P(10, 5), c, 5);
  assert.equal(tan.length, 1);
  near(tan[0], P(0, 5));
  assert.equal(interLinhaCirculo(P(-10, 6), P(10, 6), c, 5).length, 0);
  const seg = interLinhaCirculo(P(-10, 0), P(0, 0), c, 5, true);
  assert.equal(seg.length, 1);
  near(seg[0], P(-5, 0));
});

test('interCirculoCirculo: 2 pontos, tangente 1, separados 0, concêntricos 0', () => {
  const dois = interCirculoCirculo(P(0, 0), 5, P(6, 0), 5);
  assert.equal(dois.length, 2);
  // ordem dos dois pontos não é garantida: confere que ambos estão presentes
  const acha = (q: Pt) => dois.some(p => dist(p, q) < 1e-9);
  assert.ok(acha(P(3, -4)) && acha(P(3, 4)));
  const tan = interCirculoCirculo(P(0, 0), 5, P(10, 0), 5);
  assert.equal(tan.length, 1);
  near(tan[0], P(5, 0));
  assert.equal(interCirculoCirculo(P(0, 0), 5, P(20, 0), 5).length, 0);
  assert.equal(interCirculoCirculo(P(0, 0), 5, P(0, 0), 3).length, 0);
});

test('anguloDe: em [0, 2pi)', () => {
  assert.equal(anguloDe(P(0, 0), P(1, 0)), 0);
  assert.ok(Math.abs(anguloDe(P(0, 0), P(0, -1)) - (3 * Math.PI) / 2) < 1e-12);
});

test('noArco: arco que cruza 0 rad (350 -> 10 graus)', () => {
  const c = P(0, 0);
  const d = (g: number) => P(Math.cos((g * Math.PI) / 180), Math.sin((g * Math.PI) / 180));
  const a = d(350), b = d(10);
  assert.equal(noArco(d(0), c, a, b), true);
  assert.equal(noArco(d(355), c, a, b), true);
  assert.equal(noArco(d(180), c, a, b), false);
  assert.equal(noArco(d(90), c, a, b), false);
});

test('varreduraArco: quarto de volta e círculo inteiro quando a == b', () => {
  assert.ok(Math.abs(varreduraArco(P(0, 0), P(1, 0), P(0, 1)) - Math.PI / 2) < 1e-12);
  assert.ok(Math.abs(varreduraArco(P(0, 0), P(1, 0), P(1, 0)) - 2 * Math.PI) < 1e-12);
});

test('discretizaArco: inclui extremos e flecha <= tolCorda', () => {
  const c = P(0, 0), r = 50;
  const a = P(r, 0), b = P(0, r);
  const pts = discretizaArco(c, a, b);
  near(pts[0], a);
  near(pts[pts.length - 1], b);
  assert.ok(pts.length > 2);
  flechaOk(c, r, pts, 0.05);
});

test('discretizaCirculo: >= 12 pontos, sem repetir o primeiro, flecha <= tolCorda', () => {
  const c = P(0, 0), r = 50;
  const pts = discretizaCirculo(c, r);
  assert.ok(pts.length >= 12);
  assert.ok(dist(pts[0], pts[pts.length - 1]) > 1e-6);
  flechaOk(c, r, [...pts, pts[0]], 0.05);
});

test('areaAssinada: anti-horário positivo, horário negativo', () => {
  const quad = [P(0, 0), P(10, 0), P(10, 10), P(0, 10)];
  assert.equal(areaAssinada(quad), 100);
  assert.equal(areaAssinada([...quad].reverse()), -100);
});

test('pontoNoPoligono: dentro e fora de um quadrado', () => {
  const quad = [P(0, 0), P(10, 0), P(10, 10), P(0, 10)];
  assert.equal(pontoNoPoligono(P(5, 5), quad), true);
  assert.equal(pontoNoPoligono(P(15, 5), quad), false);
});
