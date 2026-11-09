import { test } from 'node:test';
import assert from 'node:assert/strict';
import { infere } from '../src/sketch/inferencia.ts';
import type { Adicao, EntSk, RestSk, SketchFeature } from '../src/sketch/tipos.ts';

const sk = (...entidades: EntSk[]): SketchFeature => ({ id: 'sk1', tipo: 'sketch', plano: { base: 'XY', offset: 0 }, entidades, restricoes: [] });
const pt = (id: string, x: number, y: number): EntSk => ({ id, tipo: 'ponto', x, y });
const linha = (id: string, a: string, b: string): EntSk => ({ id, tipo: 'linha', a, b });
const arco = (id: string, c: string, a: string, b: string): EntSk => ({ id, tipo: 'arco', c, a, b });
const ad = (entidades: EntSk[], restricoes: RestSk[] = []): Adicao => ({ entidades, restricoes });
const grau = (g: number) => (g * Math.PI) / 180;
const tipos = (r: RestSk[]) => r.map(x => x.tipo);
const ache = (r: RestSk[], tipo: string) => r.find(x => x.tipo === tipo);

test('linha quase horizontal (1 grau) ganha horizontal; 5 graus não', () => {
  const um = ad([pt('@1', 0, 0), pt('@2', 10, 10 * Math.tan(grau(1))), linha('@l1', '@1', '@2')]);
  const r = infere(sk(), um);
  assert.deepEqual(tipos(r), ['horizontal']);
  assert.deepEqual(r[0].e, ['@l1']);
  assert.equal(r[0].id, '@r1');
  const cinco = ad([pt('@1', 0, 0), pt('@2', 10, 10 * Math.tan(grau(5))), linha('@l1', '@1', '@2')]);
  assert.deepEqual(infere(sk(), cinco), []);
});

test('linha quase vertical ganha vertical; tolGraus muda a tolerância', () => {
  const v = ad([pt('@1', 0, 0), pt('@2', 0.1, 10), linha('@l1', '@1', '@2')]);
  assert.deepEqual(tipos(infere(sk(), v)), ['vertical']);
  const cinco = ad([pt('@1', 0, 0), pt('@2', 10 * Math.tan(grau(5)), 10), linha('@l1', '@1', '@2')]);
  assert.deepEqual(infere(sk(), cinco), []);
  assert.deepEqual(tipos(infere(sk(), cinco, { tolGraus: 6 })), ['vertical']);
});

test('coincidente: ponto novo na mesma posição de ponto existente, sem reutilizar o id', () => {
  const s = sk(pt('p1', 0, 0));
  const r = infere(s, ad([pt('@1', 0, 0), pt('@2', 10, 10), linha('@l1', '@1', '@2')]));
  assert.deepEqual(ache(r, 'coincidente')?.e, ['@1', 'p1']);
});

test('pontoNaCurva: ponto novo sobre linha existente', () => {
  const s = sk(pt('p1', 0, 0), pt('p2', 10, 0), linha('l1', 'p1', 'p2'));
  const r = infere(s, ad([pt('@1', 5, 0)]));
  assert.deepEqual(r, [{ id: '@r1', tipo: 'pontoNaCurva', e: ['@1', 'l1'] }]);
});

test('tangente: arco novo termina no extremo de linha existente na mesma direção', () => {
  // linha (0,0)-(10,0); arco centro (0,5) raio 5 de (0,0) a (5,5): tangente em (0,0)
  const s = sk(pt('p1', 0, 0), pt('p2', 10, 0), linha('l1', 'p1', 'p2'));
  const r = infere(s, ad([pt('@c', 0, 5), pt('@2', 5, 5), arco('@a', '@c', 'p1', '@2')]));
  const t = ache(r, 'tangente');
  assert.ok(t);
  assert.deepEqual([...t.e].sort(), ['@a', 'l1']);
});

test('suprimir (Shift) devolve []', () => {
  const r = ad([pt('@1', 0, 0), pt('@2', 10, 0), linha('@l1', '@1', '@2')]);
  assert.deepEqual(infere(sk(), r, { suprimir: true }), []);
});

test('não duplica horizontal que a adição já traz (ex.: REC)', () => {
  const a = ad([pt('@1', 0, 0), pt('@2', 10, 0), linha('@l1', '@1', '@2')], [{ id: '@r0', tipo: 'horizontal', e: ['@l1'] }]);
  assert.deepEqual(infere(sk(), a), []);
});
