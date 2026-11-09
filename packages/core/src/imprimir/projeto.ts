import type { Comando, Documento, Exposto, SlotAms } from '../doc/index.ts'
import { slotValido } from '../doc/index.ts'

const COR_PADRAO = '#b8b4ac'

/** Define ou remove o filamento ativo do projeto (`null` remove, volta ao da impressora). */
export function definirFilamento(id: string | null): Comando<Documento> {
  let antes: string | undefined
  return {
    nome: `FILAMENTO ${id ?? 'nenhum'}`,
    fazer(d) { antes = d.filamento; if (id === null) delete d.filamento; else d.filamento = id },
    desfazer(d) { if (antes === undefined) delete d.filamento; else d.filamento = antes },
  }
}

/** Atribui o slot AMS/extrusora (1 a 16) a um corpo. Cria a entrada de cor padrão se faltar. */
export function definirSlotCorpo(corpoId: string, slot: number): Comando<Documento> {
  if (!slotValido(slot)) throw new Error(`slot inválido: ${slot} (use inteiro de 1 a 16)`)
  let antes: Documento['aparencia'] = {}
  return {
    nome: `SLOT ${corpoId} ${slot}`,
    fazer(d) { antes = structuredClone(d.aparencia); d.aparencia[corpoId] = { cor: d.aparencia[corpoId]?.cor ?? COR_PADRAO, slot } },
    desfazer(d) { d.aparencia = structuredClone(antes) },
  }
}

/** Grava (ou remove, com `null`) a linha `slot` da tabela de slots do projeto. */
export function definirSlotTabela(slot: number, s: SlotAms | null): Comando<Documento> {
  const chave = String(slot)
  let antes: Documento['slots']
  return {
    nome: `TABELA SLOT ${chave}`,
    fazer(d) {
      antes = structuredClone(d.slots)
      if (s === null) { if (d.slots) delete d.slots[chave] }
      else { d.slots ??= {}; d.slots[chave] = structuredClone(s) }
    },
    desfazer(d) { if (antes === undefined) delete d.slots; else d.slots = structuredClone(antes) },
  }
}

/** Expõe um parâmetro no modo customizar. Mesmo `parametro` substitui a entrada anterior. */
export function exporParametro(e: Exposto): Comando<Documento> {
  if (e.tipo === 'numero' && e.min !== undefined && e.max !== undefined && e.min > e.max) throw new Error(`exposto "${e.parametro}": min maior que max`)
  if (e.tipo === 'lista' && !e.opcoes?.length) throw new Error(`exposto "${e.parametro}": lista sem opções`)
  let antes: Exposto[] | undefined
  return {
    nome: `EXPOR ${e.parametro}`,
    fazer(d) {
      if (!Object.hasOwn(d.parametros, e.parametro)) throw new Error(`exposto "${e.parametro}": parâmetro não existe`)
      antes = structuredClone(d.expostos)
      const lista = structuredClone(d.expostos ?? [])
      const i = lista.findIndex(x => x.parametro === e.parametro)
      if (i >= 0) lista[i] = structuredClone(e); else lista.push(structuredClone(e))
      d.expostos = lista
    },
    desfazer(d) { if (antes === undefined) delete d.expostos; else d.expostos = structuredClone(antes) },
  }
}

/** Remove a exposição de um parâmetro (sem efeito se não estava exposto). */
export function removerExposto(parametro: string): Comando<Documento> {
  let antes: Exposto[] | undefined
  return {
    nome: `REMOVER EXPOSTO ${parametro}`,
    fazer(d) {
      antes = structuredClone(d.expostos)
      if (d.expostos) d.expostos = d.expostos.filter(x => x.parametro !== parametro)
    },
    desfazer(d) { if (antes === undefined) delete d.expostos; else d.expostos = structuredClone(antes) },
  }
}
