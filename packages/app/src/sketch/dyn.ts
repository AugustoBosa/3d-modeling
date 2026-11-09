// Entrada dinâmica (DYN, F12): caixas de comprimento e ângulo junto ao cursor. Parte pura no topo; DOM só em `criaDyn`.
import type { Pt } from '@3dm/core/sketch'
import { el } from '../ui.ts'
import { T } from '../textos.ts'

/** Parte pura: dado o ponto base (último ponto da ferramenta) e o cursor, devolve comprimento e ângulo (graus, 0..360 anti-horário a partir de +X, 1 casa) para mostrar nos campos. */
export function medidasDyn(base: Pt, cursor: Pt): { comprimento: number; angulo: number } {
  const dx = cursor.x - base.x, dy = cursor.y - base.y
  let graus = (Math.atan2(dy, dx) * 180) / Math.PI
  if (graus < 0) graus += 360
  let angulo = Math.round(graus * 10) / 10
  if (angulo >= 360) angulo = 0
  return { comprimento: Math.round(Math.hypot(dx, dy) * 10) / 10, angulo }
}

/** Texto de coordenada polar para a linha de comando a partir do que o usuário digitou: ambos preenchidos -> `@${c}<${a}`; só comprimento -> `${c}` (distância direta); só ângulo -> null. Valores podem ser expressões (passe adiante como texto). */
export function textoDyn(comprimento: string, angulo: string): string | null {
  const c = comprimento.trim(), a = angulo.trim()
  if (c && a) return `@${c}<${a}`
  if (c) return c
  return null
}

export interface Dyn {
  /** Mostra/atualiza as caixas junto ao cursor (px relativos ao host) com os valores medidos; `ativo=false` esconde. Não sobrescreve um campo que o usuário já está editando (focado ou com texto digitado). */
  atualiza(e: { ativo: boolean; base: Pt | null; cursor: Pt; pixel: { x: number; y: number } }): void
  /** Tab: foca o próximo campo (comprimento → ângulo → comprimento). Devolve true se havia caixas visíveis. */
  proximoCampo(): boolean
  /** Chamado com o texto de `textoDyn` quando o usuário aperta Enter dentro de um campo. */
  aoEnviar(f: (texto: string) => void): void
  limpa(): void
}

export function criaDyn(host: HTMLElement): Dyn {
  let enviar: ((texto: string) => void) | null = null
  const cx = el('input', { type: 'text', inputMode: 'decimal', autocomplete: 'off', spellcheck: false, ariaLabel: T.sk.dynComprimento, placeholder: T.sk.dynComprimento })
  const ca = el('input', { type: 'text', inputMode: 'decimal', autocomplete: 'off', spellcheck: false, ariaLabel: T.sk.dynAngulo, placeholder: T.sk.dynAngulo })
  const caixa = el('div', { class: 'sk-dyn', hidden: true }, cx, ca)
  host.append(caixa)

  const digitados = new Set<HTMLInputElement>()
  const editando = (i: HTMLInputElement) => document.activeElement === i || digitados.has(i)
  const preenche = (i: HTMLInputElement, v: number) => { if (!editando(i)) i.value = String(v) }

  const limpa = (): void => {
    for (const i of [cx, ca]) {
      i.value = ''
      digitados.delete(i)
      if (document.activeElement === i) i.blur()
    }
    caixa.hidden = true
  }

  for (const i of [cx, ca]) {
    i.addEventListener('input', () => { if (i.value === '') digitados.delete(i); else digitados.add(i) })
    i.addEventListener('keydown', e => {
      e.stopPropagation() // digitar não dispara atalhos globais
      if (e.key === 'Escape') { e.preventDefault(); limpa() }
      else if (e.key === 'Enter') {
        e.preventDefault()
        const t = textoDyn(cx.value, ca.value)
        if (t !== null) { enviar?.(t); limpa() }
      }
    })
  }

  return {
    atualiza({ ativo, base, cursor, pixel }) {
      if (!ativo || !base) { caixa.hidden = true; return }
      const m = medidasDyn(base, cursor)
      caixa.hidden = false
      caixa.style.left = `${pixel.x + 16}px`
      caixa.style.top = `${pixel.y + 16}px`
      preenche(cx, m.comprimento)
      preenche(ca, m.angulo)
    },
    proximoCampo() {
      if (caixa.hidden) return false
      const alvo = document.activeElement === cx ? ca : cx
      alvo.focus()
      alvo.select()
      return true
    },
    aoEnviar(f) { enviar = f },
    limpa,
  }
}
