// Árvore de features (painel esquerdo): lógica pura, sem DOM. Testada em test/features-arvore.test.ts.
import type { Feature } from '@3dm/core/doc'
import type { EstadoFeature } from '@3dm/core/regen'
import type { DadosSolido } from './contrato.ts'
import { T } from '../textos.ts'

export interface LinhaArvore {
  id: string
  tipo: string
  icone: string
  /** Id + tipo legível. */
  rotulo: string
  estado: EstadoFeature
  /** Causa e correção do erro, numa linha ('' se não há). */
  erro: string
  suprimida: boolean
  /** Depois do marcador de histórico (fora do modelo ativo). */
  revertida: boolean
  /** Corpo com esse id está escondido. */
  oculta: boolean
  selecionada: boolean
  /** Última feature ativa (onde fica a barra do marcador). */
  ehMarcador: boolean
}

export function linhasArvore(features: Feature[], marcador: string | null, dados: Pick<DadosSolido, 'status' | 'selecionada' | 'ocultos'>): LinhaArvore[] {
  const achado = marcador === null ? -1 : features.findIndex(f => f.id === marcador)
  const ultimaAtiva = achado < 0 ? features.length - 1 : achado // marcador null ou desconhecido = todas ativas
  return features.map((f, i) => {
    const st = dados.status.get(f.id)
    const estado: EstadoFeature = st?.estado ?? 'ok'
    return {
      id: f.id,
      tipo: f.tipo,
      icone: T.arvore.icones[f.tipo] ?? T.arvore.icones.outro,
      rotulo: `${f.id} (${T.arvore.tipos[f.tipo] ?? T.arvore.tipos.outro})`,
      estado,
      erro: st?.erro ? [st.erro.causa, st.erro.correcao].filter(Boolean).join(' ') : '',
      suprimida: estado === 'suprimida',
      revertida: i > ultimaAtiva,
      oculta: dados.ocultos.has(f.id),
      selecionada: dados.selecionada === f.id,
      ehMarcador: i === ultimaAtiva,
    }
  })
}

/** Move o marcador um passo. id null = todas ativas (depois da última). Recuar do primeiro fica no primeiro; avançar além do último devolve null. */
export function proximoMarcador(features: Feature[], id: string | null, delta: -1 | 1): string | null {
  const n = features.length
  if (n === 0) return null
  const i = id === null ? -1 : features.findIndex(f => f.id === id)
  const k = i < 0 ? n : i + 1 // quantas features estão ativas
  const alvo = k + delta
  if (alvo > n) return null
  return features[Math.max(1, alvo) - 1].id
}
