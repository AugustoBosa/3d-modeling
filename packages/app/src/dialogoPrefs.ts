// Diálogo de Preferências (<dialog> nativo): tema, navegação, teclas imediatas, pixels e aliases (PROJETO_BASE §7.6).
import type { Prefs } from './prefs.ts'
import { T } from './textos.ts'
import { botao, campo, el } from './ui.ts'

const opcoes = <V extends string | number>(itens: [V, string][]) => itens.map(([v, t]) => new Option(t, String(v)))

/** Seção Aliases: texto atual, aplicação (quem chama faz parse, registra e salva) e texto padrão. */
export interface Aliases {
  texto(): string
  aplica(texto: string): { aplicados: number; erros: string[] }
  restaura(): string
}

function secaoAliases(a: Aliases) {
  const area = el('textarea', { class: 'aliases', rows: 8, spellcheck: false })
  const msg = el('p', { class: 'nota ajuda-msg' })
  const aplicaTexto = (t: string) => {
    const r = a.aplica(t)
    msg.textContent = [T.ajuda.aliases.aplicados(r.aplicados), ...r.erros].join('\n')
  }
  const det = el('details', { class: 'ajuda-aliases', open: true },
    el('summary', { textContent: T.ajuda.aliases.titulo }),
    el('p', { class: 'nota', textContent: T.ajuda.aliases.ajuda }),
    el('label', {}, T.ajuda.aliases.campo, area),
    el('div', { class: 'ajuda-botoes' },
      botao(T.ajuda.aliases.aplicar, () => aplicaTexto(area.value)),
      botao(T.ajuda.aliases.restaura, () => { area.value = a.restaura(); aplicaTexto(area.value) })),
    msg)
  return { el: det, abre() { area.value = a.texto(); msg.textContent = '' } }
}

/** `muda` recebe as preferências completas a cada alteração (quem chama aplica e salva). Sem `aliases`, a seção não aparece. */
export function criaDialogoPrefs(prefs: () => Prefs, muda: (p: Prefs) => void, aliases?: Aliases) {
  const tema = el('select', { id: 'pref-tema' }), nav = el('select', { id: 'pref-navegacao' }), px = el('select', { id: 'pref-pixels' })
  tema.append(...opcoes([['auto', T.prefs.temaAuto], ['claro', T.prefs.temaClaro], ['escuro', T.prefs.temaEscuro]]))
  nav.append(...opcoes([['blender', T.prefs.navBlender], ['autocad', T.prefs.navAutocad]]))
  px.append(...opcoes(Object.entries(T.pixelsRotulos)))
  const teclas = el('input', { type: 'checkbox', id: 'pref-teclas' })

  const al = aliases ? secaoAliases(aliases) : null
  const d = el('dialog', { id: 'dialogo-prefs' }, el('h2', { textContent: T.prefs.titulo }),
    campo(T.prefs.tema, tema), campo(T.prefs.navegacao, nav), campo(T.prefs.teclasBlender, teclas), campo(T.prefs.pixels, px),
    ...(al ? [al.el] : []),
    botao(T.prefs.fechar, () => d.close()))
  d.addEventListener('click', e => { if (e.target === d) d.close() }) // clique no fundo fecha

  const aplica = () => muda({ tema: tema.value as Prefs['tema'], navegacao: nav.value as Prefs['navegacao'], teclasBlender: teclas.checked, pixels: +px.value as Prefs['pixels'] })
  for (const c of [tema, nav, teclas, px]) c.onchange = aplica
  document.body.append(d)

  return {
    abre() {
      const p = prefs()
      tema.value = p.tema; nav.value = p.navegacao; teclas.checked = p.teclasBlender; px.value = String(p.pixels)
      al?.abre()
      d.showModal()
    },
  }
}
