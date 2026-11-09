import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSketch, normalizaExpr, mede } from '../src/sketch/ponte.ts';
import type { EntSk, RestSk, SketchFeature } from '../src/sketch/tipos.ts';

const sk = (entidades: EntSk[], restricoes: RestSk[]): SketchFeature => ({
  id: 'sk1', tipo: 'sketch', plano: { base: 'XY', offset: 0 }, entidades, restricoes,
});
const pt = (id: string, x: number, y: number): EntSk => ({ id, tipo: 'ponto', x, y });
const ln = (id: string, a: string, b: string): EntSk => ({ id, tipo: 'linha', a, b });
const rs = (id: string, tipo: RestSk['tipo'], e: string[], extra: Partial<RestSk> = {}): RestSk => ({ id, tipo, e, ...extra });
const P = (s: SketchFeature, id: string) => s.entidades.find((x) => x.id === id) as Extract<EntSk, { tipo: 'ponto' }>;
const R = (s: SketchFeature, id: string) => s.entidades.find((x) => x.id === id) as Extract<EntSk, { tipo: 'circulo' }>;
const perto = (a: number, b: number, t = 1e-6) => assert.ok(Math.abs(a - b) < t, `${a} != ${b}`);
const dist = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.hypot(p.x - q.x, p.y - q.y);

// retângulo 80x50 desenhado "no olho" (ruído de ±2 mm), canto p1 fixo em (0,0)
function recNoOlho(extra: RestSk[] = [], params: Record<string, { expr: string }> = {}) {
  const s = sk(
    [pt('p1', 0, 0), pt('p2', 78.5, 1.2), pt('p3', 81.6, 48.1), pt('p4', -1.5, 51.8),
      ln('l1', 'p1', 'p2'), ln('l2', 'p2', 'p3'), ln('l3', 'p3', 'p4'), ln('l4', 'p4', 'p1')],
    [rs('h1', 'horizontal', ['l1']), rs('v1', 'vertical', ['l2']), rs('h2', 'horizontal', ['l3']), rs('v2', 'vertical', ['l4']),
      rs('f', 'fixa', ['p1'], { xy: [0, 0] }), ...extra],
  );
  return { s, params };
}

test('01 retângulo 80x50 com cotas: definido, pontos em (80,50)', () => {
  const { s, params } = recNoOlho([rs('d1', 'distancia', ['l1'], { expr: '80' }), rs('d2', 'distancia', ['l2'], { expr: '50' })]);
  const info = resolveSketch(s, params);
  assert.equal(info.estado, 'definido'); assert.equal(info.dof, 0); assert.deepEqual(info.erros, []);
  perto(P(s, 'p2').x, 80); perto(P(s, 'p2').y, 0);
  perto(P(s, 'p3').x, 80); perto(P(s, 'p3').y, 50);
  perto(P(s, 'p4').x, 0); perto(P(s, 'p4').y, 50);
});

test('02 só uma cota: subdefinido, dof 1', () => {
  const { s, params } = recNoOlho([rs('d1', 'distancia', ['l1'], { expr: '80' })]);
  const info = resolveSketch(s, params);
  assert.equal(info.estado, 'subdefinido'); assert.equal(info.dof, 1);
  perto(dist(P(s, 'p1'), P(s, 'p2')), 80);
});

test('03 cota "=L" com parâmetro L: resolve e reage a mudança do parâmetro', () => {
  assert.equal(normalizaExpr('=L'), 'L');
  assert.equal(normalizaExpr('  = L  '), 'L');
  const { s } = recNoOlho([rs('d1', 'distancia', ['l1'], { expr: '=L' }), rs('d2', 'distancia', ['l2'], { expr: '50' })]);
  resolveSketch(s, { L: { expr: '80' } });
  perto(P(s, 'p2').x, 80);
  resolveSketch(s, { L: { expr: '100' } });
  perto(P(s, 'p2').x, 100); perto(P(s, 'p3').x, 100);
});

test('04 cota "L/2+parede" com parâmetros encadeados', () => {
  const s = sk([pt('a', 0, 0), pt('b', 55, 1), ln('l', 'a', 'b')],
    [rs('f', 'fixa', ['a'], { xy: [0, 0] }), rs('h', 'horizontal', ['l']), rs('d', 'distancia', ['l'], { expr: 'L/2+parede' })]);
  const info = resolveSketch(s, { L: { expr: '80' }, parede: { expr: 'L/4' } });
  assert.equal(info.estado, 'definido');
  perto(dist(P(s, 'a'), P(s, 'b')), 60);
});

test('05 conflito: duas cotas diferentes na mesma linha', () => {
  const s = sk([pt('a', 0, 0), pt('b', 70, 0.5), ln('l', 'a', 'b')],
    [rs('f', 'fixa', ['a'], { xy: [0, 0] }), rs('h', 'horizontal', ['l']),
      rs('d1', 'distancia', ['l'], { expr: '80' }), rs('d2', 'distancia', ['l'], { expr: '60' })]);
  const info = resolveSketch(s, {});
  assert.equal(info.estado, 'conflito');
  assert.ok(info.culpadas.length > 0);
  for (const id of info.culpadas) assert.ok(['h', 'f', 'd1', 'd2'].includes(id), id);
  assert.ok(info.culpadas.includes('d1') || info.culpadas.includes('d2'));
});

