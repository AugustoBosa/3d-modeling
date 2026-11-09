// Comandos da F0: PARAM (comando-teste com undo), U e REDO. Os de desenho chegam na F1 (packages/app/src/comandos/).
import { definirParametro, NOME_PARAMETRO } from '@3dm/core/doc'
import type { Projeto } from '../projeto.ts'
import { T } from '../textos.ts'
import type { Registro } from './registro.ts'

export function registraBasicos(reg: Registro, projeto: Projeto) {
  reg.registra({
    nome: 'PARAM', aliases: ['PAR'], descricao: T.cmd.param,
    async executa(c) {
      const nome = await c.pergunta(T.cmd.paramNome)
      if (nome === null) return
      if (!NOME_PARAMETRO.test(nome)) return c.escreve(T.cmd.paramNomeInvalido(nome), 'erro')
      const expr = await c.pergunta(T.cmd.paramExpr, true)
      if (expr === null) return
      if (!expr) return c.escreve(T.cmd.paramExprVazia, 'erro')
      projeto.executa(definirParametro(nome, expr))
      c.escreve(T.cmd.paramOk(nome, expr), 'info')
    },
  })
  reg.registra({
    nome: 'DESFAZER', aliases: ['U'], descricao: T.cmd.desfazer,
    executa(c) {
      const x = projeto.desfaz()
      c.escreve(x ? T.linha.desfeito(x.nome) : T.linha.nada, 'info')
    },
  })
  reg.registra({
    nome: 'REFAZER', aliases: ['REDO'], descricao: T.cmd.refazer,
    executa(c) {
      const x = projeto.refaz()
      c.escreve(x ? T.linha.refeito(x.nome) : T.linha.nadaRefazer, 'info')
    },
  })
}
