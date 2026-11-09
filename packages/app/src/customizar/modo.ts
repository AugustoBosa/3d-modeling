// Modo customizar: formulário dos parâmetros expostos, entrada por hash e valores originais. Texto de UI só via textos.ts.
import { definirParametroCompleto } from '@3dm/core/features'
import type { Documento, Exposto } from '@3dm/core/doc'
import type { Projeto } from '../projeto.ts'
import { T } from '../textos.ts'
import { botao, campo, controle, el } from '../ui.ts'
import { agrupa, aplicaValores, hashDeValores, lerHash, origemUrl, validaRemoto, valoresAtuais } from './schema.ts'

export class ErroOpcoes extends Error {
  codigo: 'vazio' | 'sem-igual' | 'valor-invalido'
  linha: number
  constructor(codigo: 'vazio' | 'sem-igual' | 'valor-invalido', linha: number) {
    super(`opcoes: ${codigo}${linha ? ` na linha ${linha}` : ''}`)
    this.codigo = codigo
    this.linha = linha
  }
}

/** Texto `rotulo=valor` por linha (vazias ignoradas). Valor aceita vírgula decimal. Erro com código e número da linha. */
export function parseOpcoes(texto: string): { rotulo: string; valor: number }[] {
  const out: { rotulo: string; valor: number }[] = []
  texto.split('\n').forEach((bruta, i) => {
    const linha = bruta.trim()
    if (linha === '') return
    const j = linha.indexOf('=')
    const rotulo = j < 0 ? '' : linha.slice(0, j).trim()
    if (rotulo === '') throw new ErroOpcoes('sem-igual', i + 1)
    const v = linha.slice(j + 1).trim()
    const valor = Number(v.replace(',', '.'))
    if (v === '' || !Number.isFinite(valor)) throw new ErroOpcoes('valor-invalido', i + 1)
    out.push({ rotulo, valor })
  })
  if (out.length === 0) throw new ErroOpcoes('vazio', 0)
  return out
}

export interface Customizar {
  readonly ativo: boolean
  entra(): void
  sai(): void
  atualiza(): void
  iniciaPorHash(hash: string): Promise<boolean>
  link(): string
  valoresOriginais(): void
}

export interface DadosCustomizar {
  projeto: Projeto
  host: HTMLElement
  aviso(t: string, erro?: boolean): void
  confirma(t: string): boolean
  buscaTexto?: (url: string) => Promise<string>
}

const buscaPadrao = async (url: string): Promise<string> => {
  const r = await fetch(url, { credentials: 'omit' })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.text()
}

const msg = (err: unknown): string => err instanceof Error ? err.message : String(err)
const ESPERA = 80

