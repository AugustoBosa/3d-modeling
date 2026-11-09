// Servidor HTTP+WebSocket local do MCP: serve o build do app e recebe o app por WS com token.
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { Duplex } from 'node:stream'
import path from 'node:path'
import { WebSocketServer, type WebSocket } from 'ws'
import {
  PORTA_PADRAO,
  VERSAO_PROTOCOLO,
  lerMensagemDoApp,
  textoMensagem,
  type EventoEstado,
} from './protocolo.ts'

export interface Ponte {
  token: string
  porta: number
  url: string
  readonly conectado: boolean
  readonly estado: EventoEstado | null
  aoEstado(f: (e: EventoEstado) => void): void
  pede(acao: string, args: Record<string, unknown>, ms?: number): Promise<unknown>
  fechar(): Promise<void>
}

const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

const AVISO_SEM_BUILD =
  '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>3D Modeling</title>' +
  '<p>O app ainda não foi compilado. Rode <code>npm run build</code> na raiz do projeto e recarregue.</p></html>'

const ORIGENS_OK = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/([a-z0-9-]+\.)+github\.io$/i,
]

// ponytail: comparar digests SHA-256 evita vazar o tamanho do token no timingSafeEqual.
const digest = (s: string) => createHash('sha256').update(s).digest()

function tokenDoPedido(req: IncomingMessage): string {
  const proto = (req.headers['sec-websocket-protocol'] ?? '')
    .split(',')
    .map((p) => p.trim())
    .find((p) => p.startsWith('token.'))
  if (proto) return proto.slice('token.'.length)
  return new URL(req.url ?? '/', 'http://127.0.0.1').searchParams.get('token') ?? ''
}

function recusa(socket: Duplex, codigo: number, texto: string) {
  socket.write(`HTTP/1.1 ${codigo} ${texto}\r\n\r\n`)
  socket.destroy()
}

async function servirArquivo(req: IncomingMessage, res: ServerResponse, raiz: string) {
  if (req.method !== 'GET') {
    res.writeHead(405, { Allow: 'GET' }).end()
    return
  }
  let pedido: string
  try {
    pedido = decodeURIComponent(new URL(req.url ?? '/', 'http://127.0.0.1').pathname)
  } catch {
    res.writeHead(400).end()
    return
  }
  const alvo = path.resolve(raiz, pedido === '/' ? 'index.html' : '.' + pedido)
  if (alvo !== raiz && !alvo.startsWith(raiz + path.sep)) {
    res.writeHead(403).end()
    return
  }
  try {
    const corpo = await readFile(alvo)
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(alvo)] ?? 'application/octet-stream' }).end(corpo)
  } catch {
    if (pedido === '/') res.writeHead(200, { 'Content-Type': TIPOS['.html'] }).end(AVISO_SEM_BUILD)
    else res.writeHead(404).end()
  }
}

export function iniciarPonte(
  o: { porta?: number; token?: string; pastaApp?: string; origens?: string[] } = {},
): Promise<Ponte> {
  const porta = o.porta ?? (process.env.MODELING_MCP_PORT ? Number(process.env.MODELING_MCP_PORT) : PORTA_PADRAO)
  const token = o.token ?? randomUUID() + randomUUID()
  const raiz = path.resolve(o.pastaApp ?? path.resolve(import.meta.dirname, '../../app/dist'))
  const origensExtras = o.origens ?? (process.env.MODELING_MCP_ORIGINS || '').split(',').filter(Boolean)
  const esperado = digest(token)

  const origemPermitida = (origem: string) =>
    ORIGENS_OK.some((r) => r.test(origem)) || origensExtras.includes(origem)

  const ouvintes: Array<(e: EventoEstado) => void> = []
  const pendentes = new Map<
    string,
    { resolver: (v: unknown) => void; rejeitar: (e: Error) => void; timer: NodeJS.Timeout }
  >()
  let app: WebSocket | null = null
  let estado: EventoEstado | null = null

  const server = createServer((req, res) => {
    servirArquivo(req, res, raiz).catch(() => res.writeHead(500).end())
  })

  const wss = new WebSocketServer({
    noServer: true,
    handleProtocols: (protocolos) => [...protocolos].find((p) => p.startsWith('token.')) ?? false,
  })

  wss.on('connection', (ws: WebSocket) => {
    ws.on('message', (dados) => {
      const m = lerMensagemDoApp(String(dados))
      if (!m) return
      if (m.tipo === 'ola') {
        app = ws
        ws.send(textoMensagem({ tipo: 'ola-ok', versao: VERSAO_PROTOCOLO }))
      } else if (m.tipo === 'estado') {
        estado = m
        for (const f of ouvintes) f(m)
      } else if (m.tipo === 'resposta') {
        const p = pendentes.get(m.id)
        if (!p) return
        pendentes.delete(m.id)
        clearTimeout(p.timer)
        if (m.ok) p.resolver(m.resultado)
        else p.rejeitar(new Error(m.erro))
      }
    })
    ws.on('close', () => {
      if (app !== ws) return
      app = null
      for (const [id, p] of pendentes) {
        clearTimeout(p.timer)
        pendentes.delete(id)
        p.rejeitar(new Error('app desconectado'))
      }
    })
  })

  server.on('upgrade', (req: IncomingMessage, socket: Duplex, cabeca: Buffer) => {
    socket.on('error', () => {})
    const origem = req.headers.origin
    if (origem && !origemPermitida(origem)) return recusa(socket, 403, 'Forbidden')
    if (!timingSafeEqual(digest(tokenDoPedido(req)), esperado)) return recusa(socket, 401, 'Unauthorized')
    wss.handleUpgrade(req, socket, cabeca, (ws) => wss.emit('connection', ws, req))
  })

  return new Promise((resolver, rejeitar) => {
    server.once('error', rejeitar)
    server.listen(porta, '127.0.0.1', () => {
      server.off('error', rejeitar)
      const real = (server.address() as { port: number }).port
      resolver({
        token,
        porta: real,
        url: `http://127.0.0.1:${real}/`,
        get conectado() {
          return app !== null
        },
        get estado() {
          return estado
        },
        aoEstado(f) {
          ouvintes.push(f)
        },
        pede(acao, args, ms = 10000) {
          const alvo = app
          if (!alvo) return Promise.reject(new Error('nenhum app conectado'))
          const id = randomUUID()
          return new Promise((resolver, rejeitar) => {
            const timer = setTimeout(() => {
              pendentes.delete(id)
              rejeitar(new Error(`tempo esgotado em ${acao}`))
            }, ms)
            pendentes.set(id, { resolver, rejeitar, timer })
            alvo.send(textoMensagem({ tipo: 'pedido', id, acao, args }))
          })
        },
        async fechar() {
          for (const c of wss.clients) c.terminate()
          for (const [id, p] of pendentes) {
            clearTimeout(p.timer)
            pendentes.delete(id)
            p.rejeitar(new Error('ponte fechada'))
          }
          await new Promise<void>((ok) => wss.close(() => ok()))
          const fim = new Promise<void>((ok) => server.close(() => ok()))
          server.closeAllConnections()
          await fim
        },
      })
    })
  })
}
