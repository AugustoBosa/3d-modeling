import { test } from 'node:test'
import assert from 'node:assert/strict'
import { novoDocumento } from '@3dm/core/doc'
import { criaProjeto } from '../src/projeto.ts'
import { registraBasicos } from '../src/linha/basicos.ts'
import { criaRegistro, criaSessao } from '../src/linha/registro.ts'

function monta() {
  const reg = criaRegistro(), projeto = criaProjeto(novoDocumento()), saida: string[] = []
  registraBasicos(reg, projeto)
  const s = criaSessao(reg, (t, tipo) => saida.push(`${tipo}:${t}`))
  return { reg, projeto, saida, s }
}

test('alias resolve sem diferenciar maiúsculas; última definição vale; sugere por prefixo', () => {
  const { reg } = monta()
  assert.equal(reg.resolve('param')?.nome, 'PARAM')
  assert.equal(reg.resolve('u')?.nome, 'DESFAZER')
  assert.equal(reg.resolve('zzz'), undefined)
  assert.deepEqual(reg.sugere('pa'), ['PAR', 'PARAM'])
  assert.deepEqual(reg.sugere(''), [])
  reg.registra({ nome: 'OUTRO', aliases: ['U'], descricao: '', executa() {} })
  assert.equal(reg.resolve('U')?.nome, 'OUTRO')
})

test('PARAM com perguntas, desfazer pelo U e refazer pelo REDO', async () => {
  const { projeto, s } = monta(), L = () => projeto.doc.parametros.L as { expr: string } | undefined
  const p = s.envia('PARAM')
  assert.match(s.pendente ?? '', /Nome/)
  await s.envia('L')
  assert.match(s.pendente ?? '', /Expressão/)
  await s.envia('80 / 2')
  await p
  assert.equal(s.pendente, null)
  assert.equal(L()?.expr, '80 / 2')
  await s.envia('u')
  assert.equal(L(), undefined)
  await s.envia('redo')
  assert.equal(L()?.expr, '80 / 2')
})

test('argumentos colados na mesma linha respondem as perguntas', async () => {
  const { projeto, s } = monta()
  await s.envia('PARAM W 2 * parede')
  assert.equal(projeto.doc.parametros.W.expr, '2 * parede')
})

test('linha vazia repete o último comando; sem último não faz nada', async () => {
  const { projeto, s, saida } = monta()
  await s.envia('')
  assert.deepEqual(saida, [])
  await s.envia('PARAM A 1')
  const p = s.envia('') // repete PARAM, agora perguntando
  assert.ok(s.pendente)
  await s.envia('B'); await s.envia('2'); await p
  assert.equal(projeto.doc.parametros.B.expr, '2')
})

test('Esc cancela a pergunta sem alterar o documento', async () => {
  const { projeto, s, saida } = monta()
  const p = s.envia('PARAM')
  s.cancela()
  await p
  assert.equal(s.pendente, null)
  assert.deepEqual(projeto.doc.parametros, {})
  assert.ok(saida.some(l => l.includes('Cancelado')))
})

test('erros: comando desconhecido e nome inválido avisam com causa e correção', async () => {
  const { projeto, s, saida } = monta()
  await s.envia('XYZ')
  assert.ok(saida.some(l => l.startsWith('erro:') && l.includes('XYZ')))
  await s.envia('PARAM 9x 1')
  assert.ok(saida.some(l => l.startsWith('erro:') && l.includes('9x')))
  assert.deepEqual(projeto.doc.parametros, {})
})

test('defineAlias aponta alias para comando por nome ou alias; lista devolve comandos únicos', () => {
  const { reg } = monta()
  const n = reg.lista().length
  assert.equal(reg.defineAlias('LL', 'linha'), false)
  assert.equal(reg.defineAlias('LL', 'PARAM'), true)
  assert.equal(reg.resolve('ll')?.nome, 'PARAM')
  assert.equal(reg.defineAlias('X1', 'PAR'), true)
  assert.equal(reg.resolve('X1')?.nome, 'PARAM')
  assert.equal(reg.lista().length, n)
  assert.equal(reg.lista()[0].nome, 'PARAM')
})

test('Ctrl+Z / Ctrl+Y: o comando-teste passa pela pilha do projeto', async () => {
  const { projeto, s } = monta()
  await s.envia('PARAM A 1')
  await s.envia('PARAM A 2')
  assert.equal(projeto.doc.parametros.A.expr, '2')
  projeto.desfaz()
  assert.equal(projeto.doc.parametros.A.expr, '1')
  projeto.refaz()
  assert.equal(projeto.doc.parametros.A.expr, '2')
})
