// Formato `.3dm.json` v1 (PROJETO_BASE §5.2). O documento guarda a receita, nunca a malha.
// Features e restrições ficam abertas aqui: cada fase (F1, F2) define o seu formato e o validador só exige o mínimo.

export interface Parametro {
  expr: string
  comentario?: string
  unidade?: string
}

export interface Feature {
  id: string
  tipo: string
  [campo: string]: unknown
}

/** Parâmetro exposto no modo customizar (F3b-07). Sim/não = 0/1. */
export interface Exposto {
  parametro: string
  rotulo: string
  tipo: 'numero' | 'lista' | 'sim-nao'
  min?: number
  max?: number
  passo?: number
  opcoes?: { rotulo: string; valor: number }[] // tipo 'lista'
  grupo?: string
}

/** Slot do AMS/extrusora: filamento + cor (tabela do projeto). */
export interface SlotAms { filamento: string; cor: string }

export interface Documento {
  formato: '3d-modeling'
  versao: 1
  unidade: 'mm'
  nome?: string // nome do projeto (usado no nome dos arquivos exportados)
  impressora: string
  parametros: Record<string, Parametro>
  features: Feature[]
  marcadorHistorico: string | null
  aparencia: Record<string, { cor: string; slot?: number }> // slot = AMS/extrusora do corpo (1-based; padrão 1)
  filamento?: string // id do filamento ativo (padrão: o da impressora)
  slots?: Record<string, SlotAms> // "1", "2"... (tabela de slots do projeto)
  expostos?: Exposto[]
}
