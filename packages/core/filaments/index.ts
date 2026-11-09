// Filamentos do MVP (PROJETO_BASE §3.4). Valores típicos de mercado [VERIFICAR], não medidos.
import pla from './pla.json' with { type: 'json' }
import petg from './petg.json' with { type: 'json' }
import tpu from './tpu.json' with { type: 'json' }
import absAsa from './abs-asa.json' with { type: 'json' }

export interface Filamento {
  id: string
  nome: string
  densidade: number // g/cm³ (ABS/ASA: média das variantes)
  temp: { bico: number[]; mesa: number[] } // [mín, máx] °C
  regras: {
    overhangMax: number
    paredeMin: number
    encolhimentoXY: number // fração (0,0065 = 0,65 %)
    folgaPadrao: { justo: number; deslizante: number; livre: number }
    requerCamaraFechada: boolean
    flexivel: boolean
  }
  compat: Record<string, string> // id da impressora → "ok" | "aviso"
}

export const filamentos: Filamento[] = [pla, petg, tpu, absAsa]

export const filamentoPorId = (id: string): Filamento | undefined => filamentos.find(f => f.id === id)
