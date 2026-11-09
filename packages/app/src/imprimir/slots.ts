// Tabela de slots AMS do projeto e o bloco cor/slot de cada corpo (propriedades). DOM à mão.
import { definirCorCorpo } from '@3dm/core/features'
import { definirSlotCorpo, definirSlotTabela } from '@3dm/core/imprimir'
import { filamentos } from '@3dm/core/filaments'
import { impressoraPorId } from '@3dm/core/printers'
import type { Projeto } from '../projeto.ts'
import { slotsDe } from './modelo.ts'
import { T } from '../textos.ts'
import { botao, campo, el } from '../ui.ts'

const SLOTS_MAX = 16
const COR_NOVA = '#ffffff'

const opcoesFilamento = (valor: string) => filamentos.map(f => el('option', { value: f.id, textContent: f.nome, selected: f.id === valor }))

/** Tabela do navegador do projeto: uma linha por slot de doc.slots. */
export function criaTabelaSlots(host: HTMLElement, projeto: Projeto): { atualiza(): void } {
  const atualiza = () => {
    const doc = projeto.doc
    const imp = impressoraPorId(doc.impressora)
    const entradas = Object.entries(doc.slots ?? {}).sort(([a], [b]) => Number(a) - Number(b))
    const livre = Array.from({ length: SLOTS_MAX }, (_, i) => i + 1).find(n => doc.slots?.[String(n)] === undefined)

    const linhas = entradas.map(([chave, s]) => {
      const n = Number(chave)
      const sel = el('select', { ariaLabel: T.imprimir.slotFilamento }, ...opcoesFilamento(s.filamento))
      const cor = el('input', { type: 'color', value: s.cor, ariaLabel: T.imprimir.slotCor })
      sel.onchange = () => projeto.executa(definirSlotTabela(n, { filamento: sel.value, cor: cor.value }))
      cor.onchange = () => projeto.executa(definirSlotTabela(n, { filamento: sel.value, cor: cor.value }))
      return el('tr', {}, el('td', { textContent: T.imprimir.slotN(n) }), el('td', {}, sel), el('td', {}, cor),
        el('td', {}, botao(T.imprimir.slotRemover, () => projeto.executa(definirSlotTabela(n, null)))))
    })

    const adicionar = botao(T.imprimir.slotAdicionar, () => {
      if (livre !== undefined) projeto.executa(definirSlotTabela(livre, { filamento: imp?.filamentoPadrao ?? '', cor: COR_NOVA }))
    })
    adicionar.disabled = livre === undefined

    host.replaceChildren(
      el('div', { class: 'imp-slots' },
        el('h3', { textContent: T.imprimir.slotsTitulo }),
        el('p', { textContent: T.imprimir.slotsAjuda }),
        imp?.ams === false ? el('p', { class: 'imp-aviso', textContent: T.imprimir.semAms }) : el('div'),
        entradas.length === 0
          ? el('p', { textContent: T.imprimir.semSlots })
          : el('table', {}, el('thead', {}, el('tr', {}, el('th'), el('th', { textContent: T.imprimir.slotFilamento }), el('th', { textContent: T.imprimir.slotCor }), el('th'))), el('tbody', {}, ...linhas)),
        adicionar))
  }
  return { atualiza }
}

/** Bloco com cor e slot de um corpo, para as propriedades. */
export function criaCorSlotCorpo(projeto: Projeto, corpoId: string): HTMLElement {
  const ap = projeto.doc.aparencia[corpoId]
  const ams = impressoraPorId(projeto.doc.impressora)?.ams ?? false
  const cor = el('input', { type: 'color', value: ap?.cor ?? '#b8b4ac', ariaLabel: T.imprimir.cor })
  // inclui o slot atual mesmo que passe do máximo da impressora, para o select mostrar o valor real
  const n = Math.max(slotsDe(ams), ap?.slot ?? 1)
  const slot = el('select', { ariaLabel: T.imprimir.slot },
    ...Array.from({ length: n }, (_, i) => el('option', { value: String(i + 1), textContent: T.imprimir.slotN(i + 1), selected: i + 1 === (ap?.slot ?? 1) })))
  cor.onchange = () => projeto.executa(definirCorCorpo(corpoId, cor.value))
  slot.onchange = () => projeto.executa(definirSlotCorpo(corpoId, Number(slot.value)))
  return el('div', { class: 'imp-corslot' }, campo(T.imprimir.cor, cor), campo(T.imprimir.slot, slot))
}
