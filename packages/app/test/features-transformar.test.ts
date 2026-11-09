import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criaTransformacaoSolido } from '../src/features/transformar.ts'
import type { AlvoT } from '../src/features/transformar.ts'
import type { V3 } from '../src/features/contrato.ts'

const alvo = (id = 'a', centro: V3 = [0, 0, 0]): AlvoT => ({ id, centro })
const mouse = (delta: V3 = [0, 0, 0], angulo = 0, razao = 1) => ({ delta, angulo, razao })
const seq = () => {
  let n = 0
  return (p: string) => `${p}${++n}`
}

test('G com eixo X usa só o delta X', () => {
  const t = criaTransformacaoSolido()
  t.inicia('G', [alvo()])
  t.eixo('X', false)
  t.mouse(mouse([3, 4, 5]), false)
  assert.deepEqual(t.previa()?.[0].mover, [3, 0, 0])
})

test('G com plano Shift+Z exclui Z', () => {
  const t = criaTransformacaoSolido()
  t.inicia('G', [alvo()])
  t.eixo('Z', true)
  t.mouse(mouse([3, 4, 5]), false)
  assert.deepEqual(t.previa()?.[0].mover, [3, 4, 0])
})

test('G sem trava usa o delta livre e eixo destravado com o mesmo eixo de novo', () => {
  const t = criaTransformacaoSolido()
  t.inicia('G', [alvo()])
  t.eixo('X', false)
  t.eixo('X', false)
  t.mouse(mouse([3, 4, 5]), false)
  assert.deepEqual(t.previa()?.[0].mover, [3, 4, 5])
})

test('G com número e eixo Y move nesse eixo', () => {
  const t = criaTransformacaoSolido()
  t.inicia('G', [alvo()])
  t.eixo('Y', false)
  t.numero('12.5')
  assert.deepEqual(t.previa()?.[0].mover, [0, 12.5, 0])
})

test('G sem eixo com número move no X', () => {
  const t = criaTransformacaoSolido()
  t.inicia('G', [alvo()])
  t.numero('7')
  assert.deepEqual(t.previa()?.[0].mover, [7, 0, 0])
  assert.equal(t.rotulo, 'G X 7')
})

test('número prevalece sobre o mouse; texto vazio volta ao mouse', () => {
  const t = criaTransformacaoSolido()
  t.inicia('G', [alvo()])
  t.mouse(mouse([9, 0, 0]), false)
  t.numero('5')
  t.mouse(mouse([9, 0, 0]), false)
  assert.deepEqual(t.previa()?.[0].mover, [5, 0, 0])
  t.numero('')
  assert.deepEqual(t.previa()?.[0].mover, [9, 0, 0])
})

test('número aceita sinal e vírgula decimal', () => {
  const t = criaTransformacaoSolido()
  t.inicia('G', [alvo()])
  t.eixo('Y', false)
  t.numero('-12.5')
  assert.deepEqual(t.previa()?.[0].mover, [0, -12.5, 0])
  t.numero('1,5')
  assert.deepEqual(t.previa()?.[0].mover, [0, 1.5, 0])
})

test('snap arredonda o mouse em G (1 mm)', () => {
  const t = criaTransformacaoSolido()
  t.inicia('G', [alvo()])
  t.eixo('X', false)
  t.mouse(mouse([3.4, 0, 0]), true)
  assert.deepEqual(t.previa()?.[0].mover, [3, 0, 0])
})

test('R com número 90 gira em Z em torno do centro do alvo', () => {
  const t = criaTransformacaoSolido()
  t.inicia('R', [alvo('a', [1, 2, 3])])
  t.numero('90')
  const f = t.previa()?.[0]
  assert.deepEqual(f?.girar, [0, 0, 90])
  assert.deepEqual(f?.pivo, [1, 2, 3])
})

test('R com eixo X e ângulo 33 com snap vira 30', () => {
  const t = criaTransformacaoSolido()
  t.inicia('R', [alvo()])
  t.eixo('X', false)
  t.mouse(mouse([0, 0, 0], 33), true)
  assert.deepEqual(t.previa()?.[0].girar, [30, 0, 0])
})

test('S com número 2 escala uniforme', () => {
  const t = criaTransformacaoSolido()
  t.inicia('S', [alvo()])
  t.numero('2')
  assert.equal(t.previa()?.[0].escala, 2)
})

test('S com eixo Z escala só em Z', () => {
  const t = criaTransformacaoSolido()
  t.inicia('S', [alvo()])
  t.eixo('Z', false)
  t.mouse(mouse([0, 0, 0], 0, 1.5), false)
  assert.deepEqual(t.previa()?.[0].escala, [1, 1, 1.5])
})

test('S com plano Z escala nos dois outros eixos', () => {
  const t = criaTransformacaoSolido()
  t.inicia('S', [alvo()])
  t.eixo('Z', true)
  t.mouse(mouse([0, 0, 0], 0, 1.5), false)
  assert.deepEqual(t.previa()?.[0].escala, [1.5, 1.5, 1])
})

test('fator 0 ou negativo faz a prévia ser null', () => {
  const t = criaTransformacaoSolido()
  t.inicia('S', [alvo()])
  t.numero('0')
  assert.equal(t.previa(), null)
  t.numero('-2')
  assert.equal(t.previa(), null)
})

test('efeito nulo (mouse parado) faz a prévia ser null', () => {
  const t = criaTransformacaoSolido()
  t.inicia('G', [alvo()])
  t.mouse(mouse([0, 0, 0]), false)
  assert.equal(t.previa(), null)
})

test('confirma devolve features com novoId, encerra e cancela zera', () => {
  const t = criaTransformacaoSolido()
  t.inicia('G', [alvo('a')])
  t.numero('1')
  const feats = t.confirma(seq())
  assert.deepEqual(feats, [{ id: 'tr1', tipo: 'transformacao', alvo: 'a', mover: [1, 0, 0] }])
  assert.equal(t.ativa, false)
  assert.equal(t.previa(), null)
  assert.deepEqual(t.confirma(seq()), [])
})

test('duplicar gera copiaId por alvo', () => {
  const t = criaTransformacaoSolido()
  t.inicia('G', [alvo('a')], { duplicar: true })
  t.numero('5')
  const feats = t.confirma(seq())
  assert.equal(feats[0].id, 'tr1')
  assert.equal(feats[0].copiaId, 'cp2')
})

test('cancela encerra e a prévia fica null', () => {
  const t = criaTransformacaoSolido()
  t.inicia('G', [alvo()])
  t.numero('3')
  t.cancela()
  assert.equal(t.ativa, false)
  assert.equal(t.previa(), null)
  assert.equal(t.rotulo, '')
})

test('dois alvos viram duas features com prévia prev1 e prev2', () => {
  const t = criaTransformacaoSolido()
  t.inicia('R', [alvo('a', [0, 0, 0]), alvo('b', [10, 0, 0])])
  t.numero('45')
  const feats = t.previa()
  assert.equal(feats?.length, 2)
  assert.equal(feats?.[0].id, 'prev1')
  assert.equal(feats?.[1].id, 'prev2')
  assert.deepEqual(feats?.[1].pivo, [10, 0, 0])
})

test('rótulo contém letra e eixo', () => {
  const t = criaTransformacaoSolido()
  t.inicia('G', [alvo()])
  t.eixo('X', false)
  t.numero('12.5')
  assert.equal(t.rotulo, 'G X 12.5')
  t.eixo('Y', true)
  assert.ok(t.rotulo.includes('G') && t.rotulo.includes('Y'))
})
