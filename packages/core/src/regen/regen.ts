// Regeneração do histórico com cache por feature. A chave de cada entrada encadeia a anterior: mudar a feature i
// invalida i e todas as seguintes. Os Manifold dos deltas pertencem ao cache (deletados ao descartar a entrada).
import type { Manifold } from 'manifold-3d'
import { criaLixo, malhaDe, TOL_PREVIA } from '../kernel/index.ts'
import { ErroFeature, executa } from '../features/index.ts'
import type { Ctx, Delta } from '../features/index.ts'
import type { Malha } from '../malha/tipos.ts'
import type { EntradaRegen, ItemRegen, ResultadoRegen, StatusFeature } from './tipos.ts'

interface Erro { causa: string; correcao: string }
interface Entrada { chave: string; delta?: Delta; erro?: Erro }

/** Hash de 53 bits (cyrb53): chave curta para não crescer a cada elo do encadeamento. */
function cyrb53(s: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

function mensagem(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function chaveDe(item: ItemRegen, chaveAnt: string, e: EntradaRegen, tol: number): string {
  let perfis = ''
  if (item.tipo === 'extrude' || item.tipo === 'revolve') {
    perfis = JSON.stringify([e.resolvedor(item.sketch), e.planoDe(item.sketch)])
  }
  return cyrb53(`${chaveAnt}|${JSON.stringify(item)}|${perfis}|${tol}`)
}

function liberaEntrada(ent: Entrada | undefined): void {
  if (!ent?.delta) return
  for (const m of Object.values(ent.delta)) m?.delete()
}

function aplica(estado: Map<string, Manifold>, delta: Delta): void {
  for (const [id, m] of Object.entries(delta)) {
    if (m === null) estado.delete(id)
    else estado.set(id, m)
  }
}

export class Regenerador {
  private cache: Entrada[] = []
  private malhas = new WeakMap<Manifold, Malha>()

  regenera(e: EntradaRegen): ResultadoRegen {
    const t0 = performance.now()
    const tol = e.tol ?? TOL_PREVIA
    const estado = new Map<string, Manifold>()
    const lixo = criaLixo()
    const ctx: Ctx = { corpos: estado, perfis: (sid) => e.resolvedor(sid), lixo, tol }
    const status = new Map<string, StatusFeature>()
    const recalculadas: string[] = []
    // Marcador de rollback: as features depois dele ficam 'revertida'. Id inexistente = sem rollback.
    const corte = e.marcador === null ? -1 : e.features.findIndex((f) => f.id === e.marcador)
    let chaveAnt = ''
    let erroAnt = false

    for (let i = 0; i < e.features.length; i++) {
      const item = e.features[i]

      if (item.suprimida) {
        const chave = cyrb53(`${chaveAnt}|sup|${JSON.stringify(item)}`)
        const ent = this.pega(i, chave) ?? this.guarda(i, { chave })
        status.set(item.id, { estado: 'suprimida' })
        chaveAnt = ent.chave
        continue
      }
      if (corte >= 0 && i > corte) {
        this.descarte(i)
        status.set(item.id, { estado: 'revertida' })
        continue
      }
      if (erroAnt) {
        this.descarte(i)
        status.set(item.id, { estado: 'suspensa' })
        continue
      }

      let chave: string
      let falha: Erro | undefined
      try {
        chave = chaveDe(item, chaveAnt, e, tol)
      } catch (err) {
        falha = { causa: mensagem(err), correcao: 'Corrija o sketch.' }
        chave = cyrb53(`${chaveAnt}|falha|${JSON.stringify(item)}|${falha.causa}`)
      }

      const hit = this.pega(i, chave)
      const ent = hit ?? this.guarda(i, falha ? { chave, erro: falha } : this.calcula(item, chave, ctx, e))
      if (!hit) recalculadas.push(item.id)

      if (ent.erro) {
        status.set(item.id, { estado: 'erro', erro: ent.erro })
        erroAnt = true
      } else {
        status.set(item.id, { estado: 'ok' })
        if (ent.delta) aplica(estado, ent.delta)
      }
      chaveAnt = ent.chave
    }
    this.descarte(e.features.length)

    const corpos = new Map<string, Malha>()
    for (const [id, m] of estado) {
      let malha = this.malhas.get(m)
      if (!malha) {
        malha = malhaDe(m)
        this.malhas.set(m, malha)
      }
      corpos.set(id, malha)
    }
    return { corpos, status, recalculadas, ms: performance.now() - t0 }
  }

  dispose(): void {
    this.descarte(0)
    this.malhas = new WeakMap()
  }

  /** Entrada em cache na posição i se a chave bate; senão descarta i em diante e devolve undefined. */
  private pega(i: number, chave: string): Entrada | undefined {
    const ent = this.cache[i]
    if (ent && ent.chave === chave) return ent
    this.descarte(i)
    return undefined
  }

  private guarda(i: number, ent: Entrada): Entrada {
    this.cache[i] = ent
    return ent
  }

  /** Libera (delete) os deltas das entradas desde `desde` e encurta o cache. */
  private descarte(desde: number): void {
    for (let k = desde; k < this.cache.length; k++) liberaEntrada(this.cache[k])
    this.cache.length = Math.min(this.cache.length, desde)
  }

  private calcula(item: ItemRegen, chave: string, ctx: Ctx, e: EntradaRegen): Entrada {
    if (item.tipo === 'sketch') return { chave, delta: {} }
    try {
      if (item.tipo === 'invalida') throw new ErroFeature(item.causa, item.correcao)
      return { chave, delta: executa(item, ctx, e.planoDe) }
    } catch (err) {
      const erro: Erro = err instanceof ErroFeature
        ? { causa: err.message, correcao: err.correcao }
        : { causa: mensagem(err), correcao: 'Revise os parâmetros desta feature.' }
      return { chave, erro }
    } finally {
      ctx.lixo.limpa()
    }
  }
}
