// Cartão de atalhos pesquisável (F1, PROJETO_BASE §6.17). <dialog> nativo; a lista vem de linhasAjuda e filtra.
import { botao, el } from '../ui.ts'
import type { Registro } from '../linha/registro.ts'
import { T } from '../textos.ts'
import { filtra, linhasAjuda } from './dados.ts'

export function criaCartaoAjuda(reg: Registro): { abre(): void } {
  const linhas = linhasAjuda(reg)
  const campo = el('input', { type: 'search', placeholder: T.ajuda.cartao.busca, id: 'ajuda-busca' })
  const corpo = el('tbody')
  const vazio = el('p', { class: 'nota', textContent: T.ajuda.cartao.nenhum, hidden: true })
  const tabela = el('table', {},
    el('thead', {}, el('tr', {}, ...[T.ajuda.colunas.comando, T.ajuda.colunas.alias, T.ajuda.colunas.atalho, T.ajuda.colunas.descricao].map(t => el('th', { textContent: t })))),
    corpo)

  function mostra() {
    const achados = filtra(linhas, campo.value)
    corpo.replaceChildren(...achados.map(l => el('tr', {},
      el('td', { textContent: l.nome }), el('td', { textContent: l.alias }), el('td', { textContent: l.atalho }), el('td', { textContent: l.descricao }))))
    vazio.hidden = achados.length > 0
  }
  campo.addEventListener('input', mostra)

  const d = el('dialog', { class: 'ajuda cartao' },
    el('h2', { textContent: T.ajuda.cartao.titulo }), campo,
    el('div', { class: 'ajuda-tabela' }, tabela), vazio,
    botao(T.ajuda.cartao.fechar, () => d.close()))
  d.addEventListener('click', e => { if (e.target === d) d.close() }) // clique no fundo fecha
  d.addEventListener('keydown', e => { // Esc fecha sem chegar ao atalhos.ts (que cancela comando)
    if (e.key !== 'Escape') return
    e.preventDefault(); e.stopPropagation(); d.close()
  })
  document.body.append(d)

  return {
    abre() { campo.value = ''; mostra(); d.showModal(); campo.focus() },
  }
}
