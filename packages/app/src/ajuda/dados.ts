// Tabela de atalhos (PROJETO_BASE §7.2 e §7.3) e linhas da ajuda (comandos do registro + atalhos). Puro, sem DOM.
import type { Registro } from '../linha/registro.ts'
import { T } from '../textos.ts'

export const ATALHOS: { grupo: string; atalho: string; descricao: string }[] = [
  { grupo: T.ajuda.grupos.funcao, atalho: 'F1', descricao: T.ajuda.atalho.f1 },
  { grupo: T.ajuda.grupos.funcao, atalho: 'F2', descricao: T.ajuda.atalho.f2 },
  { grupo: T.ajuda.grupos.funcao, atalho: 'F3', descricao: T.ajuda.atalho.f3 },
  { grupo: T.ajuda.grupos.funcao, atalho: 'F7', descricao: T.ajuda.atalho.f7 },
  { grupo: T.ajuda.grupos.funcao, atalho: 'F8', descricao: T.ajuda.atalho.f8 },
  { grupo: T.ajuda.grupos.funcao, atalho: 'F9', descricao: T.ajuda.atalho.f9 },
  { grupo: T.ajuda.grupos.funcao, atalho: 'F10', descricao: T.ajuda.atalho.f10 },
  { grupo: T.ajuda.grupos.funcao, atalho: 'F11', descricao: T.ajuda.atalho.f11 },
  { grupo: T.ajuda.grupos.funcao, atalho: 'F12', descricao: T.ajuda.atalho.f12 },
  { grupo: T.ajuda.grupos.imediatas, atalho: 'Tab', descricao: T.ajuda.atalho.tab },
  { grupo: T.ajuda.grupos.imediatas, atalho: 'G', descricao: T.ajuda.atalho.g },
  { grupo: T.ajuda.grupos.imediatas, atalho: 'R', descricao: T.ajuda.atalho.r },
  { grupo: T.ajuda.grupos.imediatas, atalho: 'S', descricao: T.ajuda.atalho.s },
  { grupo: T.ajuda.grupos.imediatas, atalho: 'X / Y / Z', descricao: T.ajuda.atalho.xyz },
  { grupo: T.ajuda.grupos.imediatas, atalho: 'Shift+A', descricao: T.ajuda.atalho.shiftA },
  { grupo: T.ajuda.grupos.imediatas, atalho: 'Shift+D', descricao: T.ajuda.atalho.shiftD },
  { grupo: T.ajuda.grupos.imediatas, atalho: 'H', descricao: T.ajuda.atalho.h },
  { grupo: T.ajuda.grupos.imediatas, atalho: 'Alt+H', descricao: T.ajuda.atalho.altH },
  { grupo: T.ajuda.grupos.imediatas, atalho: 'Shift+H', descricao: T.ajuda.atalho.shiftH },
  { grupo: T.ajuda.grupos.imediatas, atalho: 'A', descricao: T.ajuda.atalho.a },
  { grupo: T.ajuda.grupos.imediatas, atalho: 'Ctrl+A', descricao: T.ajuda.atalho.ctrlA },
  { grupo: T.ajuda.grupos.imediatas, atalho: 'Alt+A', descricao: T.ajuda.atalho.altA },
  { grupo: T.ajuda.grupos.imediatas, atalho: 'Numpad 1', descricao: T.ajuda.atalho.num1 },
  { grupo: T.ajuda.grupos.imediatas, atalho: 'Numpad 3', descricao: T.ajuda.atalho.num3 },
  { grupo: T.ajuda.grupos.imediatas, atalho: 'Numpad 7', descricao: T.ajuda.atalho.num7 },
  { grupo: T.ajuda.grupos.imediatas, atalho: 'Numpad 5', descricao: T.ajuda.atalho.num5 },
  { grupo: T.ajuda.grupos.imediatas, atalho: 'Numpad .', descricao: T.ajuda.atalho.numPonto },
  { grupo: T.ajuda.grupos.imediatas, atalho: 'Home', descricao: T.ajuda.atalho.home },
  { grupo: T.ajuda.grupos.imediatas, atalho: 'N', descricao: T.ajuda.atalho.n },
  { grupo: T.ajuda.grupos.imediatas, atalho: 'Del / X', descricao: T.ajuda.atalho.del },
  { grupo: T.ajuda.grupos.imediatas, atalho: 'Esc', descricao: T.ajuda.atalho.esc },
  { grupo: T.ajuda.grupos.imediatas, atalho: T.ajuda.teclas.enterEspaco, descricao: T.ajuda.atalho.enter },
  { grupo: T.ajuda.grupos.imediatas, atalho: 'Ctrl+Z', descricao: T.ajuda.atalho.ctrlZ },
  { grupo: T.ajuda.grupos.imediatas, atalho: 'Ctrl+Y', descricao: T.ajuda.atalho.ctrlY },
  { grupo: T.ajuda.grupos.imediatas, atalho: 'Ctrl+S', descricao: T.ajuda.atalho.ctrlS },
  { grupo: T.ajuda.grupos.imediatas, atalho: 'Ctrl+K', descricao: T.ajuda.atalho.ctrlK },
  { grupo: T.ajuda.grupos.sketch, atalho: 'H', descricao: T.ajuda.atalho.sH },
  { grupo: T.ajuda.grupos.sketch, atalho: 'V', descricao: T.ajuda.atalho.sV },
  { grupo: T.ajuda.grupos.sketch, atalho: 'I', descricao: T.ajuda.atalho.sI },
  { grupo: T.ajuda.grupos.sketch, atalho: 'T', descricao: T.ajuda.atalho.sT },
  { grupo: T.ajuda.grupos.sketch, atalho: 'E', descricao: T.ajuda.atalho.sE },
  { grupo: T.ajuda.grupos.sketch, atalho: 'B', descricao: T.ajuda.atalho.sB },
  { grupo: T.ajuda.grupos.sketch, atalho: 'D', descricao: T.ajuda.atalho.sD },
]

export interface LinhaAjuda { tipo: 'comando' | 'atalho'; nome: string; alias: string; atalho: string; descricao: string }

/** Comandos do registro (nome e aliases) seguidos dos atalhos. Linhas de atalho não têm nome. */
export function linhasAjuda(reg: Registro): LinhaAjuda[] {
  const comandos = reg.lista().map(c => ({ tipo: 'comando' as const, nome: c.nome, alias: c.aliases.join(', '), atalho: '', descricao: c.descricao }))
  const atalhos = ATALHOS.map(a => ({ tipo: 'atalho' as const, nome: '', alias: '', atalho: a.atalho, descricao: a.descricao }))
  return [...comandos, ...atalhos]
}

/** Sem acento e sem maiúsculas. */
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Todas as palavras do texto devem aparecer em nome, alias, atalho ou descrição. */
export function filtra(linhas: LinhaAjuda[], texto: string): LinhaAjuda[] {
  const palavras = norm(texto).split(/\s+/).filter(Boolean)
  if (!palavras.length) return linhas
  return linhas.filter(l => {
    const alvo = norm([l.nome, l.alias, l.atalho, l.descricao].join(' '))
    return palavras.every(p => alvo.includes(p))
  })
}
