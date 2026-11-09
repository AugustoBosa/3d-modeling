import type { EntradaMalha } from '../malha/tipos.ts'
import { volume } from '../malha/malha.ts'
import type { Impressora } from '../../printers/index.ts'
import type { Filamento } from '../../filaments/index.ts'
import type { Achado } from './tipos.ts'
import { MSG } from './mensagens.ts'

/** Massa em gramas: volume em mm³ → cm³ (÷1000) × densidade (g/cm³). */
export function massaGramas(malha: EntradaMalha, fil: Filamento): number {
  // ponytail: sólida; preenchimento do fatiador reduz
  return Math.abs(volume(malha)) / 1000 * fil.densidade
}

export interface OpcoesAvisosFilamento {
  impressora: Impressora
  filamento: Filamento
  corpos?: { nome: string; slot?: number }[]
}

/** Avisos de compatibilidade impressora × filamento e de corpos (slot AMS). Funções puras. */
export function avisosFilamento(o: OpcoesAvisosFilamento): Achado[] {
  const { impressora: imp, filamento: fil } = o
  const achados: Achado[] = []
  const aviso = fil.compat[imp.id] === 'aviso'
  let jaAvisou = false

  if (fil.regras.requerCamaraFechada && !imp.camaraFechada) {
    achados.push({ severidade: 'aviso', codigo: 'camara-aberta', mensagem: MSG.camaraAberta(fil.nome, imp.nome) })
    jaAvisou = true
  }
  if (fil.regras.flexivel && aviso) {
    achados.push({ severidade: 'aviso', codigo: 'flexivel-bowden', mensagem: MSG.flexivelBowden(fil.nome, imp.nome) })
    jaAvisou = true
  }
  if (aviso && !jaAvisou) {
    achados.push({ severidade: 'aviso', codigo: 'compat-aviso', mensagem: MSG.compatAviso(fil.nome, imp.nome) })
  }
  if (fil.regras.encolhimentoXY > 0) {
    achados.push({
      severidade: 'info',
      codigo: 'encolhimento',
      mensagem: MSG.encolhimento(fil.nome, fil.regras.encolhimentoXY * 100),
    })
  }
  for (const c of o.corpos ?? []) {
    if (c.slot !== undefined && c.slot > 1 && !imp.ams) {
      achados.push({ severidade: 'aviso', codigo: 'sem-ams', mensagem: MSG.semAms(c.nome, c.slot, imp.nome), corpo: c.nome })
    }
  }
  return achados
}
