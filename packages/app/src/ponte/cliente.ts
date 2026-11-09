// Cliente WebSocket da ponte MCP no app: conecta ao servidor local, atende pedidos e envia o estado do projeto.
import type { Documento } from '@3dm/core/doc'
import type { Projeto } from '../projeto.ts'
import { PORTA_PADRAO, VERSAO_PROTOCOLO } from '../../../mcp/src/protocolo.ts'
import type {
  ArgsAplicar,
  ArgsCaptura,
  EventoEstado,
  Ola,
  OlaOk,
  Pedido,
  Resposta,
  ResultadoCaptura,
  ResultadoDesfaz,
} from '../../../mcp/src/protocolo.ts'

export type EstadoPonte = 'desconectado' | 'conectando' | 'conectado' | 'reconectando'

export interface TextosPonte {
  desconectado: string
  conectando: string
  conectado: string
  reconectando(seg: number): string
  semPermissao(urlLocal: string): string // site https público sem permissão de rede local
}

export interface DepsPonte {
  projeto: Projeto
  capturar(vistas: string[], opc?: { mostrarVolume?: boolean }): Promise<{ vista: string; png: string }[]>
  aoEstado(e: EstadoPonte, texto: string): void
  textos: TextosPonte
  urlWs?: (token: string) => string
  esperasMs?: number[]
}

const objeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

const urlWsPadrao = (): string => {
  const { hostname, port } = location
  const local = hostname === '127.0.0.1' || hostname === 'localhost'
  return `ws://${hostname || '127.0.0.1'}:${(local && /^\d+$/.test(port)) ? port : PORTA_PADRAO}/`
}

const ESPERAS_PADRAO = [1000, 2000, 5000, 10000]

export function tokenDoHash(hash: string): string | null {
  return new URLSearchParams(hash.replace(/^#/, '')).get('token') || null
}

export function ehSiteHttpsPublico(loc: { protocol: string; hostname: string }): boolean {
  return loc.protocol === 'https:' && loc.hostname !== 'localhost' && loc.hostname !== '127.0.0.1'
}

export const urlLocal = (porta = PORTA_PADRAO): string => `http://127.0.0.1:${porta}/`

function doServidor(texto: unknown): OlaOk | Pedido | null {
  if (typeof texto !== 'string') return null
  let m: unknown
  try { m = JSON.parse(texto) } catch { return null }
  if (!objeto(m)) return null
  if (m.tipo === 'ola-ok' && typeof m.versao === 'number') return m as unknown as OlaOk
  if (m.tipo === 'pedido' && typeof m.id === 'string' && typeof m.acao === 'string' && objeto(m.args)) {
    return m as unknown as Pedido
  }
  return null
}

// Troca o conteúdo de `alvo` no lugar, para a pilha de undo (que guarda a referência) continuar válida.
function trocaNoLugar(alvo: Documento, fonte: Documento) {
  const r = alvo as unknown as Record<string, unknown>
  for (const k of Object.keys(r)) delete r[k]
  Object.assign(alvo, fonte)
}

export function criaClientePonte(d: DepsPonte): { conecta(token: string): void; desconecta(): void; readonly estado: EstadoPonte } {
  const { projeto, textos } = d
  const urlWs = d.urlWs ?? urlWsPadrao
  const esperas = d.esperasMs ?? ESPERAS_PADRAO
  let estado: EstadoPonte = 'desconectado'
  let token = ''
  let ws: WebSocket | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let quedas = 0
  let jaConectou = false
  let parado = true
  let agendado = false

  function setEstado(e: EstadoPonte, texto: string) {
    estado = e
    d.aoEstado(e, texto)
  }

  function envia(m: Ola | Resposta | EventoEstado) {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m))
  }

  function estadoAtual(): EventoEstado {
    return { tipo: 'estado', doc: projeto.doc, podeDesfazer: projeto.podeDesfazer, podeRefazer: projeto.podeRefazer }
  }

  // Rajadas de mudanças viram um único envio.
  projeto.aoMudar(() => {
    if (estado !== 'conectado' || agendado) return
    agendado = true
    queueMicrotask(() => {
      agendado = false
      if (estado === 'conectado') envia(estadoAtual())
    })
  })

  function aplica(a: ArgsAplicar) {
    let antes: Documento | undefined
    projeto.executa({
      nome: `MCP ${a.nome}`,
      fazer(x) {
        antes ??= structuredClone(x)
        trocaNoLugar(x, structuredClone(a.doc))
      },
      desfazer(x) {
        if (antes) trocaNoLugar(x, structuredClone(antes))
      },
    })
  }

  async function executa(p: Pedido): Promise<unknown> {
    switch (p.acao) {
      case 'aplicar': {
        const a = p.args as unknown as ArgsAplicar
        if (typeof a.nome !== 'string' || typeof a.doc !== 'object' || a.doc === null) {
          throw new Error('argumentos invalidos para aplicar')
        }
        aplica(a)
        return { ok: true }
      }
      case 'desfazer': {
        const r: ResultadoDesfaz = { comando: projeto.desfaz()?.nome ?? null }
        return r
      }
      case 'refazer': {
        const r: ResultadoDesfaz = { comando: projeto.refaz()?.nome ?? null }
        return r
      }
      case 'captura': {
        const a = p.args as unknown as ArgsCaptura
        const r: ResultadoCaptura = { imagens: await d.capturar(a.vistas, { mostrarVolume: a.mostrarVolume === true }) }
        return r
      }
      default:
        throw new Error(`acao desconhecida: ${p.acao}`)
    }
  }

  async function atende(p: Pedido): Promise<Resposta> {
    try {
      return { tipo: 'resposta', id: p.id, ok: true, resultado: await executa(p) }
    } catch (e) {
      return { tipo: 'resposta', id: p.id, ok: false, erro: e instanceof Error ? e.message : String(e) }
    }
  }

  function cai(sock: WebSocket) {
    if (ws !== sock) return
    ws = null
    if (parado) return
    if (!jaConectou && typeof location !== 'undefined' && ehSiteHttpsPublico(location)) {
      parado = true
      setEstado('desconectado', textos.semPermissao(urlLocal()))
      return
    }
    const ms = esperas[Math.min(quedas, esperas.length - 1)]
    quedas++
    setEstado('reconectando', textos.reconectando(Math.ceil(ms / 1000)))
    timer = setTimeout(() => {
      timer = undefined
      abre()
    }, ms)
  }

  function abre() {
    const sock = new WebSocket(urlWs(token), ['token.' + token])
    ws = sock
    sock.onopen = () => envia({ tipo: 'ola', versao: VERSAO_PROTOCOLO, app: '3d-modeling' })
    sock.onerror = () => cai(sock)
    sock.onclose = () => cai(sock)
    sock.onmessage = (ev) => {
      if (ws !== sock) return
      const m = doServidor(ev.data)
      if (!m) return
      if (m.tipo === 'ola-ok') {
        jaConectou = true
        quedas = 0
        setEstado('conectado', textos.conectado)
        envia(estadoAtual())
      } else {
        void atende(m).then(envia)
      }
    }
  }

  function paraSocket() {
    if (timer) clearTimeout(timer)
    timer = undefined
    const s = ws
    ws = null
    s?.close()
  }

  return {
    conecta(novo: string) {
      paraSocket()
      token = novo
      parado = false
      quedas = 0
      jaConectou = false
      setEstado('conectando', textos.conectando)
      abre()
    },
    desconecta() {
      paraSocket()
      parado = true
      setEstado('desconectado', textos.desconectado)
    },
    get estado() {
      return estado
    },
  }
}
