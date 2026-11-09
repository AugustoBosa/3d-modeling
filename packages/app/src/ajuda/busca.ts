// Busca de comando (Ctrl+K, PROJETO_BASE §6.17): <dialog> compacto; setas escolhem, Enter executa e fecha, Esc fecha.
import { botao, el } from '../ui.ts'
import type { Registro } from '../linha/registro.ts'
import { T } from '../textos.ts'
import { filtra, linhasAjuda, type LinhaAjuda } from './dados.ts'

export function criaBuscaComando(reg: Registro, executa: (nome: string) => void): { abre(): void } {
  const comandos = linhasAjuda(reg).filter(l => l.tipo === 'comando')
  const campo = el('input', { type: 'search', placeholder: T.ajuda.busca.campo, id: 'busca-comando' })
  const lista = el('ul', { class: 'busca-lista' })
  const vazio = el('p', { class: 'nota', textContent: T.ajuda.busca.nenhum, hidden: true })
  let achados: LinhaAjuda[] = [], sel = 0

  function pinta() {
    [...lista.children].forEach((li, i) => li.classList.toggle('sel', i === sel))
    lista.children[sel]?.scrollIntoView({ block: 'nearest' })
  }

  function escolhe(i: number) {
    const l = achados[i]
    if (!l) return
    d.close()
    executa(l.nome)
  }

  function mostra() {
    achados = filtra(comandos, campo.value)
    sel = 0
    lista.replaceChildren(...achados.map((l, i) => el('li', { onclick: () => escolhe(i) },
      el('b', { textContent: l.nome }), el('span', { class: 'busca-alias', textContent: l.alias }), el('span', { class: 'nota', textContent: l.descricao }))))
    vazio.hidden = achados.length > 0
    pinta()
  }
  campo.addEventListener('input', mostra)

  const d = el('dialog', { class: 'ajuda busca' }, el('h2', { textContent: T.ajuda.busca.titulo }), campo, lista, vazio,
    botao(T.ajuda.busca.fechar, () => d.close()))
  d.addEventListener('click', e => { if (e.target === d) d.close() })
  d.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (achados.length) sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + achados.length) % achados.length
      pinta()
    } else if (e.key === 'Enter') escolhe(sel)
    else if (e.key === 'Escape') d.close()
    else return
    e.preventDefault(); e.stopPropagation()
  })
  document.body.append(d)

  return {
    abre() { campo.value = ''; mostra(); d.showModal(); campo.focus() },
  }
}
