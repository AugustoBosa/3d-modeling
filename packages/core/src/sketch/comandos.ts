// Comandos de undo/redo sobre o sketch do documento. Toda edição de sketch passa por aqui (PROJETO_BASE §6.15).
import type { Comando, Documento } from '../doc/index.ts'
import { ehSketch, novoId, ORIGEM, RESTR_ORIGEM } from './tipos.ts'
import type { Adicao, EntSk, Plano, RestSk, SketchFeature, TipoRestSk } from './tipos.ts'
import { normalizaExpr, resolveSketch } from './ponte.ts'
import type { InfoSketch } from './ponte.ts'
import { detectaPerfis } from './perfis.ts'
import type { ResultadoPerfis } from './perfis.ts'

type Snap = Pick<SketchFeature, 'entidades' | 'restricoes'>
const snap = (sk: SketchFeature): Snap => structuredClone({ entidades: sk.entidades, restricoes: sk.restricoes })
const restaura = (sk: SketchFeature, s: Snap): void => {
  sk.entidades = structuredClone(s.entidades)
  sk.restricoes = structuredClone(s.restricoes)
}

export function achaSketch(doc: Documento, id: string): SketchFeature | undefined {
  const f = doc.features.find((x) => x.id === id)
  return ehSketch(f) ? f : undefined
}

/** Cria uma feature sketch vazia no fim de `features`. O id só existe depois do primeiro fazer (depende do documento). */
export function criarSketch(plano: Plano): Comando<Documento> & { readonly id: string } {
  let id = ''
  return {
    nome: `SKETCH ${plano.base}`,
    get id() { return id },
    fazer(doc) {
      let n = 1
      while (doc.features.some((f) => f.id === `sk${n}`)) n++
      id = `sk${n}`
      const sk: SketchFeature = {
        id, tipo: 'sketch', plano: { ...plano },
        entidades: [{ id: ORIGEM, tipo: 'ponto', x: 0, y: 0 }],
        restricoes: [{ id: RESTR_ORIGEM, tipo: 'fixa', e: [ORIGEM], xy: [0, 0] }],
      }
      doc.features.push(sk)
    },
    desfazer(doc) {
      const i = doc.features.findIndex((f) => f.id === id)
      if (i >= 0) doc.features.splice(i, 1)
    },
  }
}

const PREFIXO_ENT: Record<EntSk['tipo'], string> = { ponto: 'p', linha: 'l', circulo: 'c', arco: 'a' }

/** Aplica uma Adicao ao sketch. Ids com '@' viram ids reais (entram em `mapa`); os demais referem entidades existentes. Devolve os ids reais das entidades. */
export function aplicaAdicao(sk: SketchFeature, a: Adicao, mapa = new Map<string, string>()): string[] {
  const ocupados: { id: string }[] = []
  const usados = () => ({ entidades: [...sk.entidades, ...ocupados], restricoes: sk.restricoes })
  const reserva = (id: string, prefixo: string): string => {
    const local = id.startsWith('@')
    const real = local ? novoId(usados(), prefixo) : id
    if (local) mapa.set(id, real)
    ocupados.push({ id: real })
    return real
  }
  const idsEnt = a.entidades.map((e) => reserva(e.id, PREFIXO_ENT[e.tipo]))
  const idsRes = a.restricoes.map((r) => reserva(r.id, 'r'))

  const real = (id: string): string => {
    if (id.startsWith('@')) {
      const r = mapa.get(id)
      if (r === undefined) throw new Error(`Referência "${id}" não existe nesta adição nem no mapa.`)
      return r
    }
    if (!sk.entidades.some((x) => x.id === id)) throw new Error(`Entidade "${id}" não existe no sketch.`)
    return id
  }

  a.entidades.forEach((e, i) => {
    const id = idsEnt[i]
    const nova: EntSk = e.tipo === 'ponto' ? { ...e, id }
      : e.tipo === 'linha' ? { ...e, id, a: real(e.a), b: real(e.b) }
      : e.tipo === 'circulo' ? { ...e, id, c: real(e.c) }
      : { ...e, id, c: real(e.c), a: real(e.a), b: real(e.b) }
    sk.entidades.push(nova)
  })
  a.restricoes.forEach((r, i) => sk.restricoes.push({ ...r, id: idsRes[i], e: r.e.map((x) => real(x)) }))
  return idsEnt
}

