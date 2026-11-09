import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stl } from '../../core/src/malha/malha.ts'
import { escrever3mf } from '../../core/src/export/3mf.ts'
import { cubo } from '../../core/test/malha-fixtures.ts'
import { classifica } from '../src/importar/classifica.ts'

const OBJ_CUBO = `v 0 0 0
v 1 0 0
v 1 1 0
v 0 1 0
v 0 0 1
v 1 0 1
v 1 1 1
v 0 1 1
f 1 3 2
f 1 4 3
f 5 6 7
f 5 7 8
f 1 2 6
f 1 6 5
f 2 3 7
f 2 7 6
f 3 4 8
f 3 8 7
f 4 1 5
f 4 5 8
`

test('STL binário vira um item com 12 triângulos (extensão sem diferenciar maiúsculas)', () => {
  const r = classifica('Peca.STL', stl(cubo(10)))
  assert.equal(r.tipo, 'malhas')
  if (r.tipo !== 'malhas') return
  assert.equal(r.itens.length, 1)
  assert.equal(r.itens[0]!.nome, 'Peca')
  assert.equal(r.itens[0]!.malha.triVerts.length / 3, 12)
})

test('OBJ de texto vira um item', () => {
  const r = classifica('cubo.obj', new TextEncoder().encode(OBJ_CUBO))
  assert.equal(r.tipo, 'malhas')
  if (r.tipo !== 'malhas') return
  assert.equal(r.itens.length, 1)
  assert.equal(r.itens[0]!.malha.triVerts.length / 3, 12)
})

test('3MF com 2 objetos vira 2 itens', () => {
  const bytes = escrever3mf({
    corpos: [
      { nome: 'a', malha: cubo(10), cor: '#ffffff', slot: 1 },
      { nome: 'b', malha: cubo(5, 20, 0, 0), cor: '#ffffff', slot: 1 },
    ],
    sabor: 'core',
  })
  const r = classifica('modelo.3mf', bytes)
  assert.equal(r.tipo, 'malhas')
  if (r.tipo !== 'malhas') return
  assert.equal(r.itens.length, 2)
})

test('SVG com rect vira 1 contorno', () => {
  const r = classifica('forma.svg', new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><rect width="20" height="10"/></svg>'))
  assert.equal(r.tipo, 'svg')
  if (r.tipo !== 'svg') return
  assert.equal(r.contornos.length, 1)
})

test('extensão desconhecida é inválida', () => {
  assert.deepEqual(classifica('notas.txt', new Uint8Array([1, 2, 3])), { tipo: 'invalido' })
})

test('STL vazio lança', () => {
  assert.throws(() => classifica('vazio.stl', new Uint8Array(0)))
})
