// Contrato dos comandos de edição do sketch (M CO RO SC MI E Q TR EX O F CHA AR ARP). Cada editor é uma lista ESTÁTICA de passos;
// o executor (sessao.ts) coleta uma resposta por passo e então chama `aplica` dentro de um comando de undo (editaSketch).
import type { Pt, SketchFeature } from '@3dm/core/sketch'

export type PassoEd =
  | { k: 'selecao'; prompt: string } // usa a seleção atual; se vazia, pede (cliques/janela + Enter). Resp.sel
  | { k: 'ponto'; prompt: string } // clique ou coordenada. Resp.p
  | { k: 'valor'; prompt: string } // número/expressão. Resp.v
  | { k: 'opcao'; prompt: string; opcoes: string[] } // Resp.opcao (palavra inteira da lista)
  | { k: 'entidade'; prompt: string } // clique numa entidade. Resp.id e Resp.p (ponto clicado)

export interface Resp { sel?: string[]; p?: Pt; v?: number; opcao?: string; id?: string }

export interface Editor {
  readonly nome: string
  readonly passos: PassoEd[]
  /** true (TR, EX): depois de aplicar, volta ao ÚLTIMO passo em vez de terminar; Esc/Enter terminam. */
  readonly repete?: boolean
  /** Muta o sketch (dentro de editaSketch). Uma Resp por passo, na ordem. Pode lançar Error em pt-BR. */
  aplica(sk: SketchFeature, r: Resp[]): void
}
export type FabricaEditor = () => Editor
