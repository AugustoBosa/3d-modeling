// Protocolo JSON da ponte WebSocket MCP <-> app (PROJETO_BASE §5.7). Único arquivo de contrato:
// o app (F4a-04) importa estes tipos. Só tipos e guardas; sem dependências.
import type { Documento } from '@3dm/core/doc'

export const PORTA_PADRAO = 47800
export const VERSAO_PROTOCOLO = 1

/** MCP -> app: executa uma ação (mesmo nome e args das tools MCP) pela pilha de undo do app. */
export interface Pedido {
  tipo: 'pedido'
  id: string
  acao: string
  args: Record<string, unknown>
}

/** Ações que o app entende (campo `acao` do Pedido) e seus argumentos/resultados. */
export interface ArgsAplicar { doc: Documento; nome: string } // troca o documento por UM comando desfazível ("nome")
export interface ResultadoDesfaz { comando: string | null }
export interface ArgsCaptura { vistas: string[]; mostrarVolume?: boolean } // mostrarVolume: inclui mesa/volume/grade/eixos (padrão false) // 'iso' | 'frente' | 'topo' | 'direita'
export interface ResultadoCaptura { imagens: { vista: string; png: string }[] } // png em base64
export type AcaoPonte = 'aplicar' | 'desfazer' | 'refazer' | 'captura'

/** app -> MCP: resultado de um Pedido (mesmo id). */
export type Resposta =
  | { tipo: 'resposta'; id: string; ok: true; resultado: unknown }
  | { tipo: 'resposta'; id: string; ok: false; erro: string }

/** app -> MCP: estado atual do documento (enviado ao conectar e a cada mudança). */
export interface EventoEstado {
  tipo: 'estado'
  doc: Documento
  podeDesfazer: boolean
  podeRefazer: boolean
}

/** app -> MCP: primeira mensagem depois de conectar. */
export interface Ola {
  tipo: 'ola'
  versao: number
  app: string
}

/** MCP -> app: resposta ao `ola`. */
export interface OlaOk {
  tipo: 'ola-ok'
  versao: number
}

export type MensagemDoApp = Ola | Resposta | EventoEstado
export type MensagemDoServidor = OlaOk | Pedido

const objeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Texto JSON -> mensagem do app, ou null se não for uma mensagem conhecida. */
export function lerMensagemDoApp(texto: string): MensagemDoApp | null {
  let m: unknown
  try { m = JSON.parse(texto) } catch { return null }
  if (!objeto(m)) return null
  if (m.tipo === 'ola' && typeof m.versao === 'number' && typeof m.app === 'string') return m as unknown as Ola
  if (m.tipo === 'resposta' && typeof m.id === 'string' && typeof m.ok === 'boolean') return m as unknown as Resposta
  if (m.tipo === 'estado' && objeto(m.doc)) return m as unknown as EventoEstado
  return null
}

export const textoMensagem = (m: MensagemDoServidor | MensagemDoApp): string => JSON.stringify(m)
