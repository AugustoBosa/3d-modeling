// Contrato da regeneração (F2-03). A ligação com o tipo Feature do documento é da rodada 2.
import type { Malha } from '../malha/tipos.ts'
import type { Perfil, PlanoLocal } from '../kernel/tipos.ts'
import type { FeatureGeo } from '../features/tipos.ts'

/** Entrada da lista de features: geometria, ou um sketch (sem geometria própria; só alimenta o resolvedor). */
export type ItemRegen =
  | FeatureGeo
  | { id: string; tipo: 'sketch'; suprimida?: boolean }
  | { id: string; tipo: 'invalida'; causa: string; correcao: string; suprimida?: boolean } // expressão de campo inválida (features/doc.ts)

export interface EntradaRegen {
  features: ItemRegen[]
  /** Id da última feature ativa (rollback). null = todas. */
  marcador: string | null
  /** Resolvedor injetado: perfis do sketch (rodada 2: vem de packages/core/src/sketch). Pode lançar. */
  resolvedor: (sketchId: string) => Perfil[]
  /** Plano do sketch (rodada 2: vem do sketch). Pode lançar. */
  planoDe: (sketchId: string) => PlanoLocal
  /** Tolerância cordal em mm (padrão TOL_PREVIA). */
  tol?: number
}

export type EstadoFeature = 'ok' | 'erro' | 'suspensa' | 'revertida' | 'suprimida'
export interface StatusFeature { estado: EstadoFeature; erro?: { causa: string; correcao: string } }

export interface ResultadoRegen {
  /** Malhas dos corpos finais (estado após a última feature válida, respeitando o marcador). */
  corpos: Map<string, Malha>
  status: Map<string, StatusFeature>
  /** Ids das features efetivamente recalculadas nesta chamada (ordem do histórico). */
  recalculadas: string[]
  ms: number
}
