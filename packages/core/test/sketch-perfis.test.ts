import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectaPerfis } from '../src/sketch/perfis.ts';
import { areaAssinada } from '../src/sketch/geometria.ts';
import type { EntSk, RestSk, SketchFeature } from '../src/sketch/tipos.ts';

const sk = (entidades: EntSk[], restricoes: RestSk[] = []): SketchFeature =>
  ({ id: 'sk1', tipo: 'sketch', plano: { base: 'XY', offset: 0 }, entidades, restricoes });
const pt = (id: string, x: number, y: number): EntSk => ({ id, tipo: 'ponto', x, y });
const ln = (id: string, a: string, b: string, construcao = false): EntSk => ({ id, tipo: 'linha', a, b, construcao });
const ci = (id: string, c: string, r: number): EntSk => ({ id, tipo: 'circulo', c, r });
const ar = (id: string, c: string, a: string, b: string): EntSk => ({ id, tipo: 'arco', c, a, b });

// retângulo w x h com pontos p0..p3 (anti-horário) e linhas l0..l3, prefixo `k`
function retangulo(k: string, x0: number, y0: number, w: number, h: number): EntSk[] {
  return [
    pt(`${k}p0`, x0, y0), pt(`${k}p1`, x0 + w, y0), pt(`${k}p2`, x0 + w, y0 + h), pt(`${k}p3`, x0, y0 + h),
    ln(`${k}l0`, `${k}p0`, `${k}p1`), ln(`${k}l1`, `${k}p1`, `${k}p2`),
    ln(`${k}l2`, `${k}p2`, `${k}p3`), ln(`${k}l3`, `${k}p3`, `${k}p0`),
  ];
}

test('retângulo 80x50: 1 perfil de área 4000, anti-horário, sem furo', () => {
  const r = detectaPerfis(sk(retangulo('', 0, 0, 80, 50)));
  assert.equal(r.perfis.length, 1);
  assert.equal(areaAssinada(r.perfis[0].poligono), 4000);
  assert.equal(r.perfis[0].furos.length, 0);
  assert.deepEqual(r.pontasSoltas, []);
  assert.deepEqual(r.autointersecoes, []);
});

test('retângulo com círculo dentro: 1 perfil com 1 furo horário', () => {
  const r = detectaPerfis(sk([...retangulo('', 0, 0, 80, 50), ci('c', 'cc', 10), pt('cc', 40, 25)]));
  assert.equal(r.perfis.length, 1);
  assert.equal(r.perfis[0].furos.length, 1);
  assert.ok(areaAssinada(r.perfis[0].furos[0]) < 0);
  assert.ok(areaAssinada(r.perfis[0].poligono) > 0);
});

test('dois retângulos separados: 2 perfis', () => {
  const r = detectaPerfis(sk([...retangulo('a', 0, 0, 10, 10), ...retangulo('b', 50, 0, 10, 10)]));
  assert.equal(r.perfis.length, 2);
});

test('retângulo + círculo concêntrico + retângulo menor dentro do círculo: 2 perfis (ilha)', () => {
  const r = detectaPerfis(sk([
    ...retangulo('R', 0, 0, 80, 50),
    pt('cc', 40, 25), ci('C', 'cc', 15),
    ...retangulo('I', 35, 20, 10, 10),
  ]));
  assert.equal(r.perfis.length, 2);
  assert.equal(r.perfis.filter(p => p.furos.length === 1).length, 1);
  assert.equal(r.perfis.filter(p => p.furos.length === 0).length, 1);
});

test('círculo sozinho: área ~ pi r^2 (0,2%)', () => {
  const r = detectaPerfis(sk([pt('cc', 0, 0), ci('C', 'cc', 50)]));
  assert.equal(r.perfis.length, 1);
  const area = areaAssinada(r.perfis[0].poligono);
  assert.ok(Math.abs(area / (Math.PI * 2500) - 1) < 0.002, `area ${area}`);
});

test('"D": linha + arco semicircular fechado', () => {
  // linha (0,0)-(0,20) e arco anti-horário de (0,20) até (0,0) com centro (0,10): semicírculo à esquerda
  const r = detectaPerfis(sk([
    pt('p0', 0, 0), pt('p1', 0, 20), pt('c', 0, 10),
    ln('l', 'p0', 'p1'), ar('a', 'c', 'p1', 'p0'),
  ]));
  assert.equal(r.perfis.length, 1);
  assert.ok(Math.abs(areaAssinada(r.perfis[0].poligono) / (Math.PI * 50) - 1) < 0.01);
  assert.deepEqual(r.pontasSoltas, []);
});

test('3 linhas abertas em cadeia: 0 perfis e 2 pontas soltas', () => {
  const r = detectaPerfis(sk([
    pt('p0', 0, 0), pt('p1', 10, 0), pt('p2', 10, 10), pt('p3', 0, 20),
    ln('l0', 'p0', 'p1'), ln('l1', 'p1', 'p2'), ln('l2', 'p2', 'p3'),
  ]));
  assert.equal(r.perfis.length, 0);
  assert.deepEqual([...r.pontasSoltas].sort(), ['p0', 'p3']);
});

test('X de duas linhas dentro de um quadrado: autointersecao reportada', () => {
  const r = detectaPerfis(sk([
    ...retangulo('', 0, 0, 80, 50),
    pt('x1', 20, 10), pt('x2', 60, 40), pt('x3', 20, 40), pt('x4', 60, 10),
    ln('X1', 'x1', 'x2'), ln('X2', 'x3', 'x4'),
  ]));
  assert.deepEqual(r.autointersecoes, [['X1', 'X2']]);
  assert.equal(r.perfis.length, 1);
});

test('linha de construção é ignorada (diagonal não quebra o perfil)', () => {
  const r = detectaPerfis(sk([
    ...retangulo('', 0, 0, 80, 50),
    ln('diag', 'p0', 'p2', true),
  ]));
  assert.equal(r.perfis.length, 1);
  assert.equal(areaAssinada(r.perfis[0].poligono), 4000);
  assert.deepEqual(r.autointersecoes, []);
});

test('pontos unidos só por restrição coincidente fecham o laço', () => {
  // q0 fica a 0,5 µm de p0: não funde por distância; só a restrição 'coincidente' funde
  const ents = [
    ...retangulo('', 0, 0, 80, 50),
    pt('q0', 0.0005, 0),
  ];
  // troca a extremidade p0 de l3 (b) por q0
  const sem = ents.map(e => e.id === 'l3' ? { ...e, b: 'q0' } : e) as EntSk[];
  const aberto = detectaPerfis(sk(sem));
  assert.equal(aberto.perfis.length, 0);
  const fechado = detectaPerfis(sk(sem, [{ id: 'r1', tipo: 'coincidente', e: ['p0', 'q0'] }]));
  assert.equal(fechado.perfis.length, 1);
  assert.deepEqual(fechado.pontasSoltas, []);
});

test('4 linhas do quadrado em ordem embaralhada: 1 perfil de área 4000', () => {
  const [p0, p1, p2, p3, l0, l1, l2, l3] = retangulo('', 0, 0, 80, 50);
  const r = detectaPerfis(sk([l2, p3, l0, p1, l3, p0, l1, p2]));
  assert.equal(r.perfis.length, 1);
  assert.equal(areaAssinada(r.perfis[0].poligono), 4000);
});

test('sketch vazio: tudo vazio', () => {
  assert.deepEqual(detectaPerfis(sk([])), { perfis: [], pontasSoltas: [], autointersecoes: [] });
});
