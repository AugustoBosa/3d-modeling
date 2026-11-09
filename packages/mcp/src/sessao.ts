// Interface da sessão de documento (modo headless hoje; a ponte entra na F4b). Implementada em headless.ts.
import type { Comando, Documento } from '@3dm/core/doc'

export interface Sessao {
  readonly doc: Documento
  readonly podeDesfazer: boolean
  readonly podeRefazer: boolean
  /** Substitui por um documento vazio e zera a pilha. */
  novo(impressora?: string): void
  /** Lê um .3dm.json (caminho relativo à pasta da sessão) e zera a pilha. Lança Error em português se inválido. */
  abrir(caminho: string): void
  /** Grava o documento. Sem caminho, usa o último caminho aberto/salvo ou `<nome|projeto>.3dm.json`. Devolve o caminho absoluto gravado. */
  salvar(caminho?: string): string
  executa(c: Comando<Documento>): void
  /** Nome do comando desfeito/refeito, ou null se não havia. */
  desfaz(): string | null
  refaz(): string | null
  /** Troca o documento (vindo da aba conectada) e zera a pilha local. */
  carrega(d: Documento): void
  /** Caminho absoluto de um arquivo de saída (STL, 3MF, SVG) dentro da pasta da sessão. Lança Error se sair da pasta. */
  caminhoSaida(caminho: string): string
  /** Chamado depois de qualquer mudança (documento ou pilha). */
  aoMudar(f: () => void): void
}