export function criaCustomizar(d: DadosCustomizar): Customizar {
  const buscaTexto = d.buscaTexto ?? buscaPadrao
  let ativo = false
  let original: Documento | undefined // valores ao entrar (ou como chegaram do link)
  let inicial: Documento | undefined // documento antes dos valores do hash; vira `original` no próximo entra()
  let assinatura = ''
  const sincs = new Map<string, (v: number) => void>() // atualiza os controles sem recriá-los (mantém o foco)
  const pendentes = new Map<string, string>()
  let tEspera = 0

  function agenda(nome: string, texto: string) {
    pendentes.set(nome, texto)
    clearTimeout(tEspera)
    tEspera = window.setTimeout(descarrega, ESPERA)
  }

  function descarrega() {
    for (const [nome, texto] of pendentes) {
      const doc = d.projeto.doc
      if (!Object.hasOwn(doc.parametros, nome)) continue
      try { d.projeto.executa(definirParametroCompleto(nome, { ...doc.parametros[nome], expr: texto })) }
      catch (err) { d.aviso(msg(err), true) }
    }
    pendentes.clear()
  }

  function campoExposto(pai: HTMLElement, e: Exposto, v: number) {
    const nome = e.parametro
    if (e.tipo === 'sim-nao') {
      const estado = el('span', { textContent: v === 1 ? T.customizar.sim : T.customizar.nao })
      const cb = el('input', { type: 'checkbox', checked: v === 1 })
      cb.onchange = () => {
        estado.textContent = cb.checked ? T.customizar.sim : T.customizar.nao
        agenda(nome, cb.checked ? '1' : '0')
      }
      pai.append(el('label', { class: 'sn' }, e.rotulo, estado, cb))
      sincs.set(nome, x => {
        cb.checked = x === 1
        estado.textContent = x === 1 ? T.customizar.sim : T.customizar.nao
      })
      return
    }
    if (e.tipo === 'lista') {
      const sel = el('select')
      sel.append(...(e.opcoes ?? []).map(o => new Option(o.rotulo, String(o.valor))))
      sel.value = String(v)
      sel.onchange = () => agenda(nome, sel.value)
      pai.append(campo(e.rotulo, sel))
      sincs.set(nome, x => { sel.value = String(x) })
      return
    }
    const lo = e.min ?? 0
    const hi = e.max ?? Math.max(lo + 1, 100)
    const ajusta = controle(pai, e.rotulo, Number.isFinite(v) ? v : lo, lo, hi, n => agenda(nome, String(n)), e.passo ?? 1)
    sincs.set(nome, x => ajusta(Number.isFinite(x) ? x : lo))
  }

  function renderiza() {
    const doc = d.projeto.doc
    const atuais = valoresAtuais(doc)
    sincs.clear()
    assinatura = JSON.stringify(doc.expostos ?? [])
    const raiz = el('div', { class: 'cz' })
    raiz.append(
      el('h2', { textContent: T.customizar.titulo }),
      el('div', { class: 'cz-acoes' },
        botao(T.customizar.reiniciar, () => valoresOriginais()),
        botao(T.customizar.ajusteAbre, () => sai()),
        botao(T.customizar.sair, () => sai())),
    )
    const expostos = doc.expostos ?? []
    if (expostos.length === 0) raiz.append(el('p', { class: 'nota', textContent: T.customizar.semAcao }))
    for (const g of agrupa(expostos)) {
      const fs = el('fieldset', {}, ...(g.grupo ? [el('legend', { textContent: g.grupo })] : []))
      for (const e of g.itens) campoExposto(fs, e, atuais[e.parametro])
      raiz.append(fs)
    }
    d.host.replaceChildren(raiz)
  }

  function entra() {
    if (!ativo) original = structuredClone(inicial ?? d.projeto.doc)
    inicial = undefined
    ativo = true
    document.body.classList.add('customizar')
    renderiza()
  }

  function sai() {
    clearTimeout(tEspera)
    descarrega()
    ativo = false
    document.body.classList.remove('customizar')
    sincs.clear()
    d.host.replaceChildren()
  }

  function atualiza() {
    if (!ativo) return
    if (JSON.stringify(d.projeto.doc.expostos ?? []) !== assinatura) { renderiza(); return }
    const atuais = valoresAtuais(d.projeto.doc)
    for (const [nome, sinc] of sincs) sinc(atuais[nome])
  }

  function valoresOriginais() {
    if (!ativo || !original) return
    pendentes.clear()
    clearTimeout(tEspera)
    d.projeto.substitui(structuredClone(original))
    renderiza()
  }

  async function iniciaPorHash(hash: string): Promise<boolean> {
    const h = lerHash(hash)
    if (!h.ativo) return false
    let base = d.projeto.doc
    if (h.projeto !== undefined) {
      const o = origemUrl(h.projeto)
      if (!o.ok) { d.aviso(T.customizar.origemInsegura, true); return false }
      if (!d.confirma(T.customizar.avisoOrigem(o.host))) { d.aviso(T.customizar.cancelado); return false }
      let texto: string
      try { texto = await buscaTexto(h.projeto) }
      catch (err) { d.aviso(T.customizar.baixarFalhou(msg(err)), true); return false }
      try { base = validaRemoto(texto) }
      catch (err) { d.aviso(T.customizar.invalido(msg(err)), true); return false }
      d.projeto.substitui(base)
    }
    inicial = structuredClone(base)
    const { doc, avisos } = aplicaValores(base, h.valores)
    if (Object.keys(h.valores).length > 0) d.projeto.substitui(doc)
    for (const a of avisos) {
      if (a.tipo === 'ajustado') d.aviso(T.customizar.valorAjustado(a.parametro, String(a.final)))
      else d.aviso(T.customizar.valorInvalido(a.parametro, a.valor))
    }
    entra()
    return true
  }

  return {
    get ativo() { return ativo },
    entra, sai, atualiza, iniciaPorHash, valoresOriginais,
    link: () => location.origin + location.pathname + hashDeValores(d.projeto.doc),
  }
}
