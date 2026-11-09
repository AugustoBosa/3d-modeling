// Monta os arquivos de export (STL por corpo, STL unico, 3MF) de um documento e dos corpos regenerados.
// Funcao pura: nao grava nada; quem grava os bytes e o chamador.
import type { Documento } from '../doc/tipos.ts'
import { normaliza, type EntradaMalha } from '../malha/tipos.ts'
import { stl } from '../malha/malha.ts'
import { verificar } from '../imprimir/verificar.ts'
import { avisosFilamento, massaGramas } from '../imprimir/filamento.ts'
import type { Achado } from '../imprimir/tipos.ts'
import { impressoraPorId } from '../../printers/index.ts'
import { filamentoPorId } from '../../filaments/index.ts'
import { escrever3mf, type Config3mf, type Corpo3mf } from './3mf.ts'
import { config3mfDe, saborDe } from './perfis3mf.ts'
import { nomeArquivo } from './nome.ts'

export type FormatoExport = 'stl' | 'stl-tudo' | '3mf' // stl: um arquivo por corpo
export interface EntradaExport { doc: Documento; corpos: ReadonlyMap<string, EntradaMalha>; ocultos?: ReadonlySet<string>; miniaturaPng?: Uint8Array }
export interface ArquivoExport { nome: string; bytes: Uint8Array }
export interface ResultadoExport { arquivos: ArquivoExport[]; achados: Achado[]; bloqueado: boolean; massaG: number }
export const PALETA = ['#b8b4ac', '#6a8fb0', '#b08f6a', '#8fb06a', '#a06ab0', '#b06a7e']

// Concatena as malhas num so STL: os indices de cada uma sao deslocados pelos vertices anteriores.
function juntaStl(malhas: EntradaMalha[]): EntradaMalha {
  const partes = malhas.map((m) => normaliza(m))
  const nv = partes.reduce((s, p) => s + p.pos.length / 3, 0)
  const nt = partes.reduce((s, p) => s + p.idx.length, 0)
  const pos = new Float32Array(nv * 3)
  const idx = new Uint32Array(nt)
  let v = 0, t = 0
  for (const p of partes) {
    pos.set(p.pos, v * 3)
    for (const i of p.idx) idx[t++] = i + v
    v += p.pos.length / 3
  }
  return { posicoes: pos, indices: idx }
}

export function exporta(e: EntradaExport, formato: FormatoExport, opcoes?: { ignoraBloqueio?: boolean }): ResultadoExport {
  const { doc } = e
  const imp = impressoraPorId(doc.impressora)
  if (!imp) throw new Error(`impressora desconhecida: ${doc.impressora}`)
  const idFil = doc.filamento ?? imp.filamentoPadrao
  const fil = filamentoPorId(idFil)
  if (!fil) throw new Error(`filamento desconhecido: ${idFil}`)

  const visiveis = [...e.corpos.keys()]
    .filter((id) => !e.ocultos?.has(id))
    .map((id) => ({ id, malha: e.corpos.get(id)!, slot: doc.aparencia[id]?.slot ?? 1 }))
  if (visiveis.length === 0) throw new Error('nenhum corpo a exportar')

  const achados: Achado[] = [
    ...verificar({ impressora: imp, filamento: fil, corpos: visiveis.map((c) => ({ nome: c.id, malha: c.malha })) }),
    ...avisosFilamento({ impressora: imp, filamento: fil, corpos: visiveis.map((c) => ({ nome: c.id, slot: c.slot })) }),
  ]
  const bloqueado = achados.some((a) => a.severidade === 'bloqueio')
  const massaG = visiveis.reduce((s, c) => s + massaGramas(c.malha, fil), 0)
  if (bloqueado && !opcoes?.ignoraBloqueio) return { arquivos: [], achados, bloqueado, massaG }

  const nomeDe = (parte: string, ext: string) => nomeArquivo(doc.nome || 'projeto', parte, imp.id, ext)
  if (formato === 'stl') {
    return { arquivos: visiveis.map((c) => ({ nome: nomeDe(c.id, 'stl'), bytes: stl(c.malha) })), achados, bloqueado, massaG }
  }
  if (formato === 'stl-tudo') {
    const bytes = stl(juntaStl(visiveis.map((c) => c.malha)))
    return { arquivos: [{ nome: nomeDe('todos', 'stl'), bytes }], achados, bloqueado, massaG }
  }

  const corpos: Corpo3mf[] = visiveis.map((c, i) => ({
    nome: c.id,
    malha: c.malha,
    cor: doc.slots?.[c.slot]?.cor ?? doc.aparencia[c.id]?.cor ?? PALETA[i % PALETA.length]!,
    slot: c.slot,
  }))
  const config: Config3mf = config3mfDe(imp, fil)
  if (doc.slots) {
    const slots = doc.slots
    const n = Math.max(...corpos.map((c) => c.slot), ...Object.keys(slots).map(Number))
    // Tipo de filamento de cada slot: o mesmo mapeamento do config3mfDe aplicado ao filamento do slot.
    config.filament_type = Array.from({ length: n }, (_, i) => {
      const id = slots[i + 1]?.filamento
      const f = id === undefined ? undefined : filamentoPorId(id)
      if (id !== undefined && !f) throw new Error(`slot ${i + 1}: filamento desconhecido: ${id}`)
      return config3mfDe(imp, f).filament_type?.[0] ?? 'PLA'
    })
    config.filament_colour = Array.from({ length: n }, (_, i) =>
      slots[i + 1]?.cor ?? corpos.find((c) => c.slot === i + 1)?.cor ?? '#FFFFFF')
  }
  const bytes = escrever3mf({ corpos, sabor: saborDe(imp), config, miniaturaPng: e.miniaturaPng })
  return { arquivos: [{ nome: nomeDe('todos', '3mf'), bytes }], achados, bloqueado, massaG }
}
