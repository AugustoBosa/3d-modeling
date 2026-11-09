// Tabela de parâmetros (valor, erro, ciclo) e uso de cada parâmetro nas features. Só leitura.
import type { Documento, Feature } from '../doc/index.ts'
import { achaCiclo, avalia, dependencias } from '../expr/index.ts'

export interface LinhaParametro {
  nome: string
  expr: string
  valor: number | null
  erro: string | null
  unidade: string
  comentario: string
  ciclo: boolean
}

export function tabelaParametros(doc: Documento): LinhaParametro[] {
  const ciclo = new Set(achaCiclo(doc.parametros) ?? [])
  return Object.entries(doc.parametros).map(([nome, p]) => {
    const r = avalia(p.expr, doc.parametros)
    return {
      nome,
      expr: p.expr,
      valor: r.ok ? r.valor : null,
      erro: r.ok ? null : r.erro,
      unidade: p.unidade ?? 'mm',
      comentario: p.comentario ?? '',
      ciclo: ciclo.has(nome),
    }
  })
}

/** Textos da feature que podem citar parâmetros: campos string (exceto id e tipo) e cotas de sketch. */
function textosDe(f: Feature): string[] {
  const textos: string[] = []
  for (const [k, v] of Object.entries(f)) if (k !== 'id' && k !== 'tipo' && typeof v === 'string') textos.push(v)
  if (Array.isArray(f.restricoes)) {
    for (const r of f.restricoes as { expr?: unknown }[]) if (typeof r.expr === 'string') textos.push(r.expr)
  }
  return textos
}

/** Ids das features (e sketches) cujos textos citam o parâmetro `nome`. */
export function usoDoParametro(doc: Documento, nome: string): string[] {
  const palavra = new RegExp(`\\b${nome}\\b`)
  return doc.features
    .filter((f) => textosDe(f).some((t) => dependencias(t).includes(nome) || palavra.test(t)))
    .map((f) => f.id)
}
