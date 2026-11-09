import { normaliza, type EntradaMalha } from '../malha/tipos.ts'
import { bbox, fechada, volume } from '../malha/malha.ts'
import type { Impressora } from '../../printers/index.ts'
import type { Filamento } from '../../filaments/index.ts'
import type { Achado } from './tipos.ts'
import { MSG } from './mensagens.ts'

export interface OpcoesVerificar {
  impressora: Impressora
  filamento?: Filamento
  corpos: { nome: string; malha: EntradaMalha }[]
  baseMinMm2?: number // padrão 25
}

const TOL = 1e-6
const MESA = 0.01 // a mesa é z = 0
const SUPORTE = 1e-3 // triângulos de apoio: todos os vértices na base da bbox

/** Verificação pura de imprimibilidade por corpo. Nenhum achado = lista vazia. */
export function verificar(o: OpcoesVerificar): Achado[] {
  const baseMin = o.baseMinMm2 ?? 25
  const limiar = Math.min(o.impressora.regras.overhangMax, o.filamento?.regras.overhangMax ?? Infinity)
  const volMesa = [o.impressora.volume.x, o.impressora.volume.y, o.impressora.volume.z]
  const achados: Achado[] = []

  for (const { nome, malha } of o.corpos) {
    const { pos, idx } = normaliza(malha)
    if (idx.length === 0) {
      achados.push({ severidade: 'erro', codigo: 'malha-vazia', mensagem: MSG.malhaVazia(nome), corpo: nome })
      continue
    }
    if (!fechada(malha)) {
      achados.push({ severidade: 'bloqueio', codigo: 'malha-aberta', mensagem: MSG.malhaAberta(nome), corpo: nome })
    }
    if (volume(malha) < 0) {
      achados.push({ severidade: 'aviso', codigo: 'volume-invertido', mensagem: MSG.volumeInvertido(nome), corpo: nome })
    }

    const bb = bbox(malha)
    const tam = [0, 1, 2].map(i => bb.max[i] - bb.min[i])
    if (tam.some((d, i) => d > volMesa[i] + TOL)) {
      achados.push({ severidade: 'erro', codigo: 'fora-do-volume', mensagem: MSG.foraDoVolume(nome, tam, volMesa), corpo: nome })
    }

    // Overhang e base de apoio numa passada só sobre os triângulos.
    const zBase = bb.min[2]
    let areaOverhang = 0
    let areaBase = 0
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3
      const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2]
      const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2]
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nzRaw = ux * vy - uy * vx
      const len = Math.hypot(nx, ny, nzRaw)
      if (len === 0) continue
      const area = len / 2
      const nz = nzRaw / len

      const apoio = pos[a + 2] <= zBase + SUPORTE && pos[b + 2] <= zBase + SUPORTE && pos[c + 2] <= zBase + SUPORTE
      // inclinação em relação à vertical: asin(-nz), 0° vertical, 90° horizontal virada para baixo
      if (!apoio && nz < 0 && Math.asin(-nz) * 180 / Math.PI > limiar) areaOverhang += area

      const naMesa = Math.abs(pos[a + 2]) <= MESA && Math.abs(pos[b + 2]) <= MESA && Math.abs(pos[c + 2]) <= MESA
      if (nz < -0.999 && naMesa) areaBase += area
    }
    if (areaOverhang > 1) {
      achados.push({ severidade: 'aviso', codigo: 'overhang', mensagem: MSG.overhang(nome, areaOverhang, limiar), corpo: nome })
    }

    // ponytail: usa a bbox; arestas/paredes finas por raio ficam para depois (PROJETO_BASE §6.10, F3+)
    const menor = Math.min(...tam)
    if (menor < o.impressora.regras.detalheMin) {
      achados.push({ severidade: 'aviso', codigo: 'detalhe-minimo', mensagem: MSG.detalheMinimo(nome, menor, o.impressora.regras.detalheMin), corpo: nome })
    }

    if (areaBase < baseMin) {
      achados.push({ severidade: 'aviso', codigo: 'base-menor', mensagem: MSG.baseMenor(nome, areaBase, baseMin), corpo: nome })
    }
  }
  return achados
}
