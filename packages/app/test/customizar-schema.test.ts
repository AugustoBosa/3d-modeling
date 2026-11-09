import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { lerDocumento } from '@3dm/core/doc'
import type { Documento } from '@3dm/core/doc'
import { agrupa, aplicaValores, hashDeValores, lerHash, origemUrl, validaRemoto, valoresAtuais } from '../src/customizar/schema.ts'

const EXEMPLO = new URL('../../../examples/caixa-com-tampa.3dm.json', import.meta.url)

// Caixa de exemplo com expostos: L (numero 40-120 passo 5), H (lista 20/30/40) e tampa (sim-nao, parametro criado aqui).
const base = (): Documento => {
  const doc = lerDocumento(readFileSync(EXEMPLO, 'utf8'))
  doc.parametros.tampa = { expr: '1' }
  doc.expostos = [
    { parametro: 'L', rotulo: 'Comprimento', tipo: 'numero', min: 40, max: 120, passo: 5 },
    { parametro: 'H', rotulo: 'Altura', tipo: 'lista', opcoes: [{ rotulo: '20', valor: 20 }, { rotulo: '30', valor: 30 }, { rotulo: '40', valor: 40 }] },
    { parametro: 'tampa', rotulo: 'Com tampa', tipo: 'sim-nao' },
  ]
  return doc
}

test('lerHash: ativo, projeto decodificado e valores', () => {
  const r = lerHash('#customizar&projeto=https%3A%2F%2Fx.com%2Fa.json&L=90&H=40')
  assert.equal(r.ativo, true)
  assert.equal(r.projeto, 'https://x.com/a.json')
  assert.deepEqual(r.valores, { L: '90', H: '40' })
})

test('lerHash: sem customizar fica inativo; chaves vazias, proibidas e pares malformados são ignorados', () => {
  assert.equal(lerHash('#outro&L=1').ativo, false)
  assert.equal(lerHash('').ativo, false)
  const r = lerHash('#customizar&=5&__proto__=1&L=90&X=%E0%A4%A')
  assert.deepEqual(r.valores, { L: '90' })
  assert.equal(r.projeto, undefined)
})

test('origemUrl: https e localhost liberados; resto recusado', () => {
  assert.deepEqual(origemUrl('https://tecpet.com/p.json'), { ok: true, host: 'tecpet.com' })
  assert.deepEqual(origemUrl('http://localhost:8080/x.json'), { ok: true, host: 'localhost:8080' })
  assert.deepEqual(origemUrl('http://127.0.0.1/x.json'), { ok: true, host: '127.0.0.1' })
  assert.deepEqual(origemUrl('http://exemplo.com/x.json'), { ok: false, motivo: 'insegura' })
  assert.deepEqual(origemUrl('javascript:alert(1)'), { ok: false, motivo: 'insegura' })
  assert.deepEqual(origemUrl('nao e url'), { ok: false, motivo: 'invalida' })
})

test('validaRemoto: documento válido passa; {} e texto grande falham', () => {
  const doc = base()
  assert.deepEqual(validaRemoto(JSON.stringify(doc)), doc)
  assert.throws(() => validaRemoto('{}'), Error)
  assert.throws(() => validaRemoto(' '.repeat(5_000_001)), /grande/)
  assert.throws(() => validaRemoto('{nao json'), /JSON invalido/)
})

test('validaRemoto: recusa __proto__, constructor e prototype em qualquer nível', () => {
  const doc = base()
  assert.throws(() => validaRemoto(`{"__proto__":{"x":1},${JSON.stringify(doc).slice(1)}`), /chave proibida/)
  const aninhado = JSON.stringify(doc).replace('"nome"', '"constructor":{"prototype":{"a":1}},"nome"')
  assert.throws(() => validaRemoto(aninhado), /chave proibida/)
})

test('valoresAtuais: valores avaliados; falha de avaliação vira NaN', () => {
  const doc = base()
  assert.deepEqual(valoresAtuais(doc), { L: 80, H: 30, tampa: 1 })
  doc.parametros.H = { expr: '1/0' }
  assert.ok(Number.isNaN(valoresAtuais(doc).H))
})

