// Atalhos globais da F0 (PROJETO_BASE §7.3): Ctrl+Z/Y/S, F2/F3/F7–F12, numpad, Home, N, Enter/Espaço repete,
// e "digitar em qualquer lugar escreve na linha". O despachante G/R/S + restrições (§7.3, regra 2/2b) chega na F1 (teclado/).
import type { criaBarra } from './barra.ts'
import type { criaLinha } from './linha/linha.ts'
import type { Ligacao } from './teclado/ligacao.ts'
import type { Vista } from './viewport/vista.ts'

export interface Alvos {
  vista: Vista
  linha: ReturnType<typeof criaLinha>
  barra: ReturnType<typeof criaBarra>
  desfazer(): void; refazer(): void; salvar(): void
  alternaPainelDir(): void
  ajuda(): void; busca(): void // F1 (cartão de atalhos) e Ctrl+K (busca de comando)
  teclado: Ligacao // despachante §7.3 (G/R/S, restrições por letra, letras → linha de comando)
  aoNavegar(): void // depois de uma tecla de vista (atualiza o botão de projeção)
}

const CAMPO = 'input,textarea,select,[contenteditable="true"]'

export function instalaAtalhos(a: Alvos) {
  addEventListener('keydown', e => {
    if (document.querySelector('dialog[open]') || !(e.target instanceof HTMLElement)) return
    const t = e.target, digitando = t.matches(CAMPO), naLinha = t.id === 'entrada-comando'
    const ctrl = e.ctrlKey || e.metaKey

    if (e.key === 'F1') { e.preventDefault(); a.ajuda(); return }
    if (e.key === 'F2') { e.preventDefault(); a.linha.alternaHistorico(); return }
    if (/^F(3|7|8|9|10|11|12)$/.test(e.key) && a.barra.tecla(e.key)) { e.preventDefault(); return }

    if (ctrl && !e.altKey) {
      const k = e.key.toLowerCase()
      if (digitando && !naLinha && k !== 's') return // campos numéricos mantêm o undo de texto do navegador
      if (k === 'k') { e.preventDefault(); a.busca(); return }
      if (k === 'a' && !digitando && a.teclado.tecla({ key: 'a', ctrl: true })) { e.preventDefault(); return }
      if (k === 's') { e.preventDefault(); a.salvar() }
      else if (k === 'z' && !e.shiftKey) { e.preventDefault(); a.desfazer() }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); a.refazer() }
      else if (e.code.startsWith('Numpad') && !digitando && a.vista.tecla(e.code, true)) { e.preventDefault(); a.aoNavegar() }
      return
    }
    if (digitando) return

    if (e.code.startsWith('Numpad') && a.vista.tecla(e.code, false)) { e.preventDefault(); a.aoNavegar(); return }
    if (e.key === 'Home') { e.preventDefault(); a.vista.enquadra(); return }
    if ((e.key === 'n' || e.key === 'N') && !e.altKey) { e.preventDefault(); a.alternaPainelDir(); return }

    if (a.teclado.tecla({ key: e.key, ctrl: false, alt: e.altKey, shift: e.shiftKey })) { e.preventDefault(); return }

    const livre = t === document.body || t.tagName === 'CANVAS' || t.tagName === 'MAIN'
    if ((e.key === 'Enter' || e.key === ' ') && livre) { e.preventDefault(); void a.linha.sessao.envia(''); return } // repete o último comando
    if (e.key.length === 1 && !e.altKey && (livre || t.tagName === 'BUTTON' || t.tagName === 'SUMMARY') && e.key !== ' ') a.linha.foca() // o caractere cai na linha
  })
}
