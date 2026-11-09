// Linha de comando (DOM): histórico de 3 linhas (F2 expande), entrada, sugestões (Tab completa), ↑↓ recuperam entradas.
// A lógica (alias, perguntas, repetir, Esc) está em registro.ts.
import { T } from '../textos.ts'
import { el } from '../ui.ts'
import { criaSessao } from './registro.ts'
import type { Desvio, Registro, TipoLinha } from './registro.ts'

const MAX_LINHAS = 200

export function criaLinha(host: HTMLElement, reg: Registro, desvio?: Desvio) {
  const hist = el('div', { class: 'hist', role: 'log', title: T.linha.expande })
  const prompt = el('span', { class: 'prompt', textContent: T.linha.prompt })
  const entrada = el('input', { type: 'text', id: 'entrada-comando', autocomplete: 'off', spellcheck: false, placeholder: T.linha.placeholder, ariaLabel: T.linha.rotulo, enterKeyHint: 'go' })
  const sug = el('div', { class: 'sugestoes', role: 'listbox', ariaLabel: T.linha.sugestoes, hidden: true })
  host.append(hist, el('div', { class: 'entrada' }, prompt, entrada, sug))

  const escreve = (t: string, tipo: TipoLinha) => {
    hist.append(el('div', { class: `l-${tipo}`, textContent: t }))
    while (hist.childElementCount > MAX_LINHAS) hist.firstElementChild!.remove()
    hist.scrollTop = hist.scrollHeight
  }
  const refresca = () => {
    prompt.textContent = sessao.pendente ?? T.linha.prompt
    entrada.placeholder = sessao.pendente ? '' : T.linha.placeholder
    atualizaSugestoes()
  }
  const sessao = criaSessao(reg, escreve, refresca, desvio)

  let iHist = -1, ciclo: string[] = [], iCiclo = -1
  function atualizaSugestoes() {
    const v = entrada.value.trim()
    ciclo = !sessao.pendente && v && !/\s/.test(v) ? reg.sugere(v).slice(0, 8) : []
    iCiclo = -1
    sug.replaceChildren(...ciclo.map(s => {
      const b = el('button', { type: 'button', tabIndex: -1, textContent: s })
      b.onpointerdown = e => { e.preventDefault(); entrada.value = s; entrada.focus(); atualizaSugestoes() }
      return b
    }))
    sug.hidden = ciclo.length === 0
  }

  async function envia() {
    const t = entrada.value
    entrada.value = ''; iHist = -1; atualizaSugestoes()
    const p = sessao.envia(t)
    if (!sessao.pendente) entrada.blur() // devolve o foco ao viewport: numpad e atalhos voltam a valer
    await p
    if (sessao.pendente) entrada.focus()
  }

  entrada.addEventListener('input', atualizaSugestoes)
  entrada.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); void envia() }
    else if (e.key === ' ' && !sessao.pendente && (!entrada.value.trim() || (!/\s/.test(entrada.value.trim()) && reg.resolve(entrada.value.trim())))) { e.preventDefault(); void envia() } // Espaço também executa
    else if (e.key === 'Escape') {
      e.preventDefault()
      if (sessao.pendente) sessao.cancela()
      entrada.value = ''; atualizaSugestoes(); entrada.blur()
    } else if (e.key === 'Tab' && ciclo.length) {
      e.preventDefault()
      iCiclo = (iCiclo + (e.shiftKey ? -1 : 1) + ciclo.length) % ciclo.length
      entrada.value = ciclo[iCiclo]
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const n = sessao.entradas.length
      if (!n) return
      e.preventDefault()
      iHist = e.key === 'ArrowUp' ? Math.min(n - 1, iHist + 1) : Math.max(-1, iHist - 1)
      entrada.value = iHist < 0 ? '' : sessao.entradas[n - 1 - iHist]
    }
  })

  function alternaHistorico() { host.classList.toggle('expandido') }

  return {
    sessao, escreve, alternaHistorico, refresca,
    /** Acrescenta texto à linha, foca e põe o cursor no fim (teclas imediatas que viram texto de comando). */
    anexa(t: string) { entrada.value += t; entrada.focus(); atualizaSugestoes() },
    get vazia() { return entrada.value === '' },
    /** Foca a linha para receber a tecla digitada fora dela. */
    foca: () => entrada.focus(),
    get digitando() { return document.activeElement === entrada },
    /** Aviso de erro ou informação do app na linha (ex.: falha ao abrir arquivo). */
    aviso: (t: string, erro = false) => escreve(t, erro ? 'erro' : 'info'),
  }
}
