import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verificar } from '../src/imprimir/verificar.ts'
import { fechada, volume } from '../src/malha/malha.ts'
import type { EntradaMalha } from '../src/malha/tipos.ts'
import { impressoraPorId } from '../printers/index.ts'
import { filamentoPorId } from '../filaments/index.ts'
import { caixa, cubo, cuboAberto, cuboInvertido } from './malha-fixtures.ts'

const mega = impressoraPorId('anycubic-i3-mega-s')!
const p2s = impressoraPorId('bambu-p2s')!
const pla = filamentoPorId('pla')!

const rodar = (malha: EntradaMalha, impressora = mega) =>
  verificar({ impressora, filamento: pla, corpos: [{ nome: 'Peca', malha }] })
const codigos = (achados: { codigo: string }[]) => achados.map(a => a.codigo)

/** Pirâmide de base quadrada (half-lado w, altura h). Invertida = base larga em cima, ponta embaixo. Faces orientadas para fora. */
function piramide(w: number, h: number, invertida: boolean): EntradaMalha {
  const zb = invertida ? h : 0
  const za = invertida ? 0 : h
  const P = [[-w, -w, zb], [w, -w, zb], [w, w, zb], [-w, w, zb], [0, 0, za]]
  const T = [[0, 2, 1], [0, 3, 2], [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]]
  const centro = [0, 0, (zb + za) / 2]
  const triVerts: number[] = []
  for (const [a, b0, c0] of T) {
    let b = b0, c = c0
    const [A, B, C] = [P[a], P[b], P[c]]
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]]
    const v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]]
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    const m = [(A[0] + B[0] + C[0]) / 3 - centro[0], (A[1] + B[1] + C[1]) / 3 - centro[1], (A[2] + B[2] + C[2]) / 3 - centro[2]]
    if (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] < 0) { const t = b; b = c; c = t }
    triVerts.push(a, b, c)
  }
  return { vertProps: new Float32Array(P.flat()), triVerts: new Uint32Array(triVerts) }
}

test('cubo sem problemas: lista vazia', () => {
  assert.deepEqual(rodar(cubo(20)), [])
})

test('malha aberta: um achado bloqueio', () => {
  const r = rodar(cuboAberto(20))
  assert.equal(r.length, 1)
  assert.equal(r[0].codigo, 'malha-aberta')
  assert.equal(r[0].severidade, 'bloqueio')
})

test('faces invertidas: volume-invertido', () => {
  const m = cuboInvertido(20)
  assert.ok(volume(m) < 0)
  const achado = rodar(m).find(a => a.codigo === 'volume-invertido')
  assert.ok(achado)
  assert.equal(achado.severidade, 'aviso')
})

test('fora do volume: caixa 300 mm na Mega S e na P2S (256)', () => {
  for (const imp of [mega, p2s]) {
    const r = rodar(caixa(300, 10, 10), imp)
    const achado = r.find(a => a.codigo === 'fora-do-volume')
    assert.ok(achado, imp.id)
    assert.equal(achado.severidade, 'erro')
  }
})

test('cabe na P2S (250 mm) mas não na Mega S (210 mm)', () => {
  assert.ok(!rodar(caixa(250, 10, 10), p2s).some(a => a.codigo === 'fora-do-volume'))
  assert.ok(rodar(caixa(250, 10, 10), mega).some(a => a.codigo === 'fora-do-volume'))
})

test('detalhe mínimo: caixa 20×20×0,2 mm', () => {
  assert.ok(rodar(caixa(20, 20, 0.2)).some(a => a.codigo === 'detalhe-minimo'))
})

test('base de apoio: cubo flutuando (contato 0 mm²)', () => {
  const achado = rodar(cubo(20, 0, 0, 5)).find(a => a.codigo === 'base-menor')
  assert.ok(achado)
  assert.ok(achado.mensagem.includes('0,0 mm²'))
})

test('base de apoio: caixa 3×3×10 mm (área 9 mm²)', () => {
  const achado = rodar(caixa(3, 3, 10)).find(a => a.codigo === 'base-menor')
  assert.ok(achado)
  assert.ok(achado.mensagem.includes('9,0 mm²'))
})

test('overhang: pirâmide invertida (fechada, volume > 0) tem overhang', () => {
  const m = piramide(50, 10, true)
  assert.ok(fechada(m))
  assert.ok(volume(m) > 0)
  assert.ok(rodar(m).some(a => a.codigo === 'overhang'))
})

test('overhang: pirâmide normal (base larga embaixo) não tem overhang', () => {
  const m = piramide(50, 10, false)
  assert.ok(fechada(m))
  assert.ok(volume(m) > 0)
  assert.ok(!rodar(m).some(a => a.codigo === 'overhang'))
})

test('mensagens são texto não vazio e citam o nome do corpo', () => {
  const r = rodar(cuboAberto(20))
  for (const a of r) {
    assert.ok(a.mensagem.length > 0)
    assert.ok(a.mensagem.includes('Peca'))
  }
})

test('dois corpos: achado traz o nome do corpo certo', () => {
  const r = verificar({
    impressora: mega,
    filamento: pla,
    corpos: [{ nome: 'Base', malha: cubo(20) }, { nome: 'Tampa', malha: cuboAberto(20) }],
  })
  assert.equal(r.length, 1)
  assert.equal(r[0].codigo, 'malha-aberta')
  assert.equal(r[0].corpo, 'Tampa')
})

test('corpo sem triângulos: malha-vazia', () => {
  const r = rodar({ vertProps: new Float32Array(0), triVerts: new Uint32Array(0) })
  assert.deepEqual(codigos(r), ['malha-vazia'])
  assert.equal(r[0].severidade, 'erro')
})
