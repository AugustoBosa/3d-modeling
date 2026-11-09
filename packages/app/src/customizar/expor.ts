// Painel "Parâmetros expostos" (modo editor): lista os expostos, expõe um parâmetro e copia o link do modo customizar.
import type { Exposto } from '@3dm/core/doc'
import { exporParametro, removerExposto } from '@3dm/core/imprimir'
import type { Projeto } from '../projeto.ts'
import { T } from '../textos.ts'
import { botao, campo, el, secao } from '../ui.ts'
import { ErroOpcoes, parseOpcoes } from './modo.ts'
import { hashDeValores } from './schema.ts'

const msg = (err: unknown): string => err instanceof Error ? err.message : String(err)
const numOuUndef = (s: string): number | undefined => s.trim() === '' ? undefined : Number(s)

function textoErro(err: unknown): string {
  if (!(err instanceof ErroOpcoes)) return msg(err)
  return err.codigo === 'vazio' ? T.customizar.opcoesVazias : T.customizar.opcaoInvalida(err.linha)
}

export function criaExpor(host: HTMLElement, projeto: Projeto, aviso: (t: string, erro?: boolean) => void): { atualiza(): void } {
  const corpo = secao(host, T.customizar.expostosTitulo)
  corpo.className = 'expor'
  const lista = el('ul', { class: 'lista' })
  const semExpostos = el('p', { class: 'nota', textContent: T.customizar.semExpostos })

  const nomes = el('select')
  const semParametros = el('p', { class: 'nota', textContent: T.customizar.semParametros, hidden: true })
  const rotulo = el('input', { type: 'text' })
  const tipo = el('select')
  tipo.append(...Object.entries(T.customizar.tipos).map(([v, t]) => new Option(t, v)))
  const min = el('input', { type: 'number', step: 'any' })
  const max = el('input', { type: 'number', step: 'any' })
  const passo = el('input', { type: 'number', step: 'any' })
  const numericos = el('div', {}, campo(T.customizar.min, min), campo(T.customizar.max, max), campo(T.customizar.passo, passo))
  const opcoes = el('textarea', { rows: 4 })
  const opcoesCampo = el('label', {}, T.customizar.opcoes, opcoes)
  const grupo = el('input', { type: 'text' })
  const salvar = botao(T.customizar.salvar, () => salva())
  const formulario = el('div', { class: 'expor-form' },
    semParametros,
    campo(T.customizar.parametro, nomes),
    campo(T.customizar.rotulo, rotulo),
    campo(T.customizar.tipo, tipo),
    numericos,
    opcoesCampo,
    campo(T.customizar.grupo, grupo),
    el('div', { class: 'acoes' }, salvar, botao(T.customizar.link, () => { void copiaLink() })))
  const ajustaTipo = () => {
    numericos.hidden = tipo.value !== 'numero'
    opcoesCampo.hidden = tipo.value !== 'lista'
  }
  tipo.onchange = ajustaTipo
  ajustaTipo()

  function item(e: Exposto): HTMLLIElement {
    return el('li', {}, el('span', { textContent: `${e.rotulo} (${e.parametro})` }), botao(T.customizar.remover, () => remove(e.parametro)))
  }

  function remove(nome: string) {
    try { projeto.executa(removerExposto(nome)); atualiza() }
    catch (err) { aviso(msg(err), true) }
  }

  function salva() {
    try {
      const t = tipo.value as Exposto['tipo']
      const e: Exposto = { parametro: nomes.value, rotulo: rotulo.value.trim() || nomes.value, tipo: t }
      const g = grupo.value.trim()
      if (g) e.grupo = g
      if (t === 'numero') Object.assign(e, { min: numOuUndef(min.value), max: numOuUndef(max.value), passo: numOuUndef(passo.value) })
      if (t === 'lista') e.opcoes = parseOpcoes(opcoes.value)
      projeto.executa(exporParametro(e))
      atualiza()
    } catch (err) {
      aviso(textoErro(err), true)
    }
  }

  async function copiaLink() {
    const url = location.origin + location.pathname + hashDeValores(projeto.doc)
    try {
      await navigator.clipboard.writeText(url)
      aviso(T.customizar.linkCopiado)
    } catch {
      aviso(T.customizar.linkFalhou, true)
    }
  }

  function atualiza() {
    const expostos = projeto.doc.expostos ?? []
    lista.replaceChildren(...expostos.map(item))
    semExpostos.hidden = expostos.length > 0
    const nomesDoc = Object.keys(projeto.doc.parametros)
    const antes = nomes.value
    nomes.replaceChildren(...nomesDoc.map(n => new Option(n, n)))
    nomes.value = antes
    semParametros.hidden = nomesDoc.length > 0
    salvar.disabled = nomesDoc.length === 0
  }

  corpo.append(lista, semExpostos, el('h3', { textContent: T.customizar.expor }), formulario)
  atualiza()
  return { atualiza }
}
