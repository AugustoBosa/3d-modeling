// Tipo comum das tools MCP (um arquivo por grupo de tools; tools.ts junta todos).
import type { z } from 'zod'
import type { Sessao } from './sessao.ts'

export interface Tool {
  nome: string
  descricao: string
  entrada: z.ZodRawShape
  /** Argumentos válidos de exemplo (vão para docs://api e são validados no teste). */
  exemplo: Record<string, unknown>
  executa(s: Sessao, args: any): unknown | Promise<unknown>
}
