import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mover, copiar, girar, escalar, espelhar, arrayRetangular, arrayPolar, apagar, alternaConstrucao } from '../src/sketch/edicao.ts';
import type { EntSk, RestSk, SketchFeature } from '../src/sketch/tipos.ts';

function sk(entidades: EntSk[], restricoes: RestSk[] = []): SketchFeature {
  return { id: 'sk1', tipo: 'sketch', plano: { base: 'XY', offset: 0 }, entidades, restricoes };
}
// retângulo 10x10 com 4 pontos e 4 linhas
const retangulo = () => sk([
  { id: 'p1', tipo: 'ponto', x: 0, y: 0 }, { id: 'p2', tipo: 'ponto', x: 10, y: 0 },
  { id: 'p3', tipo: 'ponto', x: 10, y: 10 }, { id: 'p4', tipo: 'ponto', x: 0, y: 10 },
  { id: 'l1', tipo: 'linha', a: 'p1', b: 'p2' }, { id: 'l2', tipo: 'linha', a: 'p2', b: 'p3' },
  { id: 'l3', tipo: 'linha', a: 'p3', b: 'p4' }, { id: 'l4', tipo: 'linha', a: 'p4', b: 'p1' },
]);
const ponto = (s: SketchFeature, id: string) => s.entidades.find((e) => e.id === id) as Extract<EntSk, { tipo: 'ponto' }>;
const cont = (s: SketchFeature, tipo: EntSk['tipo']) => s.entidades.filter((e) => e.tipo === tipo).length;
const perto = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
// produto vetorial (a-c) x (b-c) de um arco: > 0 significa varredura anti-horária de a até b (<180°)
function cruzArco(s: SketchFeature, arcoId: string) {
  const ar = s.entidades.find((e) => e.id === arcoId) as Extract<EntSk, { tipo: 'arco' }>;
  const c = ponto(s, ar.c), a = ponto(s, ar.a), b = ponto(s, ar.b);
  return (a.x - c.x) * (b.y - c.y) - (a.y - c.y) * (b.x - c.x);
}

test('mover desloca os pontos e mantém a conectividade', () => {
  const s = retangulo();
  mover(s, ['l1'], 5, -2);
  perto(ponto(s, 'p1').x, 5); perto(ponto(s, 'p1').y, -2);
  perto(ponto(s, 'p2').x, 15); perto(ponto(s, 'p2').y, -2);
  perto(ponto(s, 'p3').x, 10); // não selecionado: fica
  assert.deepEqual(s.entidades.find((e) => e.id === 'l1'), { id: 'l1', tipo: 'linha', a: 'p1', b: 'p2' });
});

test('copiar de duas linhas que compartilham ponto cria 3 pontos novos', () => {
  const s = retangulo();
  const novos = copiar(s, ['l1', 'l2'], 0, 30);
  assert.equal(novos.length, 2);
  assert.equal(cont(s, 'ponto'), 4 + 3);
  assert.equal(cont(s, 'linha'), 4 + 2);
  const [n1, n2] = novos.map((id) => s.entidades.find((e) => e.id === id) as Extract<EntSk, { tipo: 'linha' }>);
  assert.equal(n1.b, n2.a, 'as linhas copiadas continuam compartilhando o ponto');
  perto(ponto(s, n1.a).y, 30);
});

test('girar 90 graus de (10,0) em torno da origem resulta em (0,10)', () => {
  const s = sk([{ id: 'p1', tipo: 'ponto', x: 10, y: 0 }]);
  girar(s, ['p1'], { x: 0, y: 0 }, 90);
  perto(ponto(s, 'p1').x, 0); perto(ponto(s, 'p1').y, 10);
});

test('escalar multiplica posições e o raio do círculo', () => {
  const s = sk([{ id: 'p5', tipo: 'ponto', x: 20, y: 20 }, { id: 'c1', tipo: 'circulo', c: 'p5', r: 5 }]);
  escalar(s, ['c1'], { x: 0, y: 0 }, 2);
  perto(ponto(s, 'p5').x, 40); perto(ponto(s, 'p5').y, 40);
  perto((s.entidades[1] as Extract<EntSk, { tipo: 'circulo' }>).r, 10);
  assert.throws(() => escalar(s, ['c1'], { x: 0, y: 0 }, 0), /maior que zero/);
});

test('espelhar arco cria cópia com a/b trocados e varredura anti-horária', () => {
  const s = sk([
    { id: 'p6', tipo: 'ponto', x: 0, y: 0 }, { id: 'p7', tipo: 'ponto', x: 10, y: 0 }, { id: 'p8', tipo: 'ponto', x: 0, y: 10 },
    { id: 'a1', tipo: 'arco', c: 'p6', a: 'p7', b: 'p8' },
  ]);
  const [novo] = espelhar(s, ['a1'], { x: 0, y: 0 }, { x: 0, y: 1 }, true); // eixo Y
  assert.ok(cruzArco(s, 'a1') > 0, 'original continua anti-horário');
  assert.ok(cruzArco(s, novo) > 0, 'cópia espelhada continua anti-horária');
  const ar = s.entidades.find((e) => e.id === novo) as Extract<EntSk, { tipo: 'arco' }>;
  perto(ponto(s, ar.a).y, 10); perto(ponto(s, ar.a).x, 0); // a = cópia de p8 (0,10)
  perto(ponto(s, ar.b).x, -10); perto(ponto(s, ar.b).y, 0); // b = cópia de p7 (-10,0)
});

