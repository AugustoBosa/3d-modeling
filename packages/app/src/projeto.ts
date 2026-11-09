// Documento aberto + pilha de undo/redo. UI e (depois) MCP editam só por aqui.
import { criaPilha, novoDocumento } from '@3dm/core/doc'
import type { Comando, Documento, Pilha } from '@3dm/core/doc'

export interface Projeto {
  readonly doc: Documento
  readonly podeDesfazer: boolean
  readonly podeRefazer: boolean
  executa(c: Comando<Documento>): void
  /** Devolve o comando desfeito/refeito (ou null se não havia). */
  desfaz(): Comando<Documento> | null
  refaz(): Comando<Documento> | null
  /** Desfaz sem deixar entrada para refazer. */
  desfazSemRefazer(so?: Comando<Documento>): Comando<Documento> | null
  /** Troca o documento inteiro (novo, abrir, recuperar) e zera a pilha. */
  substitui(d: Documento): void
  /** Chamado depois de qualquer mudança no documento ou na pilha. */
  aoMudar(f: () => void): void
}

export function criaProjeto(inicial: Documento = novoDocumento()): Projeto {
  let doc = inicial
  const ouvintes: (() => void)[] = []
  const avisa = () => ouvintes.forEach(f => f())
  let pilha: Pilha<Documento> = criaPilha(doc, avisa)
  return {
    get doc() { return doc },
    get podeDesfazer() { return pilha.podeDesfazer },
    get podeRefazer() { return pilha.podeRefazer },
    executa: c => pilha.executa(c),
    desfaz: () => pilha.desfaz(),
    refaz: () => pilha.refaz(),
    desfazSemRefazer: so => pilha.desfazSemRefazer(so),
    substitui(d) { doc = d; pilha = criaPilha(doc, avisa); avisa() },
    aoMudar: f => { ouvintes.push(f) },
  }
}
