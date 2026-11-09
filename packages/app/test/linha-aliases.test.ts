import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criaRegistro, type Registro } from '../src/linha/registro.ts'
import { aplicaAliases, leAliases, parseAliases, resolveDefs, salvaAliases, serializaAliases } from '../src/linha/aliases.ts'

function fake(): Registro {
  const reg = criaRegistro()
  for (const nome of ['LINHA', 'CIRCULO', 'PARAM']) reg.registra({ nome, aliases: [], descricao: '', executa() {} })
  reg.registra({ nome: 'DESFAZER', aliases: ['U'], descricao: '', executa() {} })
  return reg
}

test('round-trip: serializa e lê de volta o mesmo conteúdo', () => {
  const defs = [{ alias: 'L', comando: 'LINHA' }, { alias: 'CI', comando: 'CIRCULO' }]
  const texto = serializaAliases(defs)
  assert.equal(texto, 'L, *LINHA\nCI, *CIRCULO')
  assert.deepEqual(parseAliases(texto), { defs, erros: [] })
})

test('última definição vale: L, *LINHA depois L, *CIRCULO', () => {
  const { defs } = parseAliases('L, *LINHA\nL, *CIRCULO')
  assert.deepEqual(resolveDefs(defs), [{ alias: 'L', comando: 'CIRCULO' }])
  const reg = fake()
  assert.deepEqual(aplicaAliases(reg, defs), { aplicados: 1, erros: [] })
  assert.equal(reg.resolve('l')?.nome, 'CIRCULO')
})

test('comentário com ; e linhas vazias são ignorados; maiúsculas normalizadas', () => {
  const r = parseAliases('; meus aliases\n\n  l ,  *linha   ; comentário\n   \n')
  assert.deepEqual(r, { defs: [{ alias: 'L', comando: 'LINHA' }], erros: [] })
})

test('linha inválida vira erro com número e texto; as válidas continuam', () => {
  const r = parseAliases('XX LINHA\nL, LINHA\nLI NHA, *LINHA\nC, *CIRCULO')
  assert.deepEqual(r.defs, [{ alias: 'C', comando: 'CIRCULO' }])
  assert.deepEqual(r.erros, [
    { linha: 1, texto: 'XX LINHA' },
    { linha: 2, texto: 'L, LINHA' },
    { linha: 3, texto: 'LI NHA, *LINHA' },
  ])
})

test('alias sobrescreve outro comando (U passa a ser LINHA)', () => {
  const reg = fake()
  assert.equal(reg.resolve('U')?.nome, 'DESFAZER')
  aplicaAliases(reg, parseAliases('U, *LINHA').defs)
  assert.equal(reg.resolve('U')?.nome, 'LINHA')
})

test('aplica no registro fake: comando inexistente vira erro, não lança', () => {
  const reg = fake()
  const r = aplicaAliases(reg, parseAliases('P, *PARAMETRO\nP2, *PARAM\nAA, *LINHA').defs)
  assert.deepEqual(r, { aplicados: 2, erros: [{ alias: 'P', comando: 'PARAMETRO' }] })
  assert.equal(reg.resolve('P2')?.nome, 'PARAM')
  assert.equal(reg.resolve('P'), undefined)
})

test('leAliases e salvaAliases: texto salvo, e armazenamento quebrado não lança', () => {
  const mem = new Map<string, string>()
  const arm = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) }
  assert.equal(leAliases(arm), '')
  salvaAliases('L, *LINHA', arm)
  assert.equal(mem.get('3dm.aliases'), 'L, *LINHA')
  assert.equal(leAliases(arm), 'L, *LINHA')
  const quebrado = { getItem() { throw new Error('bloqueado') }, setItem() { throw new Error('cheio') } }
  assert.equal(leAliases(quebrado), '')
  assert.doesNotThrow(() => salvaAliases('x', quebrado))
})
