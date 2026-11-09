import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fechada, stl, bbox, volume, area } from '../src/malha/malha.ts'
import { caixa, cubo, cuboAberto, cuboInvertido } from './malha-fixtures.ts'

test('cubo(10) é fechado, com volume 1000, área 600 e bbox 0..10', () => {
  const m = cubo(10)
  assert.equal(fechada(m), true)
  assert.equal(volume(m), 1000)
  assert.equal(area(m), 600)
  assert.deepEqual(bbox(m), { min: [0, 0, 0], max: [10, 10, 10] })
})

test('caixa(2,3,4,1,1,1) tem volume 24 e bbox correto', () => {
  const m = caixa(2, 3, 4, 1, 1, 1)
  assert.equal(volume(m), 24)
  assert.deepEqual(bbox(m), { min: [1, 1, 1], max: [3, 4, 5] })
})

test('cuboAberto não é fechado', () => {
  assert.equal(fechada(cuboAberto(10)), false)
})

test('cuboInvertido tem volume negativo', () => {
  assert.equal(volume(cuboInvertido(10)), -1000)
})

test('malha vazia não é fechada', () => {
  assert.equal(fechada({ vertProps: new Float32Array(0), triVerts: new Uint32Array(0) }), false)
})

test('dois cubos soltos num mesmo array são fechados', () => {
  const a = cubo(10), b = cubo(10, 40, 0, 0)
  const m = {
    vertProps: new Float32Array([...a.vertProps, ...b.vertProps]),
    triVerts: new Uint32Array([...a.triVerts, ...b.triVerts.map((i) => i + 8)]),
  }
  assert.equal(fechada(m), true)
})

test('formato {posicoes, indices} dá o mesmo resultado que {vertProps, triVerts}', () => {
  const m = cubo(10)
  const p = { posicoes: m.vertProps, indices: m.triVerts }
  assert.equal(fechada(p), fechada(m))
  assert.equal(volume(p), volume(m))
  assert.equal(area(p), area(m))
  assert.deepEqual(bbox(p), bbox(m))
  assert.deepEqual(stl(p), stl(m))
})

test('numProp 5 (2 propriedades extras por vértice) funciona', () => {
  const c = cubo(10)
  const nv = c.vertProps.length / 3
  const vertProps = new Float32Array(nv * 5)
  for (let i = 0; i < nv; i++) {
    vertProps.set(c.vertProps.subarray(i * 3, i * 3 + 3), i * 5)
    vertProps[i * 5 + 3] = 7
    vertProps[i * 5 + 4] = 9
  }
  const m = { vertProps, triVerts: c.triVerts, numProp: 5 }
  assert.equal(fechada(m), true)
  assert.equal(volume(m), 1000)
  assert.deepEqual(bbox(m), { min: [0, 0, 0], max: [10, 10, 10] })
})

test('stl: tamanho, contador, cabeçalho zerado e normal do primeiro triângulo', () => {
  const bytes = stl(cubo(10))
  assert.equal(bytes.length, 84 + 50 * 12)
  const dv = new DataView(bytes.buffer)
  assert.equal(dv.getUint32(80, true), 12)
  assert.deepEqual(bytes.subarray(0, 80), new Uint8Array(80))
  assert.deepEqual([dv.getFloat32(84, true), dv.getFloat32(88, true), dv.getFloat32(92, true)], [0, 0, -1])
})

test('stl é determinístico', () => {
  assert.deepEqual(stl(cubo(10)), stl(cubo(10)))
})
