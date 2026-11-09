// Contrato entre o controlador de sólidos (features/solido.ts) e os módulos de UI do modo Sólido (F2).
// Cada módulo de UI recebe só o que precisa por parâmetro; nenhum importa o controlador.
import type { Feature } from '@3dm/core/doc'
import type { StatusFeature } from '@3dm/core/regen'

export type V3 = [number, number, number]

/** Um corpo regenerado (malha em mm) com as medidas calculadas no controlador. */
export interface CorpoInfo {
  id: string
  pos: Float32Array // x,y,z por vértice
  idx: Uint32Array // 3 índices por triângulo
  bbox: { min: V3; max: V3 }
  volume: number
  fechada: boolean
  tri: number
}

/** Dados que a árvore e os painéis leem do controlador a cada atualização. */
export interface DadosSolido {
  status: ReadonlyMap<string, StatusFeature>
  corpos: ReadonlyMap<string, CorpoInfo>
  /** Feature selecionada na árvore (ou null). */
  selecionada: string | null
  /** Corpos escondidos (olho / H). */
  ocultos: ReadonlySet<string>
  /** Corpos selecionados na vista. */
  corposSelecionados: ReadonlySet<string>
  msUltima: number
}

/** Ações que a árvore dispara no controlador. */
export interface AcoesArvore {
  seleciona(id: string | null): void
  /** Duplo clique: abre o painel de edição da feature. */
  edita(id: string): void
  alternaOlho(corpoOuFeatureId: string): void
  /** null = todas ativas. */
  moveMarcador(id: string | null): void
  suprime(id: string, suprimida: boolean): void
  remove(id: string): void
}

/** Painel de feature (direita): edição com prévia ao vivo. */
export interface PedidoPainel {
  /** Rascunho inicial (nova feature com valores padrão, ou cópia da existente). */
  feature: Feature
  nova: boolean
  /** Ids de corpos existentes (para alvo / ferramentas) e de sketches (para extrude/revolve). */
  corpos: string[]
  sketches: string[]
  /** Chamado a cada mudança de campo (já com expressões como texto). O controlador regenera sem criar undo. */
  aoPrevia(f: Feature): void
  /** Enter / botão OK. */
  aoConfirma(f: Feature): void
  /** Esc / botão Cancelar. */
  aoCancela(): void
}
