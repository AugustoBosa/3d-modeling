import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ancoraCota, cotasTemporarias, dimInteligente } from '../src/sketch/cotas.ts';
import type { EntSk, RestSk, SketchFeature } from '../src/sketch/tipos.ts';

const sk = (entidades: EntSk[], restricoes: RestSk[] = []): SketchFeature => ({ id: 'sk1', tipo: 'sketch', plano: { base: 'XY', offset: 0 }, entidades, restricoes });
const P = (id: string, x: number, y: number): EntSk => ({ id, tipo: 'ponto', x, y });
const L = (id: string, a: string, b: string): EntSk => ({ id, tipo: 'linha', a, b });

test('DIM: 1 linha -> distancia com o comprimento', () => {
  const s = sk([P('a', 0, 0), P('b', 80, 0), L('l1', 'a', 'b')]);
  assert.deepEqual(dimInteligente(s, ['l1']), { tipo: 'distancia', e: ['l1'], expr: '80' });
});

test('DIM: linha quase horizontal (< 0,5 grau) continua distancia', () => {
  const s = sk([P('a', 0, 0), P('b', 80, 0.5), L('l1', 'a', 'b')]);
  assert.deepEqual(dimInteligente(s, ['l1']), { tipo: 'distancia', e: ['l1'], expr: '80.0016' });
});

test('DIM: 2 pontos -> distancia, modo H e V', () => {
  const s = sk([P('a', 0, 0), P('b', 30, 40)]);
  assert.deepEqual(dimInteligente(s, ['a', 'b']), { tipo: 'distancia', e: ['a', 'b'], expr: '50' });
  assert.deepEqual(dimInteligente(s, ['a', 'b'], 'H'), { tipo: 'distanciaH', e: ['a', 'b'], expr: '30' });
  assert.deepEqual(dimInteligente(s, ['a', 'b'], 'V'), { tipo: 'distanciaV', e: ['a', 'b'], expr: '40' });
});

test('DIM: valor com decimal sai sem zeros à toa', () => {
  const s = sk([P('a', 0, 0), P('b', 12.5, 0)]);
  assert.equal(dimInteligente(s, ['a', 'b'], 'H')?.expr, '12.5');
});

test('DIM: círculo -> diametro; modo R -> raio; arco -> raio', () => {
  const s = sk([P('c', 0, 0), { id: 'k', tipo: 'circulo', c: 'c', r: 10 }, P('a', 10, 0), P('b', 0, 10), { id: 'arc', tipo: 'arco', c: 'c', a: 'a', b: 'b' }]);
  assert.deepEqual(dimInteligente(s, ['k']), { tipo: 'diametro', e: ['k'], expr: '20' });
  assert.deepEqual(dimInteligente(s, ['k'], 'R'), { tipo: 'raio', e: ['k'], expr: '10' });
  assert.deepEqual(dimInteligente(s, ['arc']), { tipo: 'raio', e: ['arc'], expr: '10' });
});

test('DIM: 2 linhas não paralelas -> angulo em graus; paralelas -> null', () => {
  const s = sk([P('a', 0, 0), P('b', 10, 0), P('c', 0, 10), P('d', 0, 5), P('e', 10, 5), L('l1', 'a', 'b'), L('l2', 'a', 'c'), L('l3', 'd', 'e')]);
  assert.deepEqual(dimInteligente(s, ['l1', 'l2']), { tipo: 'angulo', e: ['l1', 'l2'], expr: '90' });
  assert.equal(dimInteligente(s, ['l1', 'l3']), null);
});

test('DIM: casos sem cota -> null (ponto+linha, dois círculos, 0 ou 3 ids)', () => {
  const s = sk([P('a', 0, 0), P('b', 10, 0), L('l1', 'a', 'b'), { id: 'k1', tipo: 'circulo', c: 'a', r: 1 }, { id: 'k2', tipo: 'circulo', c: 'b', r: 1 }]);
  assert.equal(dimInteligente(s, ['a', 'l1']), null);
  assert.equal(dimInteligente(s, ['k1', 'k2']), null);
  assert.equal(dimInteligente(s, []), null);
  assert.equal(dimInteligente(s, ['a', 'b', 'l1']), null);
});

test('DIM: cota igual já existente -> devolve duplicada, sem criar outra', () => {
  const s = sk([P('a', 0, 0), P('b', 80, 0), L('l1', 'a', 'b')], [{ id: 'r1', tipo: 'distancia', e: ['l1'], expr: '80' }]);
  assert.deepEqual(dimInteligente(s, ['l1']), { tipo: 'distancia', e: ['l1'], expr: '80', duplicada: true, existenteId: 'r1' });
});