test('aplicaValores: valor dentro do passo passa sem aviso', () => {
  const r = aplicaValores(base(), { L: '90' })
  assert.deepEqual(r.avisos, [])
  assert.equal(r.doc.parametros.L.expr, '90')
})

test('aplicaValores: arredonda ao passo a partir do mínimo', () => {
  const r = aplicaValores(base(), { L: '93' })
  assert.deepEqual(r.avisos, [{ tipo: 'ajustado', parametro: 'L', valor: '93', final: 95 }])
  assert.equal(r.doc.parametros.L.expr, '95')
})

test('aplicaValores: limita ao máximo e ao mínimo', () => {
  const alto = aplicaValores(base(), { L: '999' })
  assert.deepEqual(alto.avisos, [{ tipo: 'ajustado', parametro: 'L', valor: '999', final: 120 }])
  assert.equal(alto.doc.parametros.L.expr, '120')
  const baixo = aplicaValores(base(), { L: '10' })
  assert.deepEqual(baixo.avisos, [{ tipo: 'ajustado', parametro: 'L', valor: '10', final: 40 }])
})

test('aplicaValores: número inválido e lista fora das opções são recusados', () => {
  const a = aplicaValores(base(), { L: 'abc', H: '25' })
  assert.deepEqual(a.avisos, [
    { tipo: 'invalido', parametro: 'L', valor: 'abc' },
    { tipo: 'invalido', parametro: 'H', valor: '25' },
  ])
  assert.equal(a.doc.parametros.L.expr, '80')
  assert.equal(a.doc.parametros.H.expr, '30')
  assert.equal(aplicaValores(base(), { H: '40' }).doc.parametros.H.expr, '40')
})

test('aplicaValores: sim-nao aceita sim/nao/1/0 e recusa o resto', () => {
  assert.equal(aplicaValores(base(), { tampa: 'sim' }).doc.parametros.tampa.expr, '1')
  assert.equal(aplicaValores(base(), { tampa: 'não' }).doc.parametros.tampa.expr, '0')
  assert.equal(aplicaValores(base(), { tampa: 'false' }).doc.parametros.tampa.expr, '0')
  assert.deepEqual(aplicaValores(base(), { tampa: 'talvez' }).avisos, [{ tipo: 'invalido', parametro: 'tampa', valor: 'talvez' }])
})

test('aplicaValores: parâmetro fora dos expostos é desconhecido e ignorado; original intacto', () => {
  const doc = base()
  const antes = structuredClone(doc)
  const r = aplicaValores(doc, { X: '1' })
  assert.deepEqual(r.avisos, [{ tipo: 'desconhecido', parametro: 'X', valor: '1' }])
  assert.equal(Object.hasOwn(r.doc.parametros, 'X'), false)
  aplicaValores(doc, { L: '90', H: '40' })
  assert.deepEqual(doc, antes)
})

test('hashDeValores: com projeto, valores atuais e no máximo 6 casas', () => {
  const doc = base()
  assert.equal(hashDeValores(doc, 'https://a.b/c.json'), `#customizar&projeto=${encodeURIComponent('https://a.b/c.json')}&L=80&H=30&tampa=1`)
  assert.equal(hashDeValores(doc), '#customizar&L=80&H=30&tampa=1')
  doc.parametros.L = { expr: '80.1234567' }
  assert.equal(hashDeValores(doc), '#customizar&L=80.123457&H=30&tampa=1')
  const volta = lerHash(hashDeValores(base(), 'https://a.b/c.json'))
  assert.equal(volta.projeto, 'https://a.b/c.json')
  assert.deepEqual(volta.valores, { L: '80', H: '30', tampa: '1' })
})

test('agrupa: por grupo na ordem de aparição; sem grupo = ""', () => {
  const e = (parametro: string, grupo?: string) => ({ parametro, rotulo: parametro, tipo: 'numero' as const, grupo })
  const r = agrupa([e('a', 'X'), e('b'), e('c', 'X'), e('d', 'Y')])
  assert.deepEqual(r.map(g => g.grupo), ['X', '', 'Y'])
  assert.deepEqual(r[0].itens.map(i => i.parametro), ['a', 'c'])
  assert.deepEqual(r[1].itens.map(i => i.parametro), ['b'])
})
