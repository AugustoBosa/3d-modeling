import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aparar, estender, offset, fillet, chanfro } from '../src/sketch/edicao2.ts';
import { varreduraArco } from '../src/sketch/geometria.ts';
import type { EntSk, SketchFeature } from '../src/sketch/tipos.ts';

function sk(entidades: EntSk[]): SketchFeature {
  return { id: 'sk1', tipo: 'sketch', plano: { base: 'XY', offset: 0 }, entidades, restricoes: [] };
}
type Ponto = Extract<EntSk, { tipo: 'ponto' }>;
type Linha = Extract<EntSk, { tipo: 'linha' }>;
const ponto = (s: SketchFeature, id: string) => s.entidades.find((e) => e.id === id) as Ponto;
const linha = (s: SketchFeature, id: string) => s.entidades.find((e) => e.id === id) as Linha;
const perto = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const pontoEm = (s: SketchFeature, id: string, x: number, y: number) => {
  perto(ponto(s, id).x, x);
  perto(ponto(s, id).y, y);
};
const pontos = (xs: [string, number, number][]): EntSk[] => xs.map(([id, x, y]) => ({ id, tipo: 'ponto', x, y }));

test('aparar: clicar no pedaço esquerdo do T deixa o direito', () => {
  const s = sk([
    ...pontos([['p1', 0, 0], ['p2', 10, 0], ['p3', 5, -5], ['p4', 5, 5]]),
    { id: 'l1', tipo: 'linha', a: 'p1', b: 'p2' },
    { id: 'l2', tipo: 'linha', a: 'p3', b: 'p4' },
  ]);
  aparar(s, 'l1', { x: 2, y: 0 });
  assert.equal(linha(s, 'l1').b, 'p2');
  pontoEm(s, linha(s, 'l1').a, 5, 0);
  assert.equal(s.entidades.filter((e) => e.tipo === 'linha').length, 2);
});

test('aparar: clicar entre duas verticais divide a linha em duas', () => {
  const s = sk([
    ...pontos([['p1', 0, 0], ['p2', 10, 0], ['p3', 3, -5], ['p4', 3, 5], ['p5', 7, -5], ['p6', 7, 5]]),
    { id: 'l1', tipo: 'linha', a: 'p1', b: 'p2' },
    { id: 'l2', tipo: 'linha', a: 'p3', b: 'p4' },
    { id: 'l3', tipo: 'linha', a: 'p5', b: 'p6' },
  ]);
  aparar(s, 'l1', { x: 5, y: 0 });
  pontoEm(s, linha(s, 'l1').b, 3, 0);
  const nova = s.entidades.find((e) => e.tipo === 'linha' && !['l1', 'l2', 'l3'].includes(e.id)) as Linha;
  pontoEm(s, nova.a, 7, 0);
  assert.equal(nova.b, 'p2');
});

test('aparar: sem interseção apaga a entidade inteira', () => {
  const s = sk([...pontos([['p1', 0, 0], ['p2', 10, 0]]), { id: 'l1', tipo: 'linha', a: 'p1', b: 'p2' }]);
  aparar(s, 'l1', { x: 5, y: 0 });
  assert.equal(s.entidades.some((e) => e.id === 'l1'), false);
});

test('aparar: círculo cortado por duas linhas vira arco sem o trecho clicado', () => {
  const s = sk([
    ...pontos([['p0', 0, 0], ['p1', -10, 0], ['p2', 10, 0], ['p3', 0, -10], ['p4', 0, 10]]),
    { id: 'c1', tipo: 'circulo', c: 'p0', r: 5 },
    { id: 'l1', tipo: 'linha', a: 'p1', b: 'p2' },
    { id: 'l2', tipo: 'linha', a: 'p3', b: 'p4' },
  ]);
  aparar(s, 'c1', { x: 3.5355, y: 3.5355 }); // quadrante I: sai o trecho de 90°
  const arc = s.entidades.find((e) => e.id === 'c1') as Extract<EntSk, { tipo: 'arco' }>;
  assert.equal(arc.tipo, 'arco');
  pontoEm(s, arc.a, 0, 5);
  pontoEm(s, arc.b, 5, 0);
  perto(varreduraArco({ x: 0, y: 0 }, ponto(s, arc.a), ponto(s, arc.b)), (3 * Math.PI) / 2);
});

test('estender: prolonga a ponta até a parede', () => {
  const s = sk([
    ...pontos([['p1', 0, 0], ['p2', 5, 0], ['p3', 10, -5], ['p4', 10, 5]]),
    { id: 'l1', tipo: 'linha', a: 'p1', b: 'p2' },
    { id: 'l2', tipo: 'linha', a: 'p3', b: 'p4' },
  ]);
  estender(s, 'l1', { x: 6, y: 0 });
  pontoEm(s, 'p2', 10, 0);
});

