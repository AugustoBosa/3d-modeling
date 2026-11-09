// Barra superior: Arquivo, abas de ferramenta (chegam nas próximas fases), impressora, desfazer/refazer, tema, preferências.
import { impressoras } from '@3dm/core/printers'
import type { Projeto } from './projeto.ts'
import type { Tema } from './tema.ts'
import { T } from './textos.ts'
import { botao, el } from './ui.ts'

export interface AcoesTopo {
  novo(): void; abrir(): void; salvar(): void
  desfazer(): void; refazer(): void
  alternaTema(): void; prefs(): void
  impressora(id: string): void
  /** Abas Sketch (0) e Sólido (1); as demais chegam em outras fases. */
  aba?(i: number): void
  /** Abas vivas (índices). Padrão: 0 e 1. */
  abasVivas?: number[]
  salvarComo?(): void
  recentes?(): Promise<{ id: string; nome: string }[]>
  abreRecente?(id: string): void
  importar?(): void
}

export function criaTopo(host: HTMLElement, a: AcoesTopo) {
  const menu = el('details', { class: 'menu' })
  const item = (texto: string, f: () => void) => botao(texto, () => { menu.open = false; f() })
  const itens = el('div', { class: 'itens' }, item(T.topo.novo, a.novo), item(T.topo.abrir, a.abrir), item(T.topo.salvar, a.salvar))
  if (a.salvarComo) itens.append(item(T.recentes.salvarComo, a.salvarComo))
  if (a.importar) itens.append(item(T.importar.botao, a.importar))
  const recentes = el('div', { class: 'recentes' })
  itens.append(recentes)
  menu.addEventListener('toggle', async () => {
    if (!menu.open || !a.recentes) return
    const lista = await a.recentes().catch(() => [])
    recentes.replaceChildren(el('b', { textContent: T.recentes.titulo }), ...(lista.length ? lista.map(r => item(r.nome, () => a.abreRecente?.(r.id))) : [el('span', { class: 'nota', textContent: T.recentes.vazio })]))
  })
  menu.append(el('summary', { textContent: `${T.ico.menu} ${T.topo.arquivo}` }),
    itens)
  document.addEventListener('pointerdown', e => { if (!menu.contains(e.target as Node)) menu.open = false })

  const abas = el('nav', { class: 'abas' })
  const botoesAba = T.topo.abas.map((t, i) => {
    const vivo = (a.abasVivas ?? [0, 1]).includes(i) && !!a.aba
    const b = botao(t, () => a.aba?.(i), vivo ? t : T.topo.abaEmBreve); b.disabled = !vivo; abas.append(b); return b
  })

  const sel = el('select', { title: T.topo.impressora, ariaLabel: T.topo.impressora })
  sel.append(...impressoras.map(p => new Option(p.nome, p.id)))
  sel.onchange = () => a.impressora(sel.value)

  const des = botao(T.ico.desfazer, a.desfazer, T.topo.desfazer), ref = botao(T.ico.refazer, a.refazer, T.topo.refazer)
  des.ariaLabel = T.topo.desfazer; ref.ariaLabel = T.topo.refazer
  const tema = botao(T.ico.tema, a.alternaTema), prefs = botao(T.ico.prefs, a.prefs, T.topo.prefs)
  prefs.ariaLabel = T.topo.prefs
  host.append(menu, abas, el('span', { class: 'espaco' }), sel, des, ref, tema, prefs)

  return {
    marcaAba(i: number) { botoesAba.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i))) },
    /** Sincroniza botões e seletor com o projeto e o tema. */
    atualiza(p: Projeto, t: Tema) {
      sel.value = p.doc.impressora
      des.disabled = !p.podeDesfazer; ref.disabled = !p.podeRefazer
      const dica = t === 'claro' ? T.topo.temaParaEscuro : T.topo.temaParaClaro
      tema.title = tema.ariaLabel = dica
    },
  }
}
