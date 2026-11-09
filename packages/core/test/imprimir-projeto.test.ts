import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { criaPilha, definirParametro, lerDocumento, novoDocumento, valida, type Comando, type Documento } from '../src/doc/index.ts'
import { definirFilamento, definirSlotCorpo, definirSlotTabela, exporParametro, removerExposto } from '../src/imprimir/index.ts'

/** Executa, confere o efeito, desfaz e confere que voltou ao estado anterior (byte a byte no deepEqual). */
function ida_e_volta(d: Documento, c: Comando<Documento>, confere: (d: Documento) => void) {
  const antes = structuredClone(d)
  c.fazer(d)
  confere(d)
  c.desfazer(d)
  assert.deepEqual(d, antes)
}

test('definirFilamento seta, troca e remove', () => {
  const d = novoDocumento()
  ida_e_volta(d, definirFilamento('pla-basico'), x => assert.equal(x.filamento, 'pla-basico'))
  d.filamento = 'petg'
  ida_e_volta(d, definirFilamento(null), x => assert.equal(x.filamento, undefined))
  ida_e_volta(d, definirFilamento('abs'), x => assert.equal(x.filamento, 'abs'))
})

test('definirSlotCorpo mantém a cor e usa padrão quando o corpo não tem', () => {
  const d = novoDocumento()
  ida_e_volta(d, definirSlotCorpo('ex1', 3), x => assert.deepEqual(x.aparencia.ex1, { cor: '#b8b4ac', slot: 3 }))
  d.aparencia.ex1 = { cor: '#ff0000' }
  ida_e_volta(d, definirSlotCorpo('ex1', 16), x => assert.deepEqual(x.aparencia.ex1, { cor: '#ff0000', slot: 16 }))
})

test('definirSlotCorpo recusa slot fora de 1-16', () => {
  assert.throws(() => definirSlotCorpo('ex1', 0), /slot inválido/)
  assert.throws(() => definirSlotCorpo('ex1', 17), /slot inválido/)
  assert.throws(() => definirSlotCorpo('ex1', 1.5), /slot inválido/)
})

test('definirSlotTabela grava, troca e remove uma linha da tabela', () => {
  const d = novoDocumento()
  ida_e_volta(d, definirSlotTabela(1, { filamento: 'pla-basico', cor: '#ffffff' }), x => assert.deepEqual(x.slots, { '1': { filamento: 'pla-basico', cor: '#ffffff' } }))
  d.slots = { '1': { filamento: 'pla-basico', cor: '#ffffff' } }
  ida_e_volta(d, definirSlotTabela(1, null), x => assert.deepEqual(x.slots, {}))
  ida_e_volta(d, definirSlotTabela(2, { filamento: 'petg', cor: '#000000' }), x => assert.deepEqual(x.slots?.['2'], { filamento: 'petg', cor: '#000000' }))
})

test('exporParametro adiciona, substitui pelo mesmo parâmetro e recusa parâmetro inexistente', () => {
  const d = novoDocumento()
  definirParametro('L', '80').fazer(d)
  const e1 = { parametro: 'L', rotulo: 'Comprimento', tipo: 'numero' as const, min: 10, max: 200 }
  ida_e_volta(d, exporParametro(e1), x => assert.deepEqual(x.expostos, [e1]))
  d.expostos = [{ parametro: 'L', rotulo: 'Antigo', tipo: 'numero' }]
  ida_e_volta(d, exporParametro(e1), x => assert.deepEqual(x.expostos, [e1]))

  const naoExiste = exporParametro({ parametro: 'X', rotulo: 'X', tipo: 'numero' })
  assert.throws(() => naoExiste.fazer(d), /não existe/)
  assert.equal(d.expostos?.length, 1)
})

test('exporParametro recusa min > max e lista sem opções', () => {
  assert.throws(() => exporParametro({ parametro: 'L', rotulo: 'L', tipo: 'numero', min: 5, max: 1 }), /min maior que max/)
  assert.throws(() => exporParametro({ parametro: 'L', rotulo: 'L', tipo: 'lista' }), /lista sem opções/)
})

test('removerExposto remove e desfaz', () => {
  const d = novoDocumento()
  definirParametro('L', '80').fazer(d)
  exporParametro({ parametro: 'L', rotulo: 'L', tipo: 'sim-nao' }).fazer(d)
  ida_e_volta(d, removerExposto('L'), x => assert.deepEqual(x.expostos, []))
  ida_e_volta(d, removerExposto('nao-existe'), x => assert.deepEqual(x.expostos, [{ parametro: 'L', rotulo: 'L', tipo: 'sim-nao' }]))
})

test('comandos entram na pilha de undo/redo', () => {
  const d = novoDocumento()
  const p = criaPilha(d)
  p.executa(definirFilamento('petg'))
  p.executa(definirSlotCorpo('ex1', 2))
  p.desfaz()
  assert.equal(d.aparencia.ex1, undefined)
  p.refaz()
  assert.deepEqual(d.aparencia.ex1, { cor: '#b8b4ac', slot: 2 })
})

test('valida aceita os campos novos e recusa os inválidos', () => {
  const d = novoDocumento()
  d.filamento = 'petg'
  d.slots = { '1': { filamento: 'pla-basico', cor: '#ffffff' } }
  d.expostos = [{ parametro: 'L', rotulo: 'Comprimento', tipo: 'numero', min: 1, max: 2 }]
  d.aparencia.ex1 = { cor: '#b8b4ac', slot: 16 }
  assert.deepEqual(valida(d), [])

  const ok = structuredClone(d) as unknown as Record<string, unknown>
  assert.match(valida({ ...ok, filamento: 3 }).join(), /filamento/)
  assert.match(valida({ ...ok, slots: { '1': { cor: 3 } } }).join(), /slots "1"/)
  assert.match(valida({ ...ok, expostos: [{ parametro: 'L', rotulo: 'L', tipo: 'xyz' }] }).join(), /expostos\[0\]/)
  assert.match(valida({ ...ok, aparencia: { ex1: { cor: '#fff', slot: 17 } } }).join(), /slot deve ser inteiro de 1 a 16/)
  assert.match(valida({ ...ok, aparencia: { ex1: { cor: '#fff', slot: 0 } } }).join(), /slot deve ser/)
})

test('exemplo caixa-com-tampa continua válido', () => {
  const texto = readFileSync(new URL('../../../examples/caixa-com-tampa.3dm.json', import.meta.url), 'utf8')
  assert.doesNotThrow(() => lerDocumento(texto))
})
