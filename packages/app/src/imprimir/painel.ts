// Painel Imprimir: impressora, filamento, massa, verificações e exportação. DOM à mão, sem framework.
import type { EntradaMalha } from '@3dm/core/malha'
import type { FormatoExport } from '@3dm/core/export'
import { definirFilamento } from '@3dm/core/imprimir'
import { filamentos } from '@3dm/core/filaments'
import type { Projeto } from '../projeto.ts'
import type { criaExportador, UltimoExport } from './exportar.ts'
import { calculaPainel, fmtGramas } from './modelo.ts'
import { T } from '../textos.ts'
import { botao, campo, el } from '../ui.ts'

export interface DepsPainelImprimir {
  projeto: Projeto
  corpos(): ReadonlyMap<string, EntradaMalha>
  ocultos(): ReadonlySet<string>
  exportador: ReturnType<typeof criaExportador>
  aviso(t: string, erro?: boolean): void
}

const ATRASO = 100 // ms: pulsos seguidos de atualiza() viram uma reconstrução só

export function criaPainelImprimir(host: HTMLElement, d: DepsPainelImprimir) {
  let timer: ReturnType<typeof setTimeout> | undefined

  const calcula = () => calculaPainel(d.projeto.doc, d.corpos(), d.ocultos())
  const visiveis = () => [...d.corpos().keys()].filter(n => !d.ocultos().has(n)).length

  /** Mensagens depois de um export: uma por arquivo, ou o motivo de não ter saído nada. */
  function relata(r: UltimoExport): void {
    if (r.cancelado) return d.aviso(T.imprimir.cancelado)
    if (r.erro !== undefined) return d.aviso(T.imprimir.falhou(r.erro), true)
    if (r.bloqueado) return // o painel já mostra o bloqueio e o botão "exportar mesmo assim"
    if (r.arquivos.length === 0) return d.aviso(T.imprimir.semArquivos, true)
    if (r.miniaturaFalhou) d.aviso(T.imprimir.miniaturaFalhou, true)
    for (const a of r.arquivos) d.aviso(T.imprimir.exportado(a.nome, Math.max(1, Math.round(a.bytes / 1024))))
  }

  async function exporta(formato: FormatoExport, ignoraBloqueio = false): Promise<void> {
    renderiza() // mostra "gerando" e o botão cancelar
    const r = await d.exportador.exporta(formato, { ignoraBloqueio })
    relata(r)
    renderiza()
  }

  function renderiza(): void {
    const p = calcula()
    const ult = d.exportador.ultimo()
    const bloqueio = p.temBloqueio || ult?.bloqueado === true
    const formato: FormatoExport = ult?.formato ?? 'stl-tudo'

    const sel = el('select', { id: 'imp-filamento', ariaLabel: T.imprimir.filamento },
      ...filamentos.map(f => el('option', { value: f.id, textContent: f.id === p.impressora.filamentoPadrao ? T.imprimir.filamentoPadrao(f.nome) : f.nome })))
    sel.value = p.filamento.id
    sel.onchange = () => { d.projeto.executa(definirFilamento(sel.value)); atualiza() }

    const achados = visiveis() === 0
      ? el('p', { textContent: T.imprimir.semCorpos })
      : p.achados.length === 0
        ? el('p', { class: 'imp-ok', textContent: T.imprimir.semAchados })
        : el('ul', { class: 'imp-achados' }, ...p.achados.map(a => el('li', { class: `sev-${a.severidade}` }, el('b', { textContent: T.imprimir.sev[a.severidade] }), ' ', a.mensagem)))

    const acoes = d.exportador.emAndamento()
      ? el('div', { class: 'imp-acoes' }, el('span', { textContent: T.imprimir.exportando }), botao(T.imprimir.cancelar, () => d.exportador.cancela()))
      : el('div', { class: 'imp-acoes' },
        botao(T.imprimir.stl, () => void exporta('stl')),
        botao(T.imprimir.stlTudo, () => void exporta('stl-tudo')),
        botao(T.imprimir.mf3, () => void exporta('3mf')))

    const bloqueado = bloqueio
      ? el('div', { class: 'imp-bloqueio' }, el('p', { textContent: T.imprimir.bloqueio }), botao(T.imprimir.mesmoAssim, () => void exporta(formato, true)))
      : el('div')

    host.replaceChildren(
      el('div', { class: 'imp-painel' },
        campo(T.imprimir.impressora, el('span', { textContent: p.impressora.nome })),
        campo(T.imprimir.filamento, sel),
        el('p', { class: 'imp-massa', textContent: T.imprimir.massa(fmtGramas(p.massaG)) }),
        el('h3', { textContent: T.imprimir.achados }),
        achados,
        bloqueado,
        acoes))
  }

  function atualiza(): void {
    clearTimeout(timer)
    timer = setTimeout(renderiza, ATRASO)
  }

  return {
    atualiza,
    inspeciona() {
      const p = calcula()
      return { achados: p.achados, massaG: p.massaG, filamento: p.filamento.id, temBloqueio: p.temBloqueio }
    },
  }
}
