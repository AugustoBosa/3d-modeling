import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import type { CorpoInfo } from '../src/features/contrato.ts'
import { criaCorpos3d } from '../src/features/corpos3d.ts'

// cubo de 10 mm, 8 vértices e 12 triângulos (faces voltadas para fora)
const POS = new Float32Array([0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0, 0, 0, 10, 10, 0, 10, 10, 10, 10, 0, 10, 10])
const IDX = new Uint32Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 6, 2, 3, 7, 6, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5])
const cubo = (id: string, pos: Float32Array = POS): CorpoInfo =>
  ({ id, pos, idx: IDX, bbox: { min: [0, 0, 0], max: [10, 10, 10] }, volume: 1000, fechada: true, tri: 12 })

const SEM: ReadonlySet<string> = new Set()
const cores = {}

function vistaFalsa(raio = new THREE.Ray(new THREE.Vector3(5, 5, 50), new THREE.Vector3(0, 0, -1))) {
  const contador = { renders: 0 }
  return { cena: new THREE.Scene(), contador, pedeRender: () => { contador.renders++ }, raio: () => raio }
}
const grupo = (v: { cena: THREE.Scene }, id: string) => v.cena.getObjectByName(`corpo:${id}`) as THREE.Group
const malhaDe = (g: THREE.Group) => g.children[0] as THREE.Mesh
const arestasDe = (g: THREE.Group) => g.children[1] as THREE.LineSegments

test('atualiza cria grupo corpos com um filho por corpo (Mesh + LineSegments)', () => {
  const v = vistaFalsa()
  const c = criaCorpos3d(v)
  c.atualiza([cubo('c1')], cores, SEM, SEM)
  const raiz = v.cena.getObjectByName('corpos')!
  assert.equal(raiz.children.length, 1)
  const g = grupo(v, 'c1')
  assert.equal(g.children.length, 2)
  assert.ok(malhaDe(g) instanceof THREE.Mesh)
  assert.ok(arestasDe(g) instanceof THREE.LineSegments)
  assert.ok(v.contador.renders > 0)
})

test('arestas do cubo: 12 arestas (24 vértices)', () => {
  const v = vistaFalsa()
  criaCorpos3d(v).atualiza([cubo('c1')], cores, SEM, SEM)
  assert.equal(arestasDe(grupo(v, 'c1')).geometry.attributes.position.count, 24)
})

test('mesma referência de pos não recria a geometria', () => {
  const v = vistaFalsa()
  const c = criaCorpos3d(v)
  const cb = cubo('c1')
  c.atualiza([cb], cores, SEM, SEM)
  const antes = malhaDe(grupo(v, 'c1')).geometry.uuid
  c.atualiza([cubo('c1', cb.pos)], { c1: '#ff0000' }, SEM, SEM)
  assert.equal(malhaDe(grupo(v, 'c1')).geometry.uuid, antes)
})

test('referência nova recria a geometria e dá dispose na antiga', () => {
  const v = vistaFalsa()
  const c = criaCorpos3d(v)
  c.atualiza([cubo('c1')], cores, SEM, SEM)
  const geoAntiga = malhaDe(grupo(v, 'c1')).geometry
  let descartada = 0
  geoAntiga.addEventListener('dispose', () => descartada++)
  c.atualiza([cubo('c1', new Float32Array(POS))], cores, SEM, SEM)
  assert.notEqual(malhaDe(grupo(v, 'c1')).geometry.uuid, geoAntiga.uuid)
  assert.equal(descartada, 1)
})

test('oculto deixa o grupo invisível e não é alvo do pega', () => {
  const v = vistaFalsa()
  const c = criaCorpos3d(v)
  c.atualiza([cubo('c1')], cores, new Set(['c1']), SEM)
  assert.equal(grupo(v, 'c1').visible, false)
  assert.equal(c.triangulosVisiveis(), 0)
  assert.equal(c.pega(0, 0), null)
})

test('corpo removido some da cena e é descartado', () => {
  const v = vistaFalsa()
  const c = criaCorpos3d(v)
  c.atualiza([cubo('c1')], cores, SEM, SEM)
  const g = grupo(v, 'c1')
  const geo = malhaDe(g).geometry
  let descartada = 0
  geo.addEventListener('dispose', () => descartada++)
  c.atualiza([], cores, SEM, SEM)
  assert.equal(v.cena.getObjectByName('corpos')!.children.length, 0)
  assert.equal(descartada, 1)
})

test('pega com raio que atravessa o cubo devolve corpo e ponto no topo', () => {
  const v = vistaFalsa()
  const c = criaCorpos3d(v)
  c.atualiza([cubo('c1')], cores, SEM, SEM)
  const acerto = c.pega(0, 0)
  assert.ok(acerto)
  assert.equal(acerto.corpoId, 'c1')
  assert.ok(Math.abs(acerto.ponto[2] - 10) < 1e-6)
  assert.ok(acerto.tri >= 0)
  assert.equal(c.triangulosVisiveis(), 12)
})

test('pega com raio que erra devolve null', () => {
  const v = vistaFalsa(new THREE.Ray(new THREE.Vector3(50, 50, 50), new THREE.Vector3(0, 0, -1)))
  const c = criaCorpos3d(v)
  c.atualiza([cubo('c1')], cores, SEM, SEM)
  assert.equal(c.pega(0, 0), null)
})

test('selecionado usa emissive na malha e cor de aresta forte', () => {
  const v = vistaFalsa()
  criaCorpos3d(v).atualiza([cubo('c1')], cores, SEM, new Set(['c1']))
  const g = grupo(v, 'c1')
  assert.notEqual((malhaDe(g).material as THREE.MeshStandardMaterial).emissive.getHex(), 0)
  assert.equal((arestasDe(g).material as THREE.LineBasicMaterial).color.getHexString(), 'ff8c00')
})

test('dispose remove o grupo corpos da cena e descarta geometrias', () => {
  const v = vistaFalsa()
  const c = criaCorpos3d(v)
  c.atualiza([cubo('c1')], cores, SEM, SEM)
  const geo = malhaDe(grupo(v, 'c1')).geometry
  let descartada = 0
  geo.addEventListener('dispose', () => descartada++)
  c.dispose()
  assert.equal(v.cena.getObjectByName('corpos'), undefined)
  assert.equal(descartada, 1)
})
