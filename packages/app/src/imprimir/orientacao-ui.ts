// Seção "Orientação" (direita): modo inclinação, apoiar na face, soltar e centralizar. O overlay vive em overhang.ts.
import { filamentoPorId } from '@3dm/core/filaments'
import { impressoraPorId } from '@3dm/core/printers'
import type { Projeto } from '../projeto.ts'
import { botao, el } from '../ui.ts'
import { T } from '../textos.ts'
import type { Overhang } from './overhang.ts'
import type { CorpoInfo } from '../features/contrato.ts'

export interface DepsOrientacao {
  projeto: Projeto
  overhang: Overhang
  corpos(): Iterable<CorpoInfo>
  ocultos(): ReadonlySet<string>
  acoes: { apoiar(): void; soltar(): void; centralizar(): void }
  aviso(t: string, erro?: boolean): void
}

/** Limiar do modo inclinação: o mais restrito entre a impressora e o filamento ativo. */
export function limiarOverhang(projeto: Projeto): number {
  const imp = impressoraPorId(projeto.doc.impressora)
  const fil = filamentoPorId(projeto.doc.filamento ?? imp?.filamentoPadrao ?? 'pla')
  return Math.min(imp?.regras.overhangMax ?? 45, fil?.regras.overhangMax ?? 45)
}

export function criaOrientacaoUi(host: HTMLElement, d: DepsOrientacao) {
  const legenda = el('p', { class: 'nota' })
  const alterna = botao(T.orient.overhang, () => { if (d.overhang.ligado) { d.overhang.esconde(); d.aviso(T.orient.overhangDesligado); marca() } else { d.aviso(T.orient.overhangLigado); atualiza(true) } }, T.orient.overhang)
  const marca = () => { alterna.setAttribute('aria-pressed', String(d.overhang.ligado)); if (!d.overhang.ligado) legenda.textContent = '' }
  host.append(alterna, legenda, botao(T.orient.apoiar, d.acoes.apoiar), botao(T.orient.soltar, d.acoes.soltar), botao(T.orient.centralizar, d.acoes.centralizar))
  /** Reaplica o overlay (corpos novos / limiar novo); só se estiver ligado ou ao ligar. */
  function atualiza(forca = false) {
    if (!d.overhang.ligado && !forca) return
    const lim = limiarOverhang(d.projeto)
    const r = d.overhang.mostra(d.corpos(), lim, d.ocultos())
    legenda.textContent = `${T.orient.overhangLegenda(lim)} ${r.areaMm2 > 0 ? T.orient.area(r.areaMm2.toFixed(1)) : ''}`
    marca()
  }
  return { atualiza: () => atualiza(false), liga: () => { atualiza(true) }, alterna: () => alterna.click(), get area() { return legenda.textContent } }
}