test('06 expr inválida: erro com o id e o resto resolve', () => {
  const s = sk([pt('a', 0, 0), pt('b', 40, 1), pt('c', 1, 25), ln('l1', 'a', 'b'), ln('l2', 'a', 'c')],
    [rs('f', 'fixa', ['a'], { xy: [0, 0] }), rs('h', 'horizontal', ['l1']), rs('v', 'vertical', ['l2']),
      rs('bad', 'distancia', ['l1'], { expr: 'foo+' }), rs('ok', 'distancia', ['l2'], { expr: '30' })]);
  const info = resolveSketch(s, {});
  assert.equal(info.erros.length, 1); assert.equal(info.erros[0].restricao, 'bad');
  assert.ok(info.erros[0].mensagem.length > 0);
  perto(dist(P(s, 'a'), P(s, 'c')), 30);
});

test('07 cota de referência (ref: true) não dirige o sketch', () => {
  const { s, params } = recNoOlho([rs('d1', 'distancia', ['l1'], { expr: '80' }),
    rs('r1', 'distancia', ['l1'], { expr: '999', ref: true })]);
  const info = resolveSketch(s, params);
  assert.equal(info.estado, 'subdefinido'); assert.deepEqual(info.erros, []);
  perto(dist(P(s, 'p1'), P(s, 'p2')), 80);
});

test('08 círculo com diâmetro 20 -> r = 10; arco com raio 5', () => {
  const s = sk([pt('c', 1, 1), { id: 'k', tipo: 'circulo', c: 'c', r: 3 }],
    [rs('f', 'fixa', ['c'], { xy: [5, 5] }), rs('d', 'diametro', ['k'], { expr: '20' })]);
  assert.equal(resolveSketch(s, {}).estado, 'definido');
  perto(R(s, 'k').r, 10);

  const a = sk([pt('c', 0, 0), pt('a', 3, 4.2), pt('b', -4.1, 3), { id: 'arc', tipo: 'arco', c: 'c', a: 'a', b: 'b' }],
    [rs('f', 'fixa', ['c'], { xy: [0, 0] }), rs('r', 'raio', ['arc'], { expr: '5' })]);
  const info = resolveSketch(a, {});
  assert.equal(info.estado, 'subdefinido'); assert.equal(info.erros.length, 0);
  perto(dist(P(a, 'c'), P(a, 'a')), 5); perto(dist(P(a, 'c'), P(a, 'b')), 5);
});

test('09 mede: distância de linha, distanciaH e ângulo entre linhas', () => {
  const s = sk([pt('a', 0, 0), pt('b', 30, 40), pt('c', 10, 0), pt('d', 10 * Math.cos(Math.PI / 6), 5), ln('l0', 'a', 'b'), ln('l1', 'a', 'c'), ln('l2', 'a', 'd')], []);
  perto(mede(s, { tipo: 'distancia', e: ['l0'] })!, 50);
  perto(mede(s, { tipo: 'distanciaH', e: ['l0'] })!, 30);
  perto(mede(s, { tipo: 'distanciaV', e: ['l0'] })!, 40);
  perto(mede(s, { tipo: 'angulo', e: ['l1', 'l2'] })!, 30);
  perto(mede(s, { tipo: 'angulo', e: ['l2', 'l1'] })!, -30);
  assert.equal(mede(s, { tipo: 'raio', e: ['l0'] }), null);
});

// ---------- desempenho: grade 9x8 (72 pontos, 127 linhas = 199 entidades) ----------
function grade(seed: number) {
  const ents: EntSk[] = []; const rests: RestSk[] = [];
  let s = seed; const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff - 0.5) * 2; // ±1 mm
  const cols = 9, rows = 8;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) ents.push(pt(`p${i}_${j}`, i * 10 + rnd(), j * 10 + rnd()));
  rests.push(rs('f', 'fixa', ['p0_0'], { xy: [0, 0] }));
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    if (i + 1 < cols) {
      ents.push(ln(`h${i}_${j}`, `p${i}_${j}`, `p${i + 1}_${j}`));
      rests.push(rs(`hh${i}_${j}`, 'horizontal', [`h${i}_${j}`]), rs(`dh${i}_${j}`, 'distancia', [`h${i}_${j}`], { expr: '10' }));
    }
    if (j + 1 < rows) {
      ents.push(ln(`v${i}_${j}`, `p${i}_${j}`, `p${i}_${j + 1}`));
      rests.push(rs(`vv${i}_${j}`, 'vertical', [`v${i}_${j}`]), rs(`dv${i}_${j}`, 'distancia', [`v${i}_${j}`], { expr: '10' }));
    }
  }
  return sk(ents, rests);
}

// Melhor de 15: solver lento passa de 16 ms até no melhor caso; CPU disputada (testes em paralelo) só infla a mediana.
test('10 desempenho: 199 entidades, melhor de 15 execuções <= 16 ms', () => {
  const tempos: number[] = [];
  let n = 0;
  for (let k = 0; k < 15; k++) {
    const s = grade(12345 + k);
    n = s.entidades.length;
    const t = performance.now();
    const info = resolveSketch(s, {});
    tempos.push(performance.now() - t);
    assert.notEqual(info.estado, 'conflito');
    assert.ok(Math.abs(P(s, 'p8_7').x - 80) < 1e-3 && Math.abs(P(s, 'p8_7').y - 70) < 1e-3, 'grade não convergiu');
  }
  tempos.sort((a, b) => a - b);
  const mediana = tempos[7];
  console.log(`sketch: ${n} entidades, melhor ${tempos[0].toFixed(2)} ms, mediana ${mediana.toFixed(2)} ms (15 execuções)`);
  assert.equal(n, 199);
  assert.ok(tempos[0] <= 16, `melhor ${tempos[0].toFixed(2)} ms`);
});
