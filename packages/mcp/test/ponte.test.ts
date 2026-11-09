import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import WebSocket from 'ws'
import { iniciarPonte, type Ponte } from '../src/ponte.ts'

const TOKEN = 'token-de-teste'

async function pastaComIndex(): Promise<{ base: string; app: string }> {
  const base = await mkdtemp(path.join(tmpdir(), 'ponte-'))
  const app = path.join(base, 'app')
  await writeFile(path.join(base, 'segredo.txt'), 'SEGREDO')
  await writeFile(path.join(base, 'x'), 'SEGREDO')
  await mkdir(app)
  await writeFile(path.join(app, 'index.html'), '<!doctype html><p>ola-index</p>')
  return { base, app }
}

async function comPonte(pasta: string, fn: (p: Ponte) => Promise<void>) {
  const p = await iniciarPonte({ porta: 0, token: TOKEN, pastaApp: pasta })
  try {
    await fn(p)
  } finally {
    await p.fechar()
  }
}

function get(porta: number, caminho: string): Promise<{ status: number; corpo: string }> {
  return new Promise((ok, erro) => {
    http
      .get({ host: '127.0.0.1', port: porta, path: caminho }, (res) => {
        let corpo = ''
        res.setEncoding('utf8')
        res.on('data', (d) => (corpo += d))
        res.on('end', () => ok({ status: res.statusCode ?? 0, corpo }))
      })
      .on('error', erro)
  })
}

const abrir = (ws: WebSocket) =>
  new Promise<void>((ok, erro) => {
    ws.once('open', () => ok())
    ws.once('error', erro)
  })

const proxima = (ws: WebSocket) =>
  new Promise<Record<string, unknown>>((ok) => ws.once('message', (d) => ok(JSON.parse(String(d)))))

// Espera o upgrade ser recusado e devolve o statusCode da resposta HTTP.
function statusRecusado(ws: WebSocket) {
  return new Promise<number>((ok, erro) => {
    ws.on('error', () => {})
    ws.once('open', () => erro(new Error('conexao aberta sem deveria')))
    ws.once('unexpected-response', (_req, res) => {
      res.resume()
      ok(res.statusCode ?? 0)
    })
  })
}

test('GET / devolve o index.html', async () => {
  const { app } = await pastaComIndex()
  await comPonte(app, async (p) => {
    const r = await get(p.porta, '/')
    assert.equal(r.status, 200)
    assert.match(r.corpo, /ola-index/)
  })
})

test('pasta sem build devolve a pagina de aviso', async () => {
  const vazia = await mkdtemp(path.join(tmpdir(), 'ponte-vazia-'))
  await comPonte(vazia, async (p) => {
    const r = await get(p.porta, '/')
    assert.equal(r.status, 200)
    assert.match(r.corpo, /ainda não foi compilado/)
  })
})

test('path traversal nao vaza arquivos fora de pastaApp', async () => {
  const { app } = await pastaComIndex()
  await comPonte(app, async (p) => {
    for (const caminho of ['/../segredo.txt', '/%2e%2e/segredo.txt', '/..%2fsegredo.txt']) {
      const r = await get(p.porta, caminho)
      assert.notEqual(r.status, 200, caminho)
      assert.doesNotMatch(r.corpo, /SEGREDO/, caminho)
    }
  })
})

test('WS sem token recebe 401', async () => {
  const { app } = await pastaComIndex()
  await comPonte(app, async (p) => {
    const ws = new WebSocket(`ws://127.0.0.1:${p.porta}/`)
    try {
      assert.equal(await statusRecusado(ws), 401)
    } finally {
      ws.terminate()
    }
  })
})

test('WS com token errado recebe 401', async () => {
  const { app } = await pastaComIndex()
  await comPonte(app, async (p) => {
    const ws = new WebSocket(`ws://127.0.0.1:${p.porta}/`, ['token.errado'])
    try {
      assert.equal(await statusRecusado(ws), 401)
    } finally {
      ws.terminate()
    }
  })
})

test('Origin nao permitida recebe 403 mesmo com token certo', async () => {
  const { app } = await pastaComIndex()
  await comPonte(app, async (p) => {
    const ws = new WebSocket(`ws://127.0.0.1:${p.porta}/`, ['token.' + TOKEN], { origin: 'https://evil.example' })
    try {
      assert.equal(await statusRecusado(ws), 403)
    } finally {
      ws.terminate()
    }
  })
})

test('token via subprotocolo e via ?token= conectam; ola -> ola-ok; estado chega', async () => {
  const { app } = await pastaComIndex()
  await comPonte(app, async (p) => {
    const recebido = new Promise<unknown>((ok) => p.aoEstado(ok))
    const ws = new WebSocket(`ws://127.0.0.1:${p.porta}/`, ['token.' + TOKEN])
    try {
      await abrir(ws)
      const resposta = proxima(ws)
      ws.send(JSON.stringify({ tipo: 'ola', versao: 1, app: 'teste' }))
      assert.deepEqual(await resposta, { tipo: 'ola-ok', versao: 1 })
      assert.equal(p.conectado, true)

      ws.send(JSON.stringify({ tipo: 'estado', doc: {}, podeDesfazer: true, podeRefazer: false }))
      assert.deepEqual(await recebido, { tipo: 'estado', doc: {}, podeDesfazer: true, podeRefazer: false })
      assert.equal(p.estado?.podeDesfazer, true)
    } finally {
      ws.terminate()
    }

    const ws2 = new WebSocket(`ws://127.0.0.1:${p.porta}/?token=${TOKEN}`)
    try {
      await abrir(ws2)
    } finally {
      ws2.terminate()
    }
  })
})

test('pede envia Pedido e resolve com a Resposta do app', async () => {
  const { app } = await pastaComIndex()
  await comPonte(app, async (p) => {
    const ws = new WebSocket(`ws://127.0.0.1:${p.porta}/`, ['token.' + TOKEN])
    try {
      await abrir(ws)
      const olaOk = proxima(ws)
      ws.on('message', (d) => {
        const m = JSON.parse(String(d))
        if (m.tipo === 'ola-ok') return
        assert.equal(m.tipo, 'pedido')
        assert.equal(m.acao, 'mover')
        if (m.args.x === 2) {
          ws.send(JSON.stringify({ tipo: 'resposta', id: m.id, ok: false, erro: 'nao deu' }))
        } else {
          ws.send(JSON.stringify({ tipo: 'resposta', id: m.id, ok: true, resultado: { feito: m.args.x } }))
        }
      })
      ws.send(JSON.stringify({ tipo: 'ola', versao: 1, app: 'teste' }))
      await olaOk
      assert.deepEqual(await p.pede('mover', { x: 1 }), { feito: 1 })
      await assert.rejects(p.pede('mover', { x: 2 }), /nao deu/)
    } finally {
      ws.terminate()
    }
  })
})

test('pede sem app conectado rejeita', async () => {
  const { app } = await pastaComIndex()
  await comPonte(app, async (p) => {
    await assert.rejects(p.pede('mover', {}), /nenhum app conectado/)
  })
})