/** Comando genérico: `mutador` altera o sketch; depois grava as coordenadas resolvidas no mesmo comando. */
export function editaSketch(nome: string, sketchId: string, mutador: (sk: SketchFeature, doc: Documento) => void, opc: { prender?: boolean } = {}): Comando<Documento> {
  let antes: Snap | undefined, depois: Snap | undefined
  const alvo = (doc: Documento): SketchFeature => {
    const sk = achaSketch(doc, sketchId)
    if (!sk) throw new Error(`Sketch "${sketchId}" não existe no documento.`)
    return sk
  }
  return {
    nome,
    fazer(doc) {
      const sk = alvo(doc)
      if (depois) return restaura(sk, depois)
      const ant = snap(sk)
      try {
        mutador(sk, doc)
        // prender: pontos que já existiam e mudaram de lugar (mover/girar/escalar) ficam fixos na solução
        const fixos: Record<string, [number, number]> = {}
        if (opc.prender) for (const e of sk.entidades) {
          const o = ant.entidades.find((x) => x.id === e.id)
          if (e.tipo === 'ponto' && o?.tipo === 'ponto' && (o.x !== e.x || o.y !== e.y)) fixos[e.id] = [e.x, e.y]
        }
        resolveSketch(sk, doc.parametros, { fixos })
      } catch (e) {
        restaura(sk, ant)
        throw e
      }
      antes = ant
      depois = snap(sk)
    },
    desfazer(doc) {
      if (antes) restaura(alvo(doc), antes)
    },
  }
}

const achaRestricao = (sk: SketchFeature, id: string): RestSk => {
  const r = sk.restricoes.find((x) => x.id === id)
  if (!r) throw new Error(`Restrição "${id}" não existe no sketch.`)
  return r
}

export function adicionaRestricao(sketchId: string, tipo: TipoRestSk, e: string[], opc: { expr?: string; ref?: boolean; xy?: [number, number] } = {}): Comando<Documento> {
  return editaSketch(`RESTRICAO ${tipo}`, sketchId, (sk) => {
    const r: RestSk = { id: '@r', tipo, e }
    if (opc.expr !== undefined) r.expr = normalizaExpr(opc.expr)
    if (opc.ref) r.ref = true
    if (opc.xy) r.xy = opc.xy
    aplicaAdicao(sk, { entidades: [], restricoes: [r] })
  })
}

export function editaExprCota(sketchId: string, restricaoId: string, expr: string): Comando<Documento> {
  return editaSketch('COTA', sketchId, (sk) => { achaRestricao(sk, restricaoId).expr = normalizaExpr(expr) })
}

export function removeRestricao(sketchId: string, restricaoId: string): Comando<Documento> {
  return editaSketch('REMOVER RESTRICAO', sketchId, (sk) => {
    if (restricaoId === RESTR_ORIGEM) throw new Error('A origem do sketch é fixa e não pode ser liberada.')
    const r = achaRestricao(sk, restricaoId)
    sk.restricoes = sk.restricoes.filter((x) => x !== r)
  })
}

export function alternaRefCota(sketchId: string, restricaoId: string): Comando<Documento> {
  return editaSketch('ALTERNAR REFERENCIA', sketchId, (sk) => {
    const r = achaRestricao(sk, restricaoId)
    r.ref = !r.ref
  })
}

/** Cópia resolvida para desenhar (parâmetros atuais). Não altera o documento. */
export function sketchResolvido(doc: Documento, id: string): { sk: SketchFeature; info: InfoSketch; perfis: ResultadoPerfis } | undefined {
  const orig = achaSketch(doc, id)
  if (!orig) return undefined
  const sk = structuredClone(orig)
  const info = resolveSketch(sk, doc.parametros)
  return { sk, info, perfis: detectaPerfis(sk) }
}
