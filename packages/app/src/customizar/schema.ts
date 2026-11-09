// Lógica pura do modo customizar (sem DOM): lê o hash, valida o projeto remoto como dados e aplica valores com limites.
// Nenhum texto de UI aqui: os erros são técnicos e a tela mapeia os códigos para textos.ts.
import { lerDocumento, NOME_PARAMETRO } from '@3dm/core/doc'
import type { Documento, Exposto } from '@3dm/core/doc'
import { avalia } from '@3dm/core/expr'

export type Aviso = { tipo: 'invalido' | 'ajustado' | 'desconhecido'; parametro: string; valor: string; final?: number }

const LIMITE_REMOTO = 5_000_000
const PROIBIDAS = ['__proto__', 'constructor', 'prototype']
const SIM = ['1', 'sim', 'true']
const NAO = ['0', 'n\u00e3o', 'nao', 'false']

const seguro = (s: string): string | undefined => {
  try { return decodeURIComponent(s) } catch { return undefined }
}

/** Hash `#customizar&projeto=<url>&L=90&H=40`. Sem o token `customizar` o modo n00e3o está ativo. */
export function lerHash(hash: string): { ativo: boolean; projeto?: string; valores: Record<string, string> } {
  const partes = hash.replace(/^#/, '').split('&')
  const valores: Record<string, string> = {}
  if (!partes.includes('customizar')) return { ativo: false, valores }
  let projeto: string | undefined
  for (const parte of partes) {
    const i = parte.indexOf('=')
    if (i <= 0) continue
    const chave = parte.slice(0, i)
    const valor = seguro(parte.slice(i + 1))
    if (valor === undefined) continue
    if (chave === 'projeto') projeto = valor
    else if (NOME_PARAMETRO.test(chave) && !PROIBIDAS.includes(chave)) valores[chave] = valor
  }
  return { ativo: true, projeto, valores }
}

/** Só https; http apenas para localhost e 127.0.0.1 (desenvolvimento). */
export function origemUrl(url: string): { ok: true; host: string } | { ok: false; motivo: 'invalida' | 'insegura' } {
  let u: URL
  try { u = new URL(url) } catch { return { ok: false, motivo: 'invalida' } }
  const local = u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')
  if (u.protocol === 'https:' || local) return { ok: true, host: u.host }
  return { ok: false, motivo: 'insegura' }
}

/** JSON remoto -> Documento. Só dados: rejeita chaves perigosas em qualquer nível e nada é avaliado. */
export function validaRemoto(texto: string): Documento {
  if (texto.length > LIMITE_REMOTO) throw new Error('projeto grande demais: mais de 5000000 caracteres')
  try {
    JSON.parse(texto, (chave: string, valor: unknown) => {
      if (PROIBIDAS.includes(chave)) throw new Error(`chave proibida: ${chave}`)
      return valor
    })
  } catch (err) {
    throw new Error(`JSON invalido: ${(err as Error).message}`)
  }
  return lerDocumento(texto)
}

/** Valor numérico atual de cada exposto (NaN se a avaliação falhar). */
export function valoresAtuais(doc: Documento): Record<string, number> {
  const out: Record<string, number> = {}
  for (const e of doc.expostos ?? []) {
    const r = avalia(doc.parametros[e.parametro]?.expr ?? '', doc.parametros)
    out[e.parametro] = r.ok ? r.valor : NaN
  }
  return out
}

const numero = (texto: string): number => {
  const t = texto.trim().replace(',', '.')
  const n = t === '' ? NaN : Number(t)
  return Number.isFinite(n) ? n : NaN
}

const arredonda = (n: number): number => Math.round(n * 1e6) / 1e6

/** Converte o texto digitado no valor final do exposto. null = inválido. Ajustado = saiu dos limites ou do passo. */
function normaliza(exp: Exposto, texto: string): { valor: number; ajustado: boolean } | null {
  if (exp.tipo === 'sim-nao') {
    const t = texto.trim().toLowerCase()
    if (SIM.includes(t)) return { valor: 1, ajustado: false }
    if (NAO.includes(t)) return { valor: 0, ajustado: false }
    return null
  }
  const n = numero(texto)
  if (Number.isNaN(n)) return null
  if (exp.tipo === 'lista') {
    return exp.opcoes?.some(o => o.valor === n) ? { valor: n, ajustado: false } : null
  }
  const lo = exp.min ?? -Infinity
  const hi = exp.max ?? Infinity
  let f = Math.min(Math.max(n, lo), hi)
  if (exp.passo !== undefined && exp.passo > 0) {
    const base = exp.min ?? 0
    f = Math.min(Math.max(base + Math.round((f - base) / exp.passo) * exp.passo, lo), hi)
  }
  f = arredonda(f)
  return { valor: f, ajustado: f !== n }
}

/** Devolve um clone com os valores aplicados. O documento original n00e3o muda. Valores fora de expostos são ignorados. */
export function aplicaValores(doc: Documento, valores: Record<string, string>): { doc: Documento; avisos: Aviso[] } {
  const clone = structuredClone(doc)
  const avisos: Aviso[] = []
  for (const [nome, texto] of Object.entries(valores)) {
    const exp = doc.expostos?.find(e => e.parametro === nome)
    if (!exp || !Object.hasOwn(clone.parametros, nome)) {
      avisos.push({ tipo: 'desconhecido', parametro: nome, valor: texto })
      continue
    }
    const r = normaliza(exp, texto)
    if (!r) {
      avisos.push({ tipo: 'invalido', parametro: nome, valor: texto })
      continue
    }
    clone.parametros[nome].expr = String(r.valor)
    if (r.ajustado) avisos.push({ tipo: 'ajustado', parametro: nome, valor: texto, final: r.valor })
  }
  return { doc: clone, avisos }
}

/** Hash com os valores atuais dos expostos (até 6 casas). Valores NaN ficam de fora. */
export function hashDeValores(doc: Documento, projetoUrl?: string): string {
  let h = '#customizar'
  if (projetoUrl) h += `&projeto=${encodeURIComponent(projetoUrl)}`
  const atuais = valoresAtuais(doc)
  for (const e of doc.expostos ?? []) {
    const v = atuais[e.parametro]
    if (Number.isFinite(v)) h += `&${e.parametro}=${String(arredonda(v))}`
  }
  return h
}

/** Agrupa por `grupo` (sem grupo = ''), na ordem de aparição. */
export function agrupa(expostos: Exposto[]): { grupo: string; itens: Exposto[] }[] {
  const mapa = new Map<string, Exposto[]>()
  for (const e of expostos) {
    const g = e.grupo ?? ''
    const lista = mapa.get(g)
    if (lista) lista.push(e)
    else mapa.set(g, [e])
  }
  return [...mapa].map(([grupo, itens]) => ({ grupo, itens }))
}
