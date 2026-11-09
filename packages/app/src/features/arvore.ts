// Árvore de features (painel esquerdo, DOM à mão). A lógica das linhas e do marcador está em arvore-modelo.ts.
import type { Feature } from '@3dm/core/doc'
import type { AcoesArvore, DadosSolido } from './contrato.ts'
import { linhasArvore, proximoMarcador, type LinhaArvore } from './arvore-modelo.ts'
import { T } from '../textos.ts'
import { el } from '../ui.ts'

interface DocArvore { features: Feature[]; marcador: string | null }

export function criaArvore(host: HTMLElement, leDoc: () => DocArvore, leDados: () => DadosSolido, acoes: AcoesArvore): { atualiza(): void } {
  const ul = el('ul', { class: 'arvore', id: 'arvore-features' })
  let focaMarcador = false
  let arrastando = false
  let meios: number[] = [] // centros Y das features no início do arrasto

  const featLis = () => [...ul.querySelectorAll<HTMLLIElement>(':scope > li[data-id]')]

  function featureLi(l: LinhaArvore): HTMLLIElement {
    const classes = [
      l.estado === 'erro' && 'erro',
      l.estado === 'suspensa' && 'suspensa',
      l.revertida && 'revertida',
      l.selecionada && 'selecionada',
      l.suprimida && 'suprimida',
      l.oculta && 'oculta',
    ].filter(Boolean).join(' ')
    const nome = el('button', {
      type: 'button', class: 'arvore-nome', title: l.rotulo,
      onclick: () => acoes.seleciona(l.id), ondblclick: () => acoes.edita(l.id),
    }, el('span', { class: 'arvore-icone', textContent: l.icone, ariaHidden: 'true' }), el('span', { class: 'arvore-rotulo', textContent: l.rotulo }))
    const olho = el('button', {
      type: 'button', class: 'arvore-btn', title: T.arvore.olho, ariaLabel: T.arvore.olho,
      textContent: l.oculta ? T.arvore.simbolo.olhoOculto : T.arvore.simbolo.olhoAberto,
      onclick: () => acoes.alternaOlho(l.id),
    })
    const sup = el('button', {
      type: 'button', class: 'arvore-btn', title: l.suprimida ? T.arvore.reativar : T.arvore.suprimir, ariaLabel: l.suprimida ? T.arvore.reativar : T.arvore.suprimir,
      textContent: T.arvore.simbolo.suprimir, onclick: () => acoes.suprime(l.id, !l.suprimida),
    })
    const exc = el('button', {
      type: 'button', class: 'arvore-btn', title: T.arvore.excluir, ariaLabel: T.arvore.excluir,
      textContent: T.arvore.simbolo.excluir, onclick: () => acoes.remove(l.id),
    })
    const li = el('li', { class: classes, title: T.arvore.estado[l.estado] ?? '', ariaCurrent: l.selecionada ? 'true' : null },
      el('div', { class: 'arvore-linha' }, nome, olho, sup, exc),
      ...(l.erro ? [el('p', { class: 'arvore-erro', textContent: l.erro })] : []))
    li.dataset.id = l.id
    return li
  }

  function marcadorLi(): HTMLLIElement {
    const li = el('li', { class: 'marcador', tabIndex: 0, role: 'separator', title: T.arvore.marcador, ariaLabel: T.arvore.marcador }, T.arvore.marcadorRotulo)
    li.onkeydown = e => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
      e.preventDefault()
      const d = leDoc()
      const delta: -1 | 1 = e.key === 'ArrowUp' ? -1 : 1
      focaMarcador = true
      acoes.moveMarcador(proximoMarcador(d.features, d.marcador, delta))
      desenha()
    }
    li.onpointerdown = e => {
      if (e.button !== 0) return
      // Mede as features sem a barra (ela não deve deslocá-las na medição).
      const proxima = li.nextSibling
      li.remove()
      meios = featLis().map(f => { const r = f.getBoundingClientRect(); return r.top + r.height / 2 })
      ul.insertBefore(li, proxima)
      li.setPointerCapture(e.pointerId)
      arrastando = true
    }
    li.onpointermove = e => {
      if (!arrastando) return
      const j = Math.max(0, meios.reduce((acc, m, i) => (e.clientY > m ? i : acc), -1))
      const alvo = featLis()[j]
      if (alvo && alvo.nextElementSibling !== li) alvo.after(li)
    }
    li.onpointerup = () => {
      if (!arrastando) return
      arrastando = false
      const fs = featLis()
      const anterior = li.previousElementSibling as HTMLLIElement | null
      const j = Math.max(0, anterior ? fs.indexOf(anterior) : 0)
      const idNovo = j >= fs.length - 1 ? null : (fs[j].dataset.id ?? null)
      if (idNovo !== leDoc().marcador) acoes.moveMarcador(idNovo)
      desenha()
    }
    li.onpointercancel = () => { arrastando = false; desenha() }
    return li
  }

  function desenha() {
    const doc = leDoc()
    const linhas = linhasArvore(doc.features, doc.marcador, leDados())
    if (!linhas.length) {
      host.replaceChildren(el('p', { class: 'nota', textContent: T.arvore.semFeatures }))
      return
    }
    const itens: HTMLElement[] = linhas.map(featureLi)
    const barra = marcadorLi()
    itens.splice(linhas.findIndex(l => l.ehMarcador) + 1, 0, barra)
    ul.replaceChildren(...itens)
    host.replaceChildren(ul)
    if (focaMarcador) { barra.focus(); focaMarcador = false }
  }

  return { atualiza: desenha }
}
