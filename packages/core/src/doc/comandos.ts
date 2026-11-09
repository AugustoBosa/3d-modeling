import type { Comando } from './pilha.ts'
import type { Documento } from './tipos.ts'
import { NOME_PARAMETRO } from './doc.ts'

/** Cria ou altera um parâmetro. Desfazer devolve o valor anterior (ou apaga, se não existia). */
export function definirParametro(nome: string, expr: string): Comando<Documento> {
  if (!NOME_PARAMETRO.test(nome)) throw new Error(`nome de parâmetro inválido: "${nome}"`)
  let antes: { expr: string } | undefined
  return {
    nome: `PARAM ${nome}`,
    fazer(d) { antes = d.parametros[nome]; d.parametros[nome] = { expr } },
    desfazer(d) { if (antes) d.parametros[nome] = antes; else delete d.parametros[nome] },
  }
}

/** Troca o perfil de impressora ativo. */
export function definirImpressora(id: string): Comando<Documento> {
  let antes = ''
  return {
    nome: `IMPRESSORA ${id}`,
    fazer(d) { antes = d.impressora; d.impressora = id },
    desfazer(d) { d.impressora = antes },
  }
}
