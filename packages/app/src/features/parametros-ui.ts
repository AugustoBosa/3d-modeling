// Tabela de parâmetros (painel esquerdo, DOM à mão). Edições passam por Projeto.executa; a lógica pura está em executaEdicao e formataValor.
import { definirParametroCompleto, removeParametro, renomeiaParametro, tabelaParametros, usoDoParametro, type LinhaParametro } from '@3dm/core/features'
import type { Comando, Documento } from '@3dm/core/doc'
import type { Projeto } from '../projeto.ts'
import { el, botao } from '../ui.ts'
import { T } from '../textos.ts'

export type CampoEdicao = 'nome' | 'expr' | 'unidade' | 'comentario'
export type ResultadoEdicao = { ok: true } | { ok: false; erro: string }

const CAMPOS: CampoEdicao[] = ['nome', 'expr', 'unidade', 'comentario']
const mensagem = (e: unknown): string => e instanceof Error ? e.message : T.parametros.erroDesconhecido

/** Valor com até 4 casas, sem zeros à direita; sem valor, mostra o erro. */
export function formataValor(valor: number | null, erro: string | null): string {
  if (erro) return erro
  if (valor === null) return ''
  return String(Number(valor.toFixed(4)))
}

/** Roda o comando de edição do campo. Em 'nome', `valor` é o nome novo. Os outros campos gravam o parâmetro inteiro (cria se não existe). */
export function executaEdicao(projeto: Projeto, campo: CampoEdicao, nome: string, valor: string): ResultadoEdicao {
  try {
    const p = projeto.doc.parametros[nome]
    let c: Comando<Documento>
    if (campo === 'nome') c = renomeiaParametro(nome, valor)
    else if (campo === 'expr') c = definirParametroCompleto(nome, { expr: valor, unidade: p?.unidade, comentario: p?.comentario })
    else if (campo === 'unidade') c = definirParametroCompleto(nome, { expr: p?.expr ?? '', unidade: valor, comentario: p?.comentario })
    else c = definirParametroCompleto(nome, { expr: p?.expr ?? '', unidade: p?.unidade, comentario: valor })
    projeto.executa(c)
    return { ok: true }
  } catch (e) {
    return { ok: false, erro: mensagem(e) }
  }
}

const valorDoCampo = (l: LinhaParametro, c: CampoEdicao): string =>
  c === 'nome' ? l.nome : c === 'expr' ? l.expr : c === 'unidade' ? l.unidade : l.comentario

interface LinhaUI {
  tr: HTMLTableRowElement
  nome: string
  campos: Record<CampoEdicao, HTMLInputElement>
  valor: HTMLTableCellElement
  erroEdicao: string | null
}

