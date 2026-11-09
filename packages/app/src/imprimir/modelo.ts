// Lógica pura do painel Imprimir (sem DOM): verificação, avisos e massa do projeto. Testável no Node.
import type { Documento } from '@3dm/core/doc'
import type { EntradaMalha } from '@3dm/core/malha'
import { avisosFilamento, massaGramas, verificar, type Achado } from '@3dm/core/imprimir'
import { impressoraPorId, type Impressora } from '@3dm/core/printers'
import { filamentoPorId, type Filamento } from '@3dm/core/filaments'

export interface Painel {
  impressora: Impressora
  filamento: Filamento
  achados: Achado[]
  massaG: number
  temBloqueio: boolean
  slotsDisponiveis: number
}

/** Slots que um corpo pode escolher: 1 sem AMS, 4 com AMS. */
export const slotsDe = (ams: boolean): number => (ams ? 4 : 1)

/** Verifica os corpos visíveis (ocultos ficam de fora) e soma a massa. */
export function calculaPainel(doc: Documento, corpos: ReadonlyMap<string, EntradaMalha>, ocultos: ReadonlySet<string>): Painel {
  const impressora = impressoraPorId(doc.impressora)
  if (!impressora) throw new Error(`impressora desconhecida: ${doc.impressora}`)
  const filamento = filamentoPorId(doc.filamento ?? impressora.filamentoPadrao)
  if (!filamento) throw new Error(`filamento desconhecido: ${doc.filamento ?? impressora.filamentoPadrao}`)

  const visiveis = [...corpos].filter(([nome]) => !ocultos.has(nome))
  const achados = [
    ...verificar({ impressora, filamento, corpos: visiveis.map(([nome, malha]) => ({ nome, malha })) }),
    ...avisosFilamento({ impressora, filamento, corpos: visiveis.map(([nome]) => ({ nome, slot: doc.aparencia[nome]?.slot ?? 1 })) }),
  ]
  const massaG = visiveis.reduce((soma, [, malha]) => soma + massaGramas(malha, filamento), 0)
  return {
    impressora, filamento, achados, massaG,
    temBloqueio: achados.some(a => a.severidade === 'bloqueio'),
    slotsDisponiveis: slotsDe(impressora.ams),
  }
}

/** Gramas com 1 casa decimal e vírgula: 9.92 vira "9,9". */
export const fmtGramas = (g: number): string => g.toFixed(1).replace('.', ',')
