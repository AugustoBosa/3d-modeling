import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acha, porRetangulo, todas } from '../src/sketch/selecao.ts';
import type { EntSk, SketchFeature } from '../src/sketch/tipos.ts';

const sk = (entidades: EntSk[]): SketchFeature => ({ id: 'sk1', tipo: 'sketch', plano: { base: 'XY', offset: 0 }, entidades, restricoes: [] });
const P = (id: string, x: number, y: number): EntSk => ({ id, tipo: 'ponto', x, y });
const L = (id: string, a: string, b: string): EntSk => ({ id, tipo: 'linha', a, b });
const C = (id: string, c: string, r: number): EntSk => ({ id, tipo: 'circulo', c, r });
const A = (id: string, c: string, a: string, b: string): EntSk => ({ id, tipo: 'arco', c, a, b });

test('acha: ponto vence linha mesmo quando a linha está mais perto', () => {
  const s = sk([P('p1', 0, 0), P('p2', 10, 0), L('l1', 'p1', 'p2')]);
  assert.equal(acha(s, { x: 0.3, y: 0.1 }, 0.5), 'p1');
});

test('acha: linha pela distância ao segmento, a mais perto ganha, fora da tol não pega', () => {
  const s = sk([P('a', 0, 0), P('b', 10, 0), L('l1', 'a', 'b'), P('e', 0, 3), P('f', 10, 3), L('l2', 'e', 'f')]);
  assert.equal(acha(s, { x: 5, y: 0.8 }, 1), 'l1');
  assert.equal(acha(s, { x: 5, y: 2.5 }, 3), 'l2');
  assert.equal(acha(s, { x: 5, y: 2 }, 0.5), null);
  assert.equal(acha(s, { x: 12, y: 0 }, 0.5), null); // além do extremo do segmento
});

test('acha: ignorar tira ids da busca', () => {
  const s = sk([P('p1', 0, 0), P('p2', 10, 0), L('l1', 'p1', 'p2')]);
  assert.equal(acha(s, { x: 0, y: 0.1 }, 0.5, ['p1']), 'l1');
});

test('acha: círculo pela curva, não pelo interior', () => {
  const s = sk([P('pc', 0, 0), C('c1', 'pc', 10)]);
  assert.equal(acha(s, { x: 10.3, y: 0 }, 0.5), 'c1');
  assert.equal(acha(s, { x: 0, y: 3 }, 0.5), null);
});

test('acha: arco só no trecho anti-horário de a até b', () => {
  const s = sk([P('pc', 0, 0), P('pa', 10, 0), P('pb', 0, 10), A('arc1', 'pc', 'pa', 'pb')]);
  assert.equal(acha(s, { x: 7.07, y: 7.07 }, 0.5), 'arc1'); // 45 graus, no trecho
  assert.equal(acha(s, { x: -7.07, y: 7.07 }, 0.5), null); // 135 graus, na circunferência mas fora do trecho
  assert.equal(acha(s, { x: 7.07, y: 7.07 }, 0.5, ['arc1']), null);
});

test('acha: ponto de extremo do arco vence o arco', () => {
  const s = sk([P('pc', 0, 0), P('pa', 10, 0), P('pb', 0, 10), A('arc1', 'pc', 'pa', 'pb')]);
  assert.equal(acha(s, { x: 10, y: 0.1 }, 0.5), 'pa');
});

// retângulo de seleção (0,0)-(10,10). Entidades: L1 e C1 dentro; L2 e C2 cruzam a borda; L3 e pontos de fora não entram.
const cena = (): SketchFeature => sk([
  P('pA', 2, 2), P('pB', 4, 4), L('L1', 'pA', 'pB'),
  P('pc1', 5, 5), C('C1', 'pc1', 2),
  P('pq', 1, 9),
  P('pm', -5, 5), P('pn', 15, 5), L('L2', 'pm', 'pn'),
  P('pc2', 12, 5), C('C2', 'pc2', 3),
  P('pr', 20, 20), P('ps', 30, 20), L('L3', 'pr', 'ps'),
]);

test('porRetangulo: janela (esquerda->direita) só pega o que está inteiro dentro', () => {
  assert.deepEqual(porRetangulo(cena(), { x: 0, y: 0 }, { x: 10, y: 10 }),
    { ids: ['pA', 'pB', 'L1', 'pc1', 'C1', 'pq'], modo: 'janela' });
});

test('porRetangulo: cruzamento (direita->esquerda) pega tudo que toca', () => {
  assert.deepEqual(porRetangulo(cena(), { x: 10, y: 10 }, { x: 0, y: 0 }),
    { ids: ['pA', 'pB', 'L1', 'pc1', 'C1', 'pq', 'L2', 'C2'], modo: 'cruzamento' });
});

test('porRetangulo: arco com extremo fora some na janela e aparece no cruzamento', () => {
  // arco de centro (9,5) raio 3, de (12,5) a (9,8): cruza a borda x=10
  const s = sk([P('pc3', 9, 5), P('pa3', 12, 5), P('pb3', 9, 8), A('arc', 'pc3', 'pa3', 'pb3')]);
  assert.deepEqual(porRetangulo(s, { x: 0, y: 0 }, { x: 10, y: 10 }), { ids: ['pc3', 'pb3'], modo: 'janela' });
  assert.deepEqual(porRetangulo(s, { x: 10, y: 10 }, { x: 0, y: 0 }), { ids: ['pc3', 'pb3', 'arc'], modo: 'cruzamento' });
});

test('porRetangulo: arco totalmente dentro entra na janela', () => {
  const s = sk([P('pc', 5, 5), P('pa', 6, 5), P('pb', 5, 6), A('arc', 'pc', 'pa', 'pb')]);
  assert.deepEqual(porRetangulo(s, { x: 0, y: 0 }, { x: 10, y: 10 }).ids, ['pc', 'pa', 'pb', 'arc']);
});

test('todas: devolve os ids na ordem das entidades', () => {
  assert.deepEqual(todas(sk([P('p1', 0, 0), P('p2', 10, 0), L('l1', 'p1', 'p2')])), ['p1', 'p2', 'l1']);
});
