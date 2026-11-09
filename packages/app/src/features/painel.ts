// Painel de feature (direita): formulário gerado do ESQUEMAS, com prévia ao vivo. DOM à mão, sem framework.
import type { Feature } from '@3dm/core/doc'
import type { PedidoPainel } from './contrato.ts'
import { ESQUEMAS, fromFeature, normalizaNum, planoDe, planoParaCampo, toFeature, valida } from './esquemas.ts'
import type { Campo, PlanoCampo } from './esquemas.ts'
import { T } from '../textos.ts'
import { botao, el } from '../ui.ts'

interface Item { campo: Campo; linha: HTMLElement; ler(): unknown }
interface Controle { nodo: HTMLElement; ler(): unknown; por(v: unknown): void }

const vetorDe = (s: string): (string | number)[] => (s.trim() === '' ? [] : s.split(',').map(normalizaNum))
const vetorTexto = (v: unknown): string => (Array.isArray(v) ? v.join(', ') : String(v ?? ''))
const listaDe = (s: string): (string | number)[][] =>
  s.split(';').map(t => t.trim()).filter(t => t !== '').map(vetorDe)
const listaTexto = (v: unknown): string =>
  Array.isArray(v) ? v.map(p => (Array.isArray(p) ? p.join(', ') : String(p))).join('; ') : ''
const indicesDe = (s: string): number[] =>
  s.split(',').map(t => t.trim()).filter(t => t !== '').map(Number).filter(Number.isInteger)
const indicesTexto = (v: unknown): string => (Array.isArray(v) ? v.join(', ') : '')

/** Controle do painel para um campo: `ler` devolve o valor do rascunho plano; `por` põe um valor vindo da feature. */
function controle(c: Campo, id: string, p: PedidoPainel): Controle {
  switch (c.tipo) {
    case 'select':
    case 'alvo':
    case 'sketch': {
      const opcoes: [string, string][] =
        c.tipo === 'alvo' ? [['', T.painel.semAlvo], ...p.corpos.map((x): [string, string] => [x, x])]
          : c.tipo === 'sketch' ? [['', T.painel.nenhum], ...p.sketches.map((x): [string, string] => [x, x])]
            : (c.opcoes ?? [])
      const sel = el('select', { id, ariaLabel: c.rotulo }, ...opcoes.map(([v, r]) => el('option', { value: v, textContent: r })))
      return { nodo: sel, ler: () => sel.value, por: v => { sel.value = String(v ?? '') } }
    }
    case 'bool': {
      const cb = el('input', { type: 'checkbox', id, ariaLabel: c.rotulo })
      return { nodo: cb, ler: () => cb.checked, por: v => { cb.checked = v === true } }
    }
    case 'corpos': {
      const boxes = p.corpos.map((x, i) => {
        const b = el('input', { type: 'checkbox', id: `${id}-${i}`, value: x })
        return { b, nodo: el('label', {}, b, x) }
      })
      return {
        nodo: el('div', { class: 'pf-lista', id }, ...boxes.map(o => o.nodo)),
        ler: () => boxes.filter(o => o.b.checked).map(o => o.b.value),
        por: v => { const sel = Array.isArray(v) ? v.map(String) : []; boxes.forEach(o => { o.b.checked = sel.includes(o.b.value) }) },
      }
    }
    case 'plano': {
      const base = el('select', { id, ariaLabel: c.rotulo }, ...(['XY', 'XZ', 'YZ'] as const).map(b => el('option', { value: b, textContent: b })))
      const off = el('input', { type: 'text', id: `${id}-offset`, ariaLabel: T.painel.offset })
      return {
        nodo: el('div', { class: 'pf-plano' }, base, off),
        ler: () => planoDe(base.value as 'XY' | 'XZ' | 'YZ', off.value),
        por: v => { if (!v) return; const r = planoParaCampo(v as PlanoCampo); base.value = r.base; off.value = r.offset },
      }
    }
    case 'listaVec2': {
      const t = el('input', { type: 'text', id, ariaLabel: c.rotulo, placeholder: T.painel.exemplos.lista })
      return { nodo: t, ler: () => listaDe(t.value), por: v => { t.value = listaTexto(v) } }
    }
    case 'perfis': {
      const t = el('input', { type: 'text', id, ariaLabel: c.rotulo, placeholder: T.painel.exemplos.indices })
      return { nodo: t, ler: () => indicesDe(t.value), por: v => { t.value = indicesTexto(v) } }
    }
    case 'vec2':
    case 'vec3': {
      const t = el('input', { type: 'text', id, ariaLabel: c.rotulo })
      return { nodo: t, ler: () => vetorDe(t.value), por: v => { t.value = vetorTexto(v) } }
    }
    default: {
      const t = el('input', { type: 'text', id, ariaLabel: c.rotulo })
      return { nodo: t, ler: () => normalizaNum(t.value), por: v => { t.value = vetorTexto(v) } }
    }
  }
}

