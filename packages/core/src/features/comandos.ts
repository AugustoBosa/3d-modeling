// Comandos de undo/redo sobre features, parâmetros e aparência do documento (PROJETO_BASE §6.15).
// Mutam o documento; desfazer restaura o JSON exato de antes.
import type { Comando, Documento, Feature, Parametro } from '../doc/index.ts'
import { NOME_PARAMETRO } from '../doc/index.ts'
import { achaCiclo } from '../expr/index.ts'

const indiceDe = (d: Documento, id: string): number => {
  const i = d.features.findIndex((f) => f.id === id)
  if (i < 0) throw new Error(`Feature "${id}" não existe no documento.`)
  return i
}

const limpaParam = (p: Parametro): Parametro => {
  const r: Parametro = { expr: p.expr }
  if (p.comentario !== undefined) r.comentario = p.comentario
  if (p.unidade !== undefined) r.unidade = p.unidade
  return r
}

/** Insere `f`. Sem `indice`: logo depois da feature do marcador (que passa a ser a nova); se não há marcador, no fim. */
export function adicionaFeature(f: Feature, indice?: number): Comando<Documento> {
  let pos = 0
  let marcadorAntes: string | null = null
  return {
    nome: `ADICIONAR ${f.id}`,
    fazer(d) {
      if (d.features.some((x) => x.id === f.id)) throw new Error(`Já existe uma feature com o id "${f.id}".`)
      if (indice !== undefined && (indice < 0 || indice > d.features.length)) throw new Error(`Posição ${indice} fora da lista.`)
      marcadorAntes = d.marcadorHistorico
      if (indice !== undefined) pos = indice
      else if (d.marcadorHistorico !== null) { pos = indiceDe(d, d.marcadorHistorico) + 1; d.marcadorHistorico = f.id }
      else pos = d.features.length
      d.features.splice(pos, 0, structuredClone(f))
    },
    desfazer(d) {
      d.features.splice(pos, 1)
      d.marcadorHistorico = marcadorAntes
    },
  }
}

/** Mescla `patch` na feature (shallow). Valor `undefined` remove o campo. Desfazer restaura a feature inteira. */
export function editaFeature(id: string, patch: Record<string, unknown>): Comando<Documento> {
  let i = -1
  let antes: Feature | undefined
  return {
    nome: `EDITAR ${id}`,
    fazer(d) {
      i = indiceDe(d, id)
      antes = structuredClone(d.features[i])
      const nova: Feature = { ...d.features[i] }
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) delete nova[k]
        else nova[k] = v
      }
      d.features[i] = nova
    },
    desfazer(d) { if (antes) d.features[i] = structuredClone(antes) },
  }
}

/** Remove a feature e a sua aparência. Se era o marcador, o marcador vai para a anterior (ou null). */
export function removeFeature(id: string): Comando<Documento> {
  let i = -1
  let feat: Feature | undefined
  let marcadorAntes: string | null = null
  let aparenciaAntes: Documento['aparencia'] = {}
  return {
    nome: `REMOVER ${id}`,
    fazer(d) {
      i = indiceDe(d, id)
      feat = structuredClone(d.features[i])
      marcadorAntes = d.marcadorHistorico
      aparenciaAntes = structuredClone(d.aparencia)
      if (d.marcadorHistorico === id) d.marcadorHistorico = i > 0 ? d.features[i - 1].id : null
      d.features.splice(i, 1)
      delete d.aparencia[id]
    },
    desfazer(d) {
      if (feat) d.features.splice(i, 0, structuredClone(feat))
      d.marcadorHistorico = marcadorAntes
      d.aparencia = structuredClone(aparenciaAntes)
    },
  }
}

/** Liga/desliga a supressão (campo `suprimida`). */
export function suprimeFeature(id: string, suprimida: boolean): Comando<Documento> {
  return editaFeature(id, { suprimida })
}

/** Põe o marcador de histórico numa feature (ou em null, mostrando tudo). Lança se o id não existe. */
export function moveMarcador(id: string | null): Comando<Documento> {
  let antes: string | null = null
  return {
    nome: `MARCADOR ${id ?? 'nenhum'}`,
    fazer(d) {
      if (id !== null) indiceDe(d, id)
      antes = d.marcadorHistorico
      d.marcadorHistorico = id
    },
    desfazer(d) { d.marcadorHistorico = antes },
  }
}

/** Reordena: tira a feature de sua posição e a põe em `novoIndice`. */
export function moveFeature(id: string, novoIndice: number): Comando<Documento> {
  let de = -1
  let para = -1
  return {
    nome: `MOVER ${id}`,
    fazer(d) {
      de = indiceDe(d, id)
      if (!Number.isInteger(novoIndice) || novoIndice < 0 || novoIndice >= d.features.length) {
        throw new Error(`Posição ${novoIndice} fora da lista (0 a ${d.features.length - 1}).`)
      }
      para = novoIndice
      const [f] = d.features.splice(de, 1)
      d.features.splice(para, 0, f)
    },
    desfazer(d) {
      const [f] = d.features.splice(para, 1)
      d.features.splice(de, 0, f)
    },
  }
}

