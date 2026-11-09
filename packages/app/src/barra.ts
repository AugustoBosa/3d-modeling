// Barra de status: X/Y do cursor, modos F3/F7–F12 (F8 e F10 exclusivos), unidade e HUD em ms.
import { alterna, estadoInicial, ORDEM } from './status.ts'
import type { EstadoModos, Modo } from './status.ts'
import { T } from './textos.ts'
import { el } from './ui.ts'

const TECLA: Record<Modo, string> = { osnap: 'F3', grid: 'F7', ortho: 'F8', snap: 'F9', polar: 'F10', otrack: 'F11', dyn: 'F12' }

export function criaBarra(host: HTMLElement, aoMudar: (modo: Modo, estado: EstadoModos) => void) {
  let estado = estadoInicial()
  const cursor = el('span', { class: 'cursor', textContent: `${T.status.x} ${T.status.semCursor}  ${T.status.y} ${T.status.semCursor}` })
  const btns = new Map<Modo, HTMLButtonElement>()
  const grupo = el('span', { class: 'modos' })
  for (const m of ORDEM) {
    const b = el('button', { type: 'button', title: T.status.dicas[m], onclick: () => alterna_(m) },
      T.status.modos[m], el('small', { textContent: TECLA[m] }))
    btns.set(m, b); grupo.append(b)
  }
  const hud = el('span', { class: 'hud', title: T.cards.hudDica, textContent: `${T.status.hud} ${T.status.semCursor}` })
  host.append(cursor, grupo, el('span', { class: 'espaco' }), el('span', { textContent: T.status.unidade }), hud)

  function pinta() { btns.forEach((b, m) => b.setAttribute('aria-pressed', String(estado[m]))) }
  function alterna_(m: Modo) { estado = alterna(estado, m); pinta(); aoMudar(m, estado) }
  pinta()

  return {
    /** Tecla de função (F3, F7–F12). Devolve true se tratou. */
    tecla(code: string): boolean {
      const m = Object.entries(TECLA).find(([, c]) => c === code)?.[0] as Modo | undefined
      if (!m) return false
      alterna_(m)
      return true
    },
    get estado() { return estado },
    cursor(p: { x: number; y: number } | null) {
      const f = (n: number) => n.toFixed(2)
      cursor.textContent = p ? `${T.status.x} ${f(p.x)}  ${T.status.y} ${f(p.y)}` : `${T.status.x} ${T.status.semCursor}  ${T.status.y} ${T.status.semCursor}`
    },
    hud(nivel: string, texto: string) { hud.className = `hud ${nivel}`; hud.textContent = `${T.status.hud} ${texto}` },
  }
}