test('DIM: cota de referência também conta como duplicada', () => {
  const s = sk([P('a', 0, 0), P('b', 80, 0), L('l1', 'a', 'b')], [{ id: 'r1', tipo: 'distancia', e: ['l1'], expr: '80', ref: true }]);
  assert.deepEqual(dimInteligente(s, ['l1']), { tipo: 'distancia', e: ['l1'], expr: '80', ref: true, duplicada: true, existenteId: 'r1' });
});

test('cotasTemporarias: ponto -> H e V até o ponto mais próximo em cada sentido (inclui origem)', () => {
  const s = sk([P('pA', 20, 0), P('pB', 0, 10), P('pP', 50, 30)]);
  assert.deepEqual(cotasTemporarias(s, 'pP'), [
    { de: { x: 20, y: 0 }, para: { x: 50, y: 30 }, valor: 30, tipo: 'distanciaH', e: ['pA', 'pP'] },
    { de: { x: 0, y: 10 }, para: { x: 50, y: 30 }, valor: 20, tipo: 'distanciaV', e: ['pB', 'pP'] },
  ]);
});

test('cotasTemporarias: referência na origem não vira cota permanente (e só com o próprio id)', () => {
  const s = sk([P('pP', 7, 3)]);
  assert.deepEqual(cotasTemporarias(s, 'pP').map((c) => [c.tipo, c.valor, c.e]), [['distanciaH', 7, ['pP']], ['distanciaV', 3, ['pP']]]);
});

test('cotasTemporarias: linha -> comprimento; círculo -> nenhuma', () => {
  const s = sk([P('a', 0, 0), P('b', 80, 0), L('l1', 'a', 'b'), P('c', 0, 0), { id: 'k', tipo: 'circulo', c: 'c', r: 5 }]);
  assert.deepEqual(cotasTemporarias(s, 'l1'), [{ de: { x: 0, y: 0 }, para: { x: 80, y: 0 }, valor: 80, tipo: 'distancia', e: ['l1'] }]);
  assert.deepEqual(cotasTemporarias(s, 'k'), []);
});

test('ancoraCota: textos (número, referência entre parênteses, Ø, R, graus)', () => {
  const s = sk([
    P('a', 0, 0), P('b', 30, 40), P('f', 0, 0), P('g', 12.5, 0), P('ca', 100, 0),
    { id: 'k', tipo: 'circulo', c: 'ca', r: 5 }, { id: 'k2', tipo: 'circulo', c: 'ca', r: 10 },
    P('l1a', 0, 50), P('l1b', 10, 50), L('l1', 'l1a', 'l1b'), P('l2a', 0, 50), P('l2b', 0, 60), L('l2', 'l2a', 'l2b'),
  ], [
    { id: 'r1', tipo: 'distancia', e: ['a', 'b'], expr: '50' },
    { id: 'r2', tipo: 'distanciaH', e: ['a', 'b'], expr: '30' },
    { id: 'r3', tipo: 'distancia', e: ['a', 'b'], expr: '50', ref: true },
    { id: 'r4', tipo: 'diametro', e: ['k2'], expr: '20' },
    { id: 'r5', tipo: 'raio', e: ['k'], expr: '5' },
    { id: 'r6', tipo: 'angulo', e: ['l1', 'l2'], expr: '90' },
    { id: 'r7', tipo: 'distanciaH', e: ['f', 'g'], expr: '12.5' },
    { id: 'r8', tipo: 'distancia', e: ['zz'], expr: '1' },
    { id: 'r9', tipo: 'horizontal', e: ['a'] },
  ]);
  const r = (id: string): RestSk => {
    const x = s.restricoes.find((y) => y.id === id);
    assert.ok(x);
    return x;
  };
  assert.equal(ancoraCota(s, r('r1'))?.texto, '50');
  assert.equal(ancoraCota(s, r('r3'))?.texto, '(50)');
  assert.equal(ancoraCota(s, r('r4'))?.texto, 'Ø20');
  assert.equal(ancoraCota(s, r('r5'))?.texto, 'R5');
  assert.equal(ancoraCota(s, r('r6'))?.texto, '90°');
  assert.equal(ancoraCota(s, r('r7'))?.texto, '12.5');
  assert.equal(ancoraCota(s, r('r8')), null);
  assert.equal(ancoraCota(s, r('r9')), null);
});

test('ancoraCota: posição do rótulo fica afastada do segmento', () => {
  const s = sk([P('a', 0, 0), P('b', 30, 40)], [{ id: 'r1', tipo: 'distancia', e: ['a', 'b'], expr: '50' }]);
  const p = ancoraCota(s, s.restricoes[0])?.p;
  assert.ok(p);
  // meio (15,20) deslocado 4 mm para o lado da normal
  assert.ok(Math.abs(p.x - 11.8) < 1e-9 && Math.abs(p.y - 22.4) < 1e-9, JSON.stringify(p));
});
