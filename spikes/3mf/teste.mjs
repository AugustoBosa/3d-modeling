import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync, strFromU8 } from 'fflate';
import { gerar } from './gerar.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));

// Parser minimo: confere so o balanceamento de tags (sem dependencia).
function xmlBalanceado(xml) {
  const semDecl = xml.replace(/<\?[\s\S]*?\?>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  const pilha = [];
  const re = /<(\/?)([A-Za-z_][\w:.-]*)[^>]*?(\/?)>/g;
  let m;
  while ((m = re.exec(semDecl)) !== null) {
    const [, fecha, nome, autoFecha] = m;
    if (autoFecha) continue;
    if (!fecha) pilha.push(nome);
    else if (pilha.pop() !== nome) return false;
  }
  return pilha.length === 0;
}

// Malha fechada: cada aresta a->b aparece uma vez e b->a uma vez.
function malhaFechada(triangulos) {
  const cont = new Map();
  for (const [a, b, c] of triangulos) {
    for (const [x, y] of [[a, b], [b, c], [c, a]]) {
      const k = `${x},${y}`;
      cont.set(k, (cont.get(k) ?? 0) + 1);
    }
  }
  for (const [k, n] of cont) {
    const [x, y] = k.split(',');
    if (n !== 1 || cont.get(`${y},${x}`) !== 1) return false;
  }
  return cont.size > 0;
}

// Extrai triangulos de cada <object> do modelo.
function objetosDoModelo(xml) {
  const blocos = [...xml.matchAll(/<object\b[\s\S]*?<\/object>/g)].map((m) => m[0]);
  return blocos.map((b) => [...b.matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"/g)]
    .map((m) => [m[1], m[2], m[3]]));
}

const arquivos = gerar();

function abrir(caminho) {
  return unzipSync(readFileSync(caminho));
}

for (const caminho of arquivos) {
  const nome = caminho.split(/[\\/]/).pop();
  test(`${nome}: estrutura basica e XML balanceado`, () => {
    const z = abrir(caminho);
    assert.ok(z['[Content_Types].xml'], 'falta [Content_Types].xml');
    assert.ok(z['_rels/.rels'], 'falta _rels/.rels');
    assert.ok(z['3D/3dmodel.model'], 'falta 3D/3dmodel.model');
    for (const f of ['[Content_Types].xml', '_rels/.rels', '3D/3dmodel.model']) {
      assert.ok(xmlBalanceado(strFromU8(z[f])), `XML desbalanceado em ${f}`);
    }
    for (const f of Object.keys(z).filter((f) => f.endsWith('.config') && !f.endsWith('.json'))) {
      const txt = strFromU8(z[f]);
      if (txt.trim().startsWith('<')) assert.ok(xmlBalanceado(txt), `XML desbalanceado em ${f}`);
    }
  });

  test(`${nome}: malhas fechadas por objeto`, () => {
    const modelo = strFromU8(abrir(caminho)['3D/3dmodel.model']);
    const objs = objetosDoModelo(modelo);
    assert.ok(objs.length > 0);
    for (const tris of objs) assert.ok(malhaFechada(tris), 'malha aberta');
  });
}

test('mega-s.3mf: Slic3r_PE.config com printer_settings_id', () => {
  const z = abrir(join(DIR, 'out', 'mega-s.3mf'));
  assert.ok(z['Metadata/Slic3r_PE.config'], 'falta Metadata/Slic3r_PE.config');
  assert.match(strFromU8(z['Metadata/Slic3r_PE.config']), /^; printer_settings_id = .+$/m);
  assert.ok(z['Metadata/Slic3r_PE_model.config'], 'falta Metadata/Slic3r_PE_model.config');
});

test('p2s-2cores.3mf: project_settings JSON com printer_model e 2 cores', () => {
  const z = abrir(join(DIR, 'out', 'p2s-2cores.3mf'));
  const proj = JSON.parse(strFromU8(z['Metadata/project_settings.config']));
  assert.ok(typeof proj.printer_model === 'string' && proj.printer_model.length > 0);
  assert.equal(proj.printer_settings_id, 'Bambu Lab P2S');
  assert.deepEqual(proj.filament_colour, ['#FF0000', '#0000FF']);
});

test('p2s-2cores.3mf: model_settings com extruder 1 e 2 por objeto', () => {
  const z = abrir(join(DIR, 'out', 'p2s-2cores.3mf'));
  const ms = strFromU8(z['Metadata/model_settings.config']);
  assert.ok(xmlBalanceado(ms), 'model_settings.config desbalanceado');
  const blocos = [...ms.matchAll(/<object id="\d+">([\s\S]*?)<\/object>/g)].map((m) => m[1]);
  const extrusores = blocos.map((b) => (b.match(/key="extruder" value="(\d+)"/) ?? [])[1]);
  assert.deepEqual(extrusores, ['1', '2']);
});
