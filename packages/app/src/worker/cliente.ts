// Cliente do worker de geometria. Só um pedido em voo; enquanto ele roda, o mais recente espera (os anteriores resolvem null).
import type { Documento } from '@3dm/core/doc'
import type { Pedido, Resposta } from './processa.ts'
import { T } from '../textos.ts'

/** Espera para só enviar o último de uma rajada de pedidos. */
export const DEBOUNCE_MS = 60
const MSG_FALHA = T.worker.falha

type Ok = (r: Resposta | null) => void
interface Pend { doc: Documento; tol?: number; ok: Ok }

export function criaGeometria() {
  let w: Worker | undefined
  let pronto!: Promise<void>
  let marcaPronto!: () => void
  let emVoo: { id: number; ok: Ok } | undefined
  let aguardando: Pend | undefined // dentro do debounce
  let fila: Pend | undefined // esperando o pedido em voo terminar
  let timer: ReturnType<typeof setTimeout> | undefined
  let n = 0
  let fim = false
  let geracao = 0 // muda a cada reinicia: pedido que esperava o worker velho resolve null

  const libera = (p?: { ok: Ok }) => p?.ok(null)

  function limpa() {
    clearTimeout(timer)
    timer = undefined
    libera(aguardando); aguardando = undefined
    libera(fila); fila = undefined
    libera(emVoo); emVoo = undefined
  }

  function envia(p: Pend) {
    const id = ++n
    emVoo = { id, ok: p.ok }
    w?.postMessage({ id, tipo: 'regen', doc: p.doc, tol: p.tol } satisfies Pedido)
  }

  function despacha(p: Pend) {
    if (!emVoo) return envia(p)
    libera(fila)
    fila = p
  }

  function chegou(r: Resposta) {
    const e = emVoo
    if (!e || r.id !== e.id) return
    emVoo = undefined
    e.ok(r)
    if (fila) {
      const p = fila
      fila = undefined
      envia(p)
    }
  }

  function inicia() {
    try {
      w = new Worker(new URL('./gera.worker.ts', import.meta.url), { type: 'module' })
    } catch {
      w = undefined
      pronto = Promise.reject(new Error(MSG_FALHA))
      pronto.catch(() => {})
      return
    }
    const ww = w
    pronto = new Promise<void>((ok, no) => {
      marcaPronto = ok
      ww.onerror = () => {
        no(new Error(MSG_FALHA))
        limpa()
      }
      ww.onmessage = ({ data }: MessageEvent<Resposta | 'pronto'>) => {
        if (data === 'pronto') return marcaPronto()
        chegou(data)
      }
    })
    pronto.catch(() => {}) // quem chama pede() recebe o erro; sem isso o navegador acusaria rejeição sem tratamento
  }

  inicia()

  return {
    /** Pede a regeneração do documento (copiado agora, pois os comandos o mutam in place). Resolve null se foi substituído. */
    pede(doc: Documento, tol?: number): Promise<Resposta | null> {
      const copia = structuredClone(doc)
      const g = geracao
      return pronto.then(() => new Promise<Resposta | null>((ok) => {
        if (fim || g !== geracao) return ok(null)
        libera(aguardando)
        clearTimeout(timer)
        aguardando = { doc: copia, tol, ok }
        timer = setTimeout(() => {
          const p = aguardando
          aguardando = undefined
          timer = undefined
          if (p) despacha(p)
        }, DEBOUNCE_MS)
      }))
    },
    /** Termina e recria o worker (travou ou falhou). Pedidos pendentes resolvem null. */
    reinicia() {
      limpa()
      geracao++
      marcaPronto?.() // um worker morto antes do "pronto" nunca avisaria: sem isto, quem o esperava trava para sempre
      w?.terminate()
      inicia()
    },
    dispose() {
      fim = true
      limpa()
      marcaPronto?.()
      w?.terminate()
      w = undefined
    },
  }
}
