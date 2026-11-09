import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criaPilha, definirParametro, novoDocumento } from '../src/doc/index.ts';
import type { Documento } from '../src/doc/index.ts';
import {
  achaSketch, adicionaRestricao, aplicaAdicao, criarSketch, editaExprCota, editaSketch, removeRestricao, sketchResolvido,
} from '../src/sketch/comandos.ts';
import type { Adicao, SketchFeature } from '../src/sketch/tipos.ts';

const PLANO = { base: 'XY' as const, offset: 0 };
const perto = (a: number, b: number, t = 1e-6) => assert.ok(Math.abs(a - b) < t, `${a} != ${b}`);
const sk = (doc: Documento): SketchFeature => {
  const s = achaSketch(doc, 'sk1');
  assert.ok(s);
  return s;
};
const ponto = (s: SketchFeature, id: string): { x: number; y: number } => {
  const e = s.entidades.find((x) => x.id === id);
  assert.ok(e?.tipo === 'ponto');
  return e;
};

// retângulo 80x50 desenhado "no olho" (ruído de ±2 mm), canto @1 em (0,0)
const REC: Adicao = {
  entidades: [
    { id: '@1', tipo: 'ponto', x: 0, y: 0 },
    { id: '@2', tipo: 'ponto', x: 78.5, y: 1.2 },
    { id: '@3', tipo: 'ponto', x: 81.6, y: 48.1 },
    { id: '@4', tipo: 'ponto', x: -1.5, y: 51.8 },
    { id: '@5', tipo: 'linha', a: '@1', b: '@2' },
    { id: '@6', tipo: 'linha', a: '@2', b: '@3' },
    { id: '@7', tipo: 'linha', a: '@3', b: '@4' },
    { id: '@8', tipo: 'linha', a: '@4', b: '@1' },
  ],
  restricoes: [
    { id: '@h1', tipo: 'horizontal', e: ['@5'] },
    { id: '@v1', tipo: 'vertical', e: ['@6'] },
    { id: '@h2', tipo: 'horizontal', e: ['@7'] },
    { id: '@v2', tipo: 'vertical', e: ['@8'] },
  ],
};

test('criarSketch: desfazer remove, refazer recria com o mesmo id', () => {
  const doc = novoDocumento();
  const pilha = criaPilha(doc);
  const c = criarSketch(PLANO);
  pilha.executa(c);
  assert.equal(c.id, 'sk1');
  assert.equal(c.nome, 'SKETCH XY');
  assert.equal(doc.features.length, 1);
  pilha.desfaz();
  assert.equal(doc.features.length, 0);
  pilha.refaz();
  assert.equal(doc.features[0].id, 'sk1');
});

test('criarSketch: origem p0 em (0,0) fixa por r0; sketch só com a origem está definido', () => {
  const doc = novoDocumento();
  const pilha = criaPilha(doc);
  pilha.executa(criarSketch(PLANO));
  assert.deepEqual(sk(doc).entidades, [{ id: 'p0', tipo: 'ponto', x: 0, y: 0 }]);
  assert.deepEqual(sk(doc).restricoes, [{ id: 'r0', tipo: 'fixa', e: ['p0'], xy: [0, 0] }]);
  const r = sketchResolvido(doc, 'sk1');
  assert.ok(r);
  assert.equal(r.info.estado, 'definido');
});

test('removeRestricao de r0 lança e a origem continua fixa', () => {
  const doc = novoDocumento();
  const pilha = criaPilha(doc);
  pilha.executa(criarSketch(PLANO));
  assert.throws(() => pilha.executa(removeRestricao('sk1', 'r0')), /origem do sketch é fixa/);
  assert.equal(sk(doc).restricoes.length, 1);
});

test('REC 80x50: definido, pontos em (80,50); undo/redo; desfazer tudo volta ao inicial', () => {
  const doc = novoDocumento();
  const inicial = structuredClone(doc);
  const pilha = criaPilha(doc);
  pilha.executa(criarSketch(PLANO));
  pilha.executa(editaSketch('REC', 'sk1', (s) => { aplicaAdicao(s, REC); }));
  pilha.executa(adicionaRestricao('sk1', 'fixa', ['p1'], { xy: [0, 0] }));
  pilha.executa(adicionaRestricao('sk1', 'distancia', ['l1'], { expr: '80' }));
  pilha.executa(adicionaRestricao('sk1', 'distancia', ['l2'], { expr: '50' }));

  const r = sketchResolvido(doc, 'sk1');
  assert.ok(r);
  assert.equal(r.info.estado, 'definido');
  perto(ponto(r.sk, 'p3').x, 80);
  perto(ponto(r.sk, 'p3').y, 50);
  assert.equal(sk(doc).entidades.length, 9); // origem + 8 do REC

  pilha.desfaz(); pilha.desfaz(); pilha.desfaz(); // cota2, cota1, fixa
  assert.equal(sk(doc).restricoes.length, 5); // r0 + 4 do REC
  pilha.desfaz(); // REC
  assert.deepEqual(sk(doc).entidades.map((e) => e.id), ['p0']);
  pilha.refaz();
  assert.equal(sk(doc).entidades.length, 9);
  pilha.refaz(); pilha.refaz(); pilha.refaz();
  const r2 = sketchResolvido(doc, 'sk1');
  assert.ok(r2);
  assert.equal(r2.info.estado, 'definido');
  perto(ponto(r2.sk, 'p3').x, 80);

  pilha.desfaz(); pilha.desfaz(); pilha.desfaz(); pilha.desfaz(); pilha.desfaz();
  assert.deepStrictEqual(doc, inicial);
});