test('estender: sem limite lança erro', () => {
  const s = sk([...pontos([['p1', 0, 0], ['p2', 5, 0]]), { id: 'l1', tipo: 'linha', a: 'p1', b: 'p2' }]);
  assert.throws(() => estender(s, 'l1', { x: 6, y: 0 }), /Nada à frente/);
});

test('offset de linha: lado esquerdo e direito na distância pedida', () => {
  const s = sk([...pontos([['p1', 0, 0], ['p2', 10, 0]]), { id: 'l1', tipo: 'linha', a: 'p1', b: 'p2' }]);
  const [esq] = offset(s, 'l1', 2, { x: 5, y: 3 });
  const le = linha(s, esq);
  pontoEm(s, le.a, 0, 2);
  pontoEm(s, le.b, 10, 2);
  const [dir] = offset(s, 'l1', 2, { x: 5, y: -3 });
  const ld = linha(s, dir);
  pontoEm(s, ld.a, 0, -2);
  pontoEm(s, ld.b, 10, -2);
});

test('offset de círculo: para fora e para dentro', () => {
  const s = sk([...pontos([['p0', 0, 0]]), { id: 'c1', tipo: 'circulo', c: 'p0', r: 5 }]);
  const [fora] = offset(s, 'c1', 2, { x: 10, y: 0 });
  assert.equal((s.entidades.find((e) => e.id === fora) as Extract<EntSk, { tipo: 'circulo' }>).r, 7);
  const [dentro] = offset(s, 'c1', 2, { x: 1, y: 0 });
  assert.equal((s.entidades.find((e) => e.id === dentro) as Extract<EntSk, { tipo: 'circulo' }>).r, 3);
  assert.throws(() => offset(s, 'c1', 5, { x: 1, y: 0 }), /não cabe/);
});

// L de 90°: vértice p1 = (0,0), l1 vai até (10,0), l2 vai até (0,10)
const L = () =>
  sk([
    ...pontos([['p1', 0, 0], ['p2', 10, 0], ['p3', 0, 10]]),
    { id: 'l1', tipo: 'linha', a: 'p2', b: 'p1' },
    { id: 'l2', tipo: 'linha', a: 'p1', b: 'p3' },
  ]);

test('fillet: L de 90° com r=5 cria arco com centro (5,5), extremos a 5 mm e varredura de 90°', () => {
  const s = L();
  const arcoId = fillet(s, 'l1', 'l2', 5);
  const arc = s.entidades.find((e) => e.id === arcoId) as Extract<EntSk, { tipo: 'arco' }>;
  assert.equal(arc.tipo, 'arco');
  pontoEm(s, arc.c, 5, 5);
  pontoEm(s, arc.a, 0, 5); // anti-horário de a até b
  pontoEm(s, arc.b, 5, 0);
  perto(varreduraArco(ponto(s, arc.c), ponto(s, arc.a), ponto(s, arc.b)), Math.PI / 2);
  assert.equal(arc.b, linha(s, 'l1').b);
  assert.equal(arc.a, linha(s, 'l2').a);
  assert.equal(s.restricoes.length, 2);
  assert.ok(s.restricoes.every((r) => r.tipo === 'tangente' && r.e.includes(arcoId)));
});

test('fillet: raio grande demais lança erro', () => {
  assert.throws(() => fillet(L(), 'l1', 'l2', 20), /grande demais/);
});

test('fillet: r=0 une as linhas no canto', () => {
  const s = L();
  assert.equal(fillet(s, 'l1', 'l2', 0), '');
  assert.equal(linha(s, 'l1').b, 'p1');
  assert.equal(linha(s, 'l2').a, 'p1');
  // linhas que só se encontram no prolongamento: a ponta mais perto vai para o canto
  const e = sk([
    ...pontos([['p1', 0, 0], ['p2', 10, 0], ['p3', 12, -5], ['p4', 12, -1]]),
    { id: 'l1', tipo: 'linha', a: 'p1', b: 'p2' },
    { id: 'l2', tipo: 'linha', a: 'p3', b: 'p4' },
  ]);
  assert.equal(fillet(e, 'l1', 'l2', 0), '');
  pontoEm(e, 'p2', 12, 0);
  assert.equal(linha(e, 'l2').b, 'p2');
});

test('chanfro 3x3 no L: nova linha entre (3,0) e (0,3)', () => {
  const s = L();
  const id = chanfro(s, 'l1', 'l2', 3, 3);
  const nova = linha(s, id);
  pontoEm(s, nova.a, 3, 0);
  pontoEm(s, nova.b, 0, 3);
  pontoEm(s, linha(s, 'l1').b, 3, 0);
  pontoEm(s, 'p1', 0, 3);
});
