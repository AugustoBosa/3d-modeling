// Helpers de UI (DOM à mão, sem framework). Extraídos do main.ts do modular_terrain_system, sem a orquestração.

/** Cria um elemento com propriedades e filhos (texto ou nós). */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {}, ...filhos: (string | Node)[]): HTMLElementTagNameMap[K] {
  const { class: c, ...resto } = props
  const e = Object.assign(document.createElement(tag), resto)
  if (c) e.className = c
  e.append(...filhos)
  return e
}

export function botao(texto: string, clique: (e: MouseEvent) => void, dica = ''): HTMLButtonElement {
  return el('button', { type: 'button', textContent: texto, title: dica, onclick: clique })
}

/** Card recolhível sobre a vista: `d` é o <details>, `s` o título e `c` o corpo. */
export function cartao(titulo: string, aberto = false) {
  const c = el('div'), s = el('summary', { textContent: titulo })
  const d = el('details', { class: 'card', open: aberto }, s, c)
  return { d, s, c }
}

/** Seção recolhível; devolve o div interno. */
export function secao(pai: HTMLElement, titulo: string, aberta = true): HTMLElement {
  const div = el('div')
  pai.append(el('details', { open: aberta }, el('summary', { textContent: titulo }), div))
  return div
}

/** Rótulo + controle numa linha de grid (`1fr auto`). */
export const campo = (texto: string, controle: HTMLElement) => el('label', {}, texto, controle)

/** Botões lado a lado (um ativo). Devolve o contêiner e `marca`, que pinta o ativo. */
export function segmentos(itens: [string, string][], muda: (v: string) => void) {
  const bs = new Map<string, HTMLButtonElement>()
  const marca = (v: string) => bs.forEach((b, k) => b.classList.toggle('ativo', k === v))
  const caixa = el('div', { class: 'seg' })
  for (const [v, t] of itens) { const b = botao(t, () => { muda(v); marca(v) }, t); bs.set(v, b); caixa.append(b) }
  return { el: caixa, marca }
}

/** Slider + caixa numérica. Devolve o setter para pôr um valor vindo de fora. */
export function controle(pai: HTMLElement, rotulo: string, ini: number, min: number, max: number, muda: (v: number) => void, passo = 1) {
  const num = el('input', { type: 'number', min: String(min), max: String(max), step: String(passo), value: String(ini) })
  const sl = el('input', { type: 'range', min: String(min), max: String(max), step: String(passo), value: String(ini) })
  const ao = (e: HTMLInputElement) => () => {
    if (e.value === '') return // caixa sendo apagada para digitar
    const v = Math.min(max, Math.max(min, +e.value))
    sl.value = String(v)
    if (e === sl || +num.value !== v) num.value = String(v)
    muda(v)
  }
  num.oninput = ao(num); sl.oninput = ao(sl)
  pai.append(el('label', { class: 'controle' }, rotulo, num, sl))
  return (v: number) => { sl.value = num.value = String(v) }
}