test('array retangular 3x2 cria 5 cópias', () => {
  const s = sk([{ id: 'p1', tipo: 'ponto', x: 0, y: 0 }, { id: 'p2', tipo: 'ponto', x: 10, y: 0 }, { id: 'l1', tipo: 'linha', a: 'p1', b: 'p2' }]);
  const novos = arrayRetangular(s, ['l1'], 3, 2, 20, 20);
  assert.equal(novos.length, 5);
  assert.equal(cont(s, 'linha'), 6);
  assert.equal(cont(s, 'ponto'), 2 + 10);
});

test('array polar de 4 itens em 360 graus espaça 90', () => {
  const s = sk([{ id: 'p1', tipo: 'ponto', x: 10, y: 0 }]);
  const novos = arrayPolar(s, ['p1'], { x: 0, y: 0 }, 4, 360);
  assert.equal(novos.length, 3);
  const pos = novos.map((id) => ponto(s, id));
  perto(pos[0].x, 0); perto(pos[0].y, 10);
  perto(pos[1].x, -10); perto(pos[1].y, 0);
  perto(pos[2].x, 0); perto(pos[2].y, -10);
});

// origem p0 (fixa por r0) e uma linha que parte dela até p1
const comOrigem = () => sk([
  { id: 'p0', tipo: 'ponto', x: 0, y: 0 }, { id: 'p1', tipo: 'ponto', x: 10, y: 0 },
  { id: 'l1', tipo: 'linha', a: 'p0', b: 'p1' },
], [{ id: 'r0', tipo: 'fixa', e: ['p0'], xy: [0, 0] }]);

test('origem p0: mover não move a origem (a linha move só o outro ponto)', () => {
  const s = comOrigem();
  mover(s, ['p0', 'l1'], 5, 5);
  assert.deepEqual([ponto(s, 'p0').x, ponto(s, 'p0').y], [0, 0]);
  perto(ponto(s, 'p1').x, 15); perto(ponto(s, 'p1').y, 5);
});

test('origem p0: copiar a origem não copia; linha copiada ganha ponto próprio na posição deslocada', () => {
  const s = comOrigem();
  const novos = copiar(s, ['p0', 'l1'], 0, 30);
  assert.equal(novos.length, 1);
  assert.equal(cont(s, 'ponto'), 2 + 2);
  const nl = s.entidades.find((e) => e.id === novos[0]) as Extract<EntSk, { tipo: 'linha' }>;
  assert.notEqual(nl.a, 'p0');
  perto(ponto(s, nl.a).y, 30);
  perto(ponto(s, nl.b).x, 10); perto(ponto(s, nl.b).y, 30);
  assert.deepEqual([ponto(s, 'p0').x, ponto(s, 'p0').y], [0, 0]);
});

test('origem p0: apagar a origem não remove p0, a linha que a usa nem a restrição r0', () => {
  const s = comOrigem();
  apagar(s, ['p0']);
  assert.ok(s.entidades.some((e) => e.id === 'p0'));
  assert.ok(s.entidades.some((e) => e.id === 'l1'));
  assert.deepEqual(s.restricoes.map((r) => r.id), ['r0']);
});

test('apagar linha mantém os pontos', () => {
  const s = retangulo();
  apagar(s, ['l1']);
  assert.equal(cont(s, 'linha'), 3);
  assert.equal(cont(s, 'ponto'), 4);
});

test('apagar ponto remove as linhas que o usam e as restrições que citam', () => {
  const s = retangulo();
  s.restricoes.push({ id: 'r1', tipo: 'coincidente', e: ['p2', 'l2'] }, { id: 'r2', tipo: 'horizontal', e: ['l3'] });
  apagar(s, ['p2']);
  assert.deepEqual(s.entidades.filter((e) => e.tipo === 'linha').map((e) => e.id), ['l3', 'l4']);
  assert.equal(cont(s, 'ponto'), 3);
  assert.deepEqual(s.restricoes.map((r) => r.id), ['r2']);
});

test('apagar entidade remove restrições que citam ela', () => {
  const s = retangulo();
  s.restricoes.push({ id: 'r1', tipo: 'distancia', e: ['l1'], expr: '10' }, { id: 'r2', tipo: 'horizontal', e: ['l3'] });
  apagar(s, ['l1']);
  assert.deepEqual(s.restricoes.map((r) => r.id), ['r2']);
});

test('alternaConstrucao liga quando há mistura e desliga quando todas estão ligadas', () => {
  const s = retangulo();
  (s.entidades[4] as EntSk).construcao = true; // l1 já é construção
  alternaConstrucao(s, ['l1', 'l2']);
  assert.equal(s.entidades.find((e) => e.id === 'l1')?.construcao, true);
  assert.equal(s.entidades.find((e) => e.id === 'l2')?.construcao, true);
  assert.notEqual(s.entidades.find((e) => e.id === 'l3')?.construcao, true);
  alternaConstrucao(s, ['l1', 'l2']);
  assert.equal(s.entidades.find((e) => e.id === 'l1')?.construcao, false);
  assert.equal(s.entidades.find((e) => e.id === 'l2')?.construcao, false);
});
