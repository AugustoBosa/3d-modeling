// Perfis de impressora: fonte única (PROJETO_BASE §3.3). Valores da P2S ainda são [VERIFICAR] (§3.2).
import megaS from './anycubic-i3-mega-s.json' with { type: 'json' }
import p2s from './bambu-p2s.json' with { type: 'json' }

export interface Impressora {
  id: string
  nome: string
  volume: { x: number; y: number; z: number } // mm
  formaMesa: string
  bicos: number[]
  bicoPadrao: number
  filamentoPadrao: string
  slicer: string // define o "sabor" do 3MF
  camaraFechada: boolean // ABS/ASA avisam em impressora aberta
  ams: boolean
  camada: { padrao: number; min: number; max: number }
  regras: { paredeMin: number; detalheMin: number; overhangMax: number; pontesMax: number }
  calibracao: null // preenchido na F6
}

export const impressoras: Impressora[] = [megaS, p2s]

export const impressoraPorId = (id: string): Impressora | undefined => impressoras.find(p => p.id === id)
