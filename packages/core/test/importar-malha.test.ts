import { test } from 'node:test'
import assert from 'node:assert/strict'
import { strToU8, zipSync } from 'fflate'
import { fechada, stl, volume } from '../src/malha/malha.ts'
import { escrever3mf } from '../src/export/3mf.ts'
import { lerObj, lerStl, ler3mf } from '../src/importar/index.ts'
import { cubo, doisCorpos } from './malha-fixtures.ts'

// Cubo de lado 10 com faces quadradas anti-horário visto de fora.
const VERTS = [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0], [0, 0, 10], [10, 0, 10], [10, 10, 10], [0, 10, 10]]
const QUADS = [[1, 4, 3, 2], [5, 6, 7, 8], [1, 2, 6, 5], [3, 4, 8, 7], [1, 5, 8, 4], [2, 3, 7, 6]]
const objCubo = (f: (i: number) => string) =>
  VERTS.map((v) => `v ${v.join(' ')}`).join('\n') + '\n' + QUADS.map((q) => 'f ' + q.map(f).join(' ')).join('\n') + '\n'

test('STL binário: round-trip de cubo soldado', () => {
  const m = lerStl(stl(cubo(10)))
  assert.equal(m.vertProps.length / 3, 8)
  assert.equal(m.triVerts.length / 3, 12)
  assert.ok(fechada(m))
  assert.ok(Math.abs(volume(m) - 1000) < 1e-6)
})

test('STL ASCII: tetraedro com 4 vértices soldados', () => {
  const facetas = [
    [[0, 0, 0], [0, 10, 0], [10, 0, 0]],
    [[0, 0, 0], [10, 0, 0], [0, 0, 10]],
    [[0, 0, 0], [0, 0, 10], [0, 10, 0]],
    [[10, 0, 0], [0, 10, 0], [0, 0, 10]],
  ]
  const texto = ['solid tet', ...facetas.flatMap((f) => [
    'facet normal 0 0 0', 'outer loop',
    ...f.map((v) => `vertex ${v.join(' ')}`),
    'endloop', 'endfacet',
  ]), 'endsolid tet'].join('\n')
  const m = lerStl(strToU8(texto))
  assert.equal(m.vertProps.length / 3, 4)
  assert.equal(m.triVerts.length / 3, 4)
  assert.ok(fechada(m))
  assert.ok(Math.abs(volume(m) - 1000 / 6) < 1e-3)
})

test('OBJ: 6 quads viram 12 triângulos de volume 1000', () => {
  const m = lerObj('# cubo\no cubo\n' + objCubo(String))
  assert.equal(m.vertProps.length / 3, 8)
  assert.equal(m.triVerts.length / 3, 12)
  assert.ok(fechada(m))
  assert.ok(Math.abs(volume(m) - 1000) < 1e-6)
})

test('OBJ: índices negativos e formato a/b/c dão a mesma malha', () => {
  const positivo = lerObj(objCubo(String))
  const negativo = lerObj(objCubo((i) => `${i - 9}/1/${i - 9}`))
  assert.deepEqual(Array.from(negativo.triVerts), Array.from(positivo.triVerts))
  assert.deepEqual(Array.from(negativo.vertProps), Array.from(positivo.vertProps))
})

test('3MF: round-trip de dois corpos', () => {
  const bytes = escrever3mf({ corpos: doisCorpos(), sabor: 'core' })
  const objetos = ler3mf(bytes)
  assert.deepEqual(objetos.map((o) => o.nome), ['Base', 'Tampa'])
  for (const o of objetos) {
    assert.ok(fechada(o.malha))
    assert.ok(Math.abs(volume(o.malha) - 8000) < 1e-3)
  }
})

test('entradas inválidas lançam erro', () => {
  assert.throws(() => lerStl(new Uint8Array(0)), /STL inválido/)
  assert.throws(() => lerStl(stl({ vertProps: new Float32Array(0), triVerts: new Uint32Array(0) })), /STL inválido/)
  assert.throws(() => lerObj('v 0 0 0\nv 1 0 0\n'), /OBJ inválido: sem faces/)
  assert.throws(() => lerObj('v 0 0 0\nf 1 2 3\n'), /fora do intervalo/)
  assert.throws(() => ler3mf(zipSync({ 'leia.txt': strToU8('x') })), /modelo não encontrado/)
})