export function abrePainel(host: HTMLElement, p: PedidoPainel): { fecha(): void; feature(): Feature; foco(): void } {
  const id = p.feature.id
  const tipo = p.feature.tipo
  const esq = ESQUEMAS[tipo]
  if (!esq) throw new Error(`Tipo de feature sem esquema: ${tipo}.`)
  host.replaceChildren()

  const flat = fromFeature(p.feature)
  const itens: Item[] = esq.campos.map(c => {
    const idc = `pf-${c.chave}`
    const ctrl = controle(c, idc, p)
    const linha = el('div', { class: 'pf-linha' }, el('label', { htmlFor: idc, textContent: c.rotulo }), ctrl.nodo)
    const v = flat[c.chave] ?? (c.padrao === undefined ? undefined : JSON.parse(JSON.stringify(c.padrao)))
    ctrl.por(v)
    return { campo: c, linha, ler: ctrl.ler }
  })

  const msgs = el('ul', { class: 'pf-msgs' })
  const titulo = el('h2', { class: 'pf-titulo', textContent: p.nova ? T.painel.titulo.nova(esq.rotulo) : T.painel.titulo.editar(id) })
  const acoes = el('div', { class: 'pf-acoes' }, botao(T.painel.ok, () => confirma()), botao(T.painel.cancelar, () => p.aoCancela()))
  const raiz = el('div', { class: 'pf-painel' }, titulo, ...itens.map(i => i.linha), msgs, acoes)
  host.append(raiz)

  /** Lê os controles, aplica o mostraSe e devolve o rascunho plano com só os campos visíveis. */
  function montaRascunho(): Feature {
    const cru: Feature = { id, tipo }
    for (const it of itens) cru[it.campo.chave] = it.ler()
    const vis: Feature = { id, tipo }
    for (const it of itens) {
      const mostra = it.campo.mostraSe?.(cru) ?? true
      it.linha.hidden = !mostra
      if (mostra) vis[it.campo.chave] = cru[it.campo.chave]
    }
    return vis
  }

  function atualiza() {
    const vis = montaRascunho()
    msgs.replaceChildren(...valida(vis).map(m => el('li', { textContent: m })))
    p.aoPrevia(toFeature(vis))
  }

  function confirma() { p.aoConfirma(toFeature(montaRascunho())) }

  const aoMudar = () => atualiza()
  const aoTecla = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); p.aoCancela(); return }
    if (e.key === 'Enter' && !e.shiftKey && e.target instanceof HTMLInputElement) {
      e.preventDefault(); e.stopPropagation(); confirma()
    }
  }
  raiz.addEventListener('input', aoMudar)
  raiz.addEventListener('change', aoMudar)
  host.addEventListener('keydown', aoTecla)
  montaRascunho() // só ajusta a visibilidade inicial; a prévia começa com a primeira mudança

  return {
    fecha() {
      raiz.removeEventListener('input', aoMudar)
      raiz.removeEventListener('change', aoMudar)
      host.removeEventListener('keydown', aoTecla)
      host.replaceChildren()
    },
    feature: () => toFeature(montaRascunho()),
    foco() { raiz.querySelector<HTMLElement>('input, select')?.focus() },
  }
}