/** Cor do corpo da feature (`aparencia[id] = {cor}`). */
export function definirCorCorpo(id: string, cor: string): Comando<Documento> {
  let antes: Documento['aparencia'] = {}
  return {
    nome: `COR ${id}`,
    fazer(d) { antes = structuredClone(d.aparencia); d.aparencia[id] = { ...d.aparencia[id], cor } },
    desfazer(d) { d.aparencia = structuredClone(antes) },
  }
}

/** Cria ou altera um parâmetro com comentário e unidade. Recusa nome inválido e ciclo (antes de mutar). */
export function definirParametroCompleto(nome: string, p: Parametro): Comando<Documento> {
  if (!NOME_PARAMETRO.test(nome)) throw new Error(`nome de parâmetro inválido: "${nome}"`)
  let tinha = false
  let antes: Parametro | undefined
  return {
    nome: `PARAM ${nome}`,
    fazer(d) {
      const ciclo = achaCiclo({ ...d.parametros, [nome]: limpaParam(p) })
      if (ciclo) throw new Error(`Ciclo entre parâmetros: ${[...ciclo, ciclo[0]].join(' → ')}. Quebre a dependência.`)
      tinha = Object.hasOwn(d.parametros, nome)
      antes = tinha ? structuredClone(d.parametros[nome]) : undefined
      d.parametros[nome] = limpaParam(p)
    },
    desfazer(d) {
      if (tinha && antes) d.parametros[nome] = structuredClone(antes)
      else delete d.parametros[nome]
    },
  }
}

export function removeParametro(nome: string): Comando<Documento> {
  let antes: Documento['parametros'] = {}
  return {
    nome: `REMOVER PARAM ${nome}`,
    fazer(d) {
      if (!Object.hasOwn(d.parametros, nome)) throw new Error(`Parâmetro "${nome}" não existe.`)
      antes = structuredClone(d.parametros)
      delete d.parametros[nome]
    },
    desfazer(d) { d.parametros = structuredClone(antes) },
  }
}

const reescreveNomes = (texto: string, de: string, para: string): string =>
  texto.replace(new RegExp(`\\b${de}\\b`, 'g'), para)

/** Cópia da feature com os textos (campos string exceto id/tipo, e restricoes[].expr) passados por `fn`. */
function mapeiaTextos(f: Feature, fn: (t: string) => string): Feature {
  const r: Feature = { ...f }
  for (const k of Object.keys(f)) {
    if (k === 'id' || k === 'tipo') continue
    const v = f[k]
    if (typeof v === 'string') r[k] = fn(v)
  }
  if (Array.isArray(f.restricoes)) {
    r.restricoes = f.restricoes.map((x: Record<string, unknown>) => {
      const c = { ...x }
      if (typeof c.expr === 'string') c.expr = fn(c.expr)
      return c
    })
  }
  return r
}

/** Renomeia a chave do parâmetro e reescreve as expressões que o citam (parâmetros, cotas e campos das features). */
export function renomeiaParametro(de: string, para: string): Comando<Documento> {
  if (!NOME_PARAMETRO.test(de)) throw new Error(`nome de parâmetro inválido: "${de}"`)
  if (!NOME_PARAMETRO.test(para)) throw new Error(`nome de parâmetro inválido: "${para}"`)
  let antesParams: Documento['parametros'] = {}
  let antesFeats: Feature[] = []
  const fn = (t: string): string => reescreveNomes(t, de, para)
  return {
    nome: `RENOMEAR ${de} -> ${para}`,
    fazer(d) {
      if (!Object.hasOwn(d.parametros, de)) throw new Error(`Parâmetro "${de}" não existe.`)
      if (de !== para && Object.hasOwn(d.parametros, para)) throw new Error(`Já existe um parâmetro "${para}".`)
      antesParams = structuredClone(d.parametros)
      antesFeats = structuredClone(d.features)
      d.parametros = Object.fromEntries(
        Object.entries(d.parametros).map(([k, p]) => [k === de ? para : k, { ...p, expr: fn(p.expr) }]),
      )
      d.features = d.features.map((f) => mapeiaTextos(f, fn))
    },
    desfazer(d) {
      d.parametros = structuredClone(antesParams)
      d.features = structuredClone(antesFeats)
    },
  }
}

/** Primeiro id `prefixo1`, `prefixo2`… que não existe entre as features. */
export function idLivre(doc: Documento, prefixo: string): string {
  let n = 1
  while (doc.features.some((f) => f.id === `${prefixo}${n}`)) n++
  return `${prefixo}${n}`
}
