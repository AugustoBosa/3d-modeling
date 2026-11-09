// Liga o despachante puro (despachante.ts) ao app: monta o contexto, guarda o estado e executa as ações.
import type { SessaoSketch } from '../sketch/sessao.ts'
import { despacha, estadoInicial } from './despachante.ts'
import type { Acao, Estado, Tecla } from './despachante.ts'

export interface AlvosTeclado {
  sessao: SessaoSketch
  linha: { anexa(t: string): void; readonly vazia: boolean; sessao: { envia(t: string): Promise<void>; readonly pendente: string | null } }
  imediatasBlender(): boolean
  proximoCampo?(): boolean // Tab com ferramenta ativa: foca a caixa do DYN
  /** Modo Sólido: ações do despachante fora do sketch. `selecao` conta os corpos selecionados. */
  solido?: { acao(a: Acao): boolean; tecla?(t: Tecla, linhaVazia: boolean): boolean; readonly selecao: ReadonlySet<string> }
}

export function criaLigacao(a: AlvosTeclado) {
  let estado: Estado = estadoInicial()
  /** Devolve true se a tecla foi consumida (o chamador faz preventDefault). */
  function tecla(t: Tecla): boolean {
    const s = a.sessao
    const ctx = {
      noSketch: s.ativo, selecao: s.ativo ? s.selecao.size : a.solido?.selecao.size ?? 0,
      linhaVazia: a.linha.vazia && !a.linha.sessao.pendente,
      emComando: s.ferramenta !== null, imediatasBlender: a.imediatasBlender(),
    }
    if (!s.ativo && estado.fase === 'ocioso' && !ctx.emComando && a.solido?.tecla?.(t, ctx.linhaVazia)) return true
    const r = despacha(estado, t, ctx)
    estado = r.estado
    let consumiu = false
    for (const ac of r.acoes) {
      if (ac.tipo === 'passa') continue
      consumiu = true
      if (ac.tipo === 'paraLinha') a.linha.anexa(ac.texto)
      else if (ac.tipo === 'repete') void a.linha.sessao.envia('')
      else if (ac.tipo === 'proximoCampo') a.proximoCampo?.()
      else if (!s.ativo && a.solido?.acao(ac)) continue
      else if (ac.tipo === 'numero') s.numeroTransformacao(ac.texto)
      else if (ac.tipo === 'eixo') s.eixoTransformacao(ac.eixo, ac.plano)
      else s.acao(ac)
    }
    return consumiu
  }
  return { tecla, get estado() { return estado } }
}
export type Ligacao = ReturnType<typeof criaLigacao>
