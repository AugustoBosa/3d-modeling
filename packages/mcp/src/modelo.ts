// Regeneração do modelo na sessão headless: o mesmo Regenerador + entradaDe que o worker do app usa.
import { entradaDe } from '@3dm/core/features'
import { Regenerador } from '@3dm/core/regen'
import type { ResultadoRegen } from '@3dm/core/regen'
import { TOL_PREVIA } from '@3dm/core/kernel'
import type { Comando, Documento } from '@3dm/core/doc'
import type { Sessao } from './sessao.ts'

const regeneradores = new WeakMap<Sessao, Regenerador>()

/** Regenera o documento atual (cache por feature, um Regenerador por sessão). */
export function regenera(s: Sessao, tol: number = TOL_PREVIA): ResultadoRegen {
  let r = regeneradores.get(s)
  if (!r) regeneradores.set(s, (r = new Regenerador()))
  return r.regenera(entradaDe(s.doc, { tol }))
}

const idsComErro = (r: ResultadoRegen): string[] => [...r.status].filter(([, st]) => st.estado === 'erro').map(([id]) => id)

/** Executa o comando; se ele cria um erro novo de regeneração, desfaz e lança Error com causa + correção. */
export function executaChecando(s: Sessao, cmd: Comando<Documento>): ResultadoRegen {
  const antes = new Set(idsComErro(regenera(s)))
  s.executa(cmd)
  const r = regenera(s)
  const novo = idsComErro(r).find((id) => !antes.has(id))
  if (novo !== undefined) {
    const e = r.status.get(novo)!.erro!
    s.desfaz()
    throw new Error(`A feature "${novo}" falhou: ${e.causa} Correção: ${e.correcao} (nada foi alterado no projeto)`)
  }
  return r
}

/** Estado das features e dos corpos, em forma serializável (resposta das tools de sólido). */
export function resumo(r: ResultadoRegen) {
  return {
    features: [...r.status].map(([id, st]) => ({ id, estado: st.estado, ...(st.erro ? { erro: st.erro } : {}) })),
    corpos: [...r.corpos.keys()],
    ms: Math.round(r.ms * 10) / 10,
  }
}

/** Comando de undo para mudanças no documento fora de features/sketch (aparência, expostos...): guarda o documento inteiro. */
export function comandoDoc(nome: string, mutador: (d: Documento) => void): Comando<Documento> {
  let antes: Documento | undefined
  let depois: Documento | undefined
  const poe = (d: Documento, de: Documento) => { for (const k of Object.keys(d)) delete (d as unknown as Record<string, unknown>)[k]; Object.assign(d, structuredClone(de)) }
  return {
    nome,
    fazer(d) {
      if (depois) return poe(d, depois)
      antes = structuredClone(d)
      try { mutador(d) } catch (e) { poe(d, antes); throw e }
      depois = structuredClone(d)
    },
    desfazer(d) { if (antes) poe(d, antes) },
  }
}