test('parametricidade: cota "=L" segue o parâmetro sem passar pelo undo', () => {
  const doc = novoDocumento();
  const pilha = criaPilha(doc);
  pilha.executa(definirParametro('L', '80'));
  pilha.executa(criarSketch(PLANO));
  pilha.executa(editaSketch('REC', 'sk1', (s) => { aplicaAdicao(s, REC); }));
  pilha.executa(adicionaRestricao('sk1', 'fixa', ['p1'], { xy: [0, 0] }));
  pilha.executa(adicionaRestricao('sk1', 'distancia', ['l1'], { expr: '80' })); // restrição r6
  pilha.executa(editaExprCota('sk1', 'r6', '=L'));

  let r = sketchResolvido(doc, 'sk1');
  assert.ok(r);
  perto(ponto(r.sk, 'p2').x, 80);

  pilha.executa(definirParametro('L', '100'));
  r = sketchResolvido(doc, 'sk1');
  assert.ok(r);
  perto(ponto(r.sk, 'p2').x, 100);
  // o documento guarda a última resolução (L=80); só a cópia para desenho segue o parâmetro
  perto(ponto(sk(doc), 'p2').x, 80);
});

test('mapa: polilinha em 2 passos, @3 da 1a adição resolve na 2a', () => {
  const doc = novoDocumento();
  const pilha = criaPilha(doc);
  const mapa = new Map<string, string>();
  pilha.executa(criarSketch(PLANO));
  const a1: Adicao = {
    entidades: [
      { id: '@1', tipo: 'ponto', x: 0, y: 0 },
      { id: '@2', tipo: 'ponto', x: 10, y: 0 },
      { id: '@3', tipo: 'ponto', x: 10, y: 10 },
      { id: '@4', tipo: 'linha', a: '@1', b: '@2' },
      { id: '@5', tipo: 'linha', a: '@2', b: '@3' },
    ],
    restricoes: [],
  };
  pilha.executa(editaSketch('POLI 1', 'sk1', (s) => { aplicaAdicao(s, a1, mapa); }));
  assert.equal(mapa.get('@3'), 'p3');

  let ids: string[] = [];
  const a2: Adicao = {
    entidades: [
      { id: '@6', tipo: 'ponto', x: 20, y: 10 },
      { id: '@7', tipo: 'linha', a: '@3', b: '@6' },
    ],
    restricoes: [],
  };
  pilha.executa(editaSketch('POLI 2', 'sk1', (s) => { ids = aplicaAdicao(s, a2, mapa); }));
  assert.deepEqual(ids, ['p4', 'l3']);
  assert.deepEqual(sk(doc).entidades.find((e) => e.id === 'l3'), { id: 'l3', tipo: 'linha', a: 'p3', b: 'p4' });
});

test('id inexistente lança e não altera o sketch', () => {
  const doc = novoDocumento();
  const pilha = criaPilha(doc);
  assert.throws(() => pilha.executa(editaSketch('X', 'sk99', () => {})), /sk99/);
  assert.throws(() => pilha.executa(adicionaRestricao('sk99', 'horizontal', ['p1'])), /sk99/);
  pilha.executa(criarSketch(PLANO));
  assert.throws(() => pilha.executa(adicionaRestricao('sk1', 'horizontal', ['p99'])), /p99/);
  assert.equal(sk(doc).restricoes.length, 1); // só r0
  assert.throws(() => aplicaAdicao(sk(doc), { entidades: [], restricoes: [{ id: '@r', tipo: 'horizontal', e: ['@9'] }] }), /@9/);
});

test('prender: mover uma linha de retângulo sem cotas move exatamente o delta (pontos movidos ficam presos)', async () => {
  const { novoDocumento, criaPilha } = await import('../src/doc/index.ts')
  const { mover } = await import('../src/sketch/edicao.ts')
  const doc = novoDocumento(), pilha = criaPilha(doc)
  const cs = criarSketch({ base: 'XY', offset: 0 })
  pilha.executa(cs)
  pilha.executa(editaSketch('REC', cs.id, sk => {
    aplicaAdicao(sk, {
      entidades: [
        { id: '@1', tipo: 'ponto', x: 0, y: 0 }, { id: '@2', tipo: 'ponto', x: 80, y: 0 }, { id: '@3', tipo: 'ponto', x: 80, y: 50 }, { id: '@4', tipo: 'ponto', x: 0, y: 50 },
        { id: '@5', tipo: 'linha', a: '@1', b: '@2' }, { id: '@6', tipo: 'linha', a: '@2', b: '@3' }, { id: '@7', tipo: 'linha', a: '@3', b: '@4' }, { id: '@8', tipo: 'linha', a: '@4', b: '@1' },
      ],
      restricoes: [
        { id: '@r1', tipo: 'horizontal', e: ['@5'] }, { id: '@r2', tipo: 'vertical', e: ['@6'] }, { id: '@r3', tipo: 'horizontal', e: ['@7'] }, { id: '@r4', tipo: 'vertical', e: ['@8'] },
      ],
    })
  }))
  pilha.executa(editaSketch('MOVER', cs.id, sk => mover(sk, ['l1'], 5, 0), { prender: true }))
  const p = (id: string) => (achaSketch(doc, cs.id)!.entidades.find(e => e.id === id) as { x: number }).x
  assert.ok(Math.abs(p('p1') - 5) < 1e-6 && Math.abs(p('p2') - 85) < 1e-6)
})