export function criaTabelaParametros(host: HTMLElement, projeto: Projeto, aviso: (texto: string, erro?: boolean) => void): { atualiza(): void } {
  const tabela = el('table', { id: 'tabela-parametros', class: 'tabela-parametros' })
  const cabeca = el('tr', {}, ...[T.parametros.colunas.nome, T.parametros.colunas.expr, T.parametros.colunas.valor, T.parametros.colunas.unidade, T.parametros.colunas.comentario].map(t => el('th', { textContent: t })), el('th'))
  const corpo = el('tbody')
  const rodape = el('tfoot')
  tabela.append(el('thead', {}, cabeca), corpo, rodape)
  host.replaceChildren(tabela)

  const porNome = new Map<string, LinhaUI>()

  // Parâmetro atual da linha (pode ter sido renomeado por outra via, então busca pelo nome guardado).
  const atual = (ui: LinhaUI): LinhaParametro =>
    tabelaParametros(projeto.doc).find(l => l.nome === ui.nome) ?? { nome: ui.nome, expr: '', valor: null, erro: null, unidade: 'mm', comentario: '', ciclo: false }

  function confirma(ui: LinhaUI, campo: CampoEdicao, input: HTMLInputElement) {
    const novo = input.value.trim()
    const antes = valorDoCampo(atual(ui), campo)
    if (novo === antes) return
    ui.erroEdicao = null
    const r = executaEdicao(projeto, campo, ui.nome, novo)
    if (r.ok) return // Projeto.executa dispara aoMudar, que chama atualiza()
    ui.erroEdicao = r.erro
    input.value = antes
    ui.valor.textContent = r.erro
    ui.valor.classList.add('erro')
    aviso(r.erro, true)
  }

  function celulaEditavel(ui: LinhaUI, campo: CampoEdicao): HTMLInputElement {
    const ph = campo === 'nome' ? T.parametros.placeholder.nome : campo === 'expr' ? T.parametros.placeholder.expr : campo === 'unidade' ? T.parametros.placeholder.unidade : T.parametros.placeholder.comentario
    const input = el('input', { type: 'text', class: `pm-celula pm-${campo}`, placeholder: ph, title: T.parametros.dicaEdita, ariaLabel: T.parametros.colunas[campo] })
    let cancela = false
    input.onkeydown = e => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur() }
      else if (e.key === 'Escape') { e.preventDefault(); cancela = true; input.blur() }
    }
    input.onblur = () => {
      if (!input.isConnected) return // linha já removida pela atualização
      if (cancela) { cancela = false; input.value = valorDoCampo(atual(ui), campo); return }
      confirma(ui, campo, input)
    }
    return input
  }

  function excluiParametro(nome: string) {
    const usos = usoDoParametro(projeto.doc, nome)
    if (usos.length) { aviso(T.parametros.usadoEm(nome, usos), true); return }
    try { projeto.executa(removeParametro(nome)) } catch (e) { aviso(mensagem(e), true) }
  }

  function criaLinha(nome: string): LinhaUI {
    const ui = { nome, erroEdicao: null } as LinhaUI
    ui.valor = el('td', { class: 'pm-valor' })
    ui.campos = { nome: celulaEditavel(ui, 'nome'), expr: celulaEditavel(ui, 'expr'), unidade: celulaEditavel(ui, 'unidade'), comentario: celulaEditavel(ui, 'comentario') }
    const excluir = botao(T.parametros.excluirSimbolo, () => excluiParametro(ui.nome), T.parametros.excluir)
    excluir.classList.add('pm-excluir')
    ui.tr = el('tr', {},
      el('td', {}, ui.campos.nome), el('td', {}, ui.campos.expr), ui.valor,
      el('td', {}, ui.campos.unidade), el('td', {}, ui.campos.comentario), el('td', {}, excluir))
    return ui
  }

  function preenche(ui: LinhaUI, l: LinhaParametro) {
    ui.nome = l.nome
    ui.tr.classList.toggle('ciclo', l.ciclo)
    ui.tr.title = l.ciclo ? T.parametros.ciclo : ''
    for (const c of CAMPOS) {
      const input = ui.campos[c]
      if (document.activeElement !== input) input.value = valorDoCampo(l, c)
    }
    const msg = ui.erroEdicao ?? l.erro
    ui.valor.textContent = msg ?? formataValor(l.valor, null)
    ui.valor.classList.toggle('erro', !!msg)
  }

  // Linha de criação (nome + expressão + Adicionar), no rodapé.
  const novoNome = el('input', { type: 'text', class: 'pm-celula pm-nome', placeholder: T.parametros.placeholder.nome, ariaLabel: T.parametros.colunas.nome })
  const novaExpr = el('input', { type: 'text', class: 'pm-celula pm-expr', placeholder: T.parametros.placeholder.expr, ariaLabel: T.parametros.colunas.expr })
  const adiciona = () => {
    const r = executaEdicao(projeto, 'expr', novoNome.value.trim(), novaExpr.value.trim())
    if (!r.ok) { aviso(r.erro, true); return }
    novoNome.value = ''
    novaExpr.value = ''
    novoNome.focus()
  }
  const enterAdiciona = (e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); adiciona() } }
  novoNome.onkeydown = enterAdiciona
  novaExpr.onkeydown = enterAdiciona
  rodape.append(el('tr', { class: 'pm-novo' },
    el('td', {}, novoNome), el('td', {}, novaExpr), el('td', { colSpan: 2 }), el('td', {}, botao(T.parametros.adicionar, adiciona, T.parametros.adicionarDica))))

  function atualiza() {
    const linhas = tabelaParametros(projeto.doc)
    const nomes = new Set(linhas.map(l => l.nome))
    for (const [nome, ui] of porNome) if (!nomes.has(nome)) { ui.tr.remove(); porNome.delete(nome) }
    linhas.forEach((l, i) => {
      let ui = porNome.get(l.nome)
      if (!ui) { ui = criaLinha(l.nome); porNome.set(l.nome, ui) }
      preenche(ui, l)
      if (corpo.rows[i] !== ui.tr) corpo.insertBefore(ui.tr, corpo.rows[i] ?? null)
    })
  }

  projeto.aoMudar(atualiza)
  atualiza()
  return { atualiza }
}
