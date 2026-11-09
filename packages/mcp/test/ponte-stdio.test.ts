// Integração da ponte: servidor MCP real por stdio + "aba" simulada no Node, com o cliente real do app.
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { definirParametroCompleto } from '@3dm/core/features'
import { criaProjeto } from '../../app/src/projeto.ts'
import { criaClientePonte } from '../../app/src/ponte/cliente.ts'

const SERVIDOR = fileURLToPath(new URL('../bin/3d-modeling-mcp.mjs', import.meta.url))

type Conteudo = { type: string; text?: string; data?: string; mimeType?: string }
type Resposta = { content: Conteudo[]; isError?: boolean }
type Cliente = ReturnType<typeof criaClientePonte>

const dorme = (ms: number) => new Promise(r => setTimeout(r, ms))

async function espera(cond: () => boolean, ms = 5000): Promise<void> {
  const fim = Date.now() + ms
  while (!cond()) {
    if (Date.now() > fim) throw new Error('tempo esgotado')
    await dorme(10)
  }
}

// O servidor escreve "App: http://127.0.0.1:<porta>/#token=<token>" no stderr quando a ponte sobe.
function lePonte(stderr: NonNullable<StdioClientTransport['stderr']>): Promise<{ porta: number; token: string }> {
  return new Promise((resolver, rejeitar) => {
    let buf = ''
    const fim = setTimeout(() => rejeitar(new Error('ponte não anunciada em 5 s')), 5000)
    stderr.on('data', (d: Buffer) => {
      buf += d.toString('utf8')
      const m = /App: http:\/\/127\.0\.0\.1:(\d+)\/#token=(\S+)/.exec(buf)
      if (m) {
        clearTimeout(fim)
        resolver({ porta: Number(m[1]), token: m[2]! })
      }
    })
  })
}

// Abre o WebSocket sem aceitação: passa só se o servidor recusar (fecha ou dá erro sem abrir).
function recusado(url: string, protocolos?: string[]): Promise<void> {
  return new Promise((resolver, rejeitar) => {
    const ws = protocolos ? new WebSocket(url, protocolos) : new WebSocket(url)
    ws.onopen = () => {
      ws.close()
      rejeitar(new Error(`conexão aceita em ${url}`))
    }
    ws.onerror = () => resolver()
    ws.onclose = () => resolver()
  })
}

test('ponte: servidor MCP por stdio e aba simulada, edição e undo nos dois sentidos', { timeout: 60_000 }, async () => {
  const pasta = mkdtempSync(path.join(os.tmpdir(), 'mcp-ponte-'))
  const client = new Client({ name: 'teste-ponte', version: '0.0.0' })
  const projeto = criaProjeto()
  let cliente: Cliente | undefined
  try {
    const transporte = new StdioClientTransport({
      command: process.execPath,
      args: [SERVIDOR],
      env: { ...process.env, MODELING_MCP_PORT: '0', MODELING_MCP_DIR: pasta } as Record<string, string>,
      stderr: 'pipe',
    })
    await client.connect(transporte)
    const { porta, token } = await lePonte(transporte.stderr!)

    const bruta = async (nome: string, args: Record<string, unknown> = {}): Promise<Resposta> => {
      const r = await client.callTool({ name: nome, arguments: args }) as Resposta
      if (r.isError) throw new Error(`${nome} falhou: ${r.content.find(c => c.type === 'text')?.text ?? ''}`)
      return r
    }
    const chama = async (nome: string, args: Record<string, unknown> = {}): Promise<any> => {
      const r = await bruta(nome, args)
      return JSON.parse(r.content.find(c => c.type === 'text')!.text!)
    }

    // 1. Sem aba: headless, sem `modo`
    const semAba = await chama('parametro_definir', { nome: 'L', expr: '80' })
    assert.equal(semAba.modo, undefined)

    // 2. Sobe a aba: o documento da aba (vazio) é a fonte, não a sessão do servidor
    cliente = criaClientePonte({
      projeto,
      capturar: async (v) => v.map(vista => ({ vista, png: 'AAAA' })),
      aoEstado: () => {},
      textos: { desconectado: 'd', conectando: 'c', conectado: 'ok', reconectando: s => 'r' + s, semPermissao: u => u },
      urlWs: () => `ws://127.0.0.1:${porta}/`,
      esperasMs: [50],
    })
    cliente.conecta(token)
    await espera(() => cliente!.estado === 'conectado')

    const feats = await chama('features_listar')
    assert.equal(feats.modo, 'ponte')
    const h = await chama('parametro_definir', { nome: 'H', expr: '30' })
    assert.equal(h.modo, 'ponte')
    assert.equal(projeto.doc.parametros.H!.expr, '30')
    assert.equal(projeto.doc.parametros.L, undefined)

    // 3. Edição do usuário na aba aparece para o agente
    projeto.executa(definirParametroCompleto('W', { expr: '50' }))
    await dorme(100)
    const par = await chama('parametro_definir', { nome: 'parede', expr: '2' })
    assert.equal(par.modo, 'ponte')
    assert.deepEqual(Object.keys(par.parametros).sort(), ['H', 'W', 'parede'])

    // 4. Undo da aba vale para o agente e vice-versa
    projeto.desfaz()
    assert.equal(projeto.doc.parametros.parede, undefined)
    const desf = await chama('desfazer')
    assert.deepEqual([desf.ok, desf.comando, desf.modo], [true, 'PARAM W', 'ponte'])
    assert.equal(projeto.doc.parametros.W, undefined)
    const ref = await chama('refazer')
    assert.equal(ref.ok, true)
    assert.equal((projeto.doc.parametros.W as { expr: string }).expr, '50')

    // 5. Capturas: PNG da aba como conteúdo image e arquivos na pasta do projeto
    const cap = await bruta('captura', { vistas: ['iso', 'topo'] })
    const imagens = cap.content.filter(c => c.type === 'image')
    assert.equal(imagens.length, 2)
    for (const im of imagens) {
      assert.equal(im.mimeType, 'image/png')
      assert.equal(im.data, 'AAAA')
    }
    for (const v of ['iso', 'topo']) assert.ok(existsSync(path.join(pasta, 'capturas', `${v}.png`)), `captura ${v} ausente`)

    // 6. Salvar: o arquivo é o documento da aba
    const salvo = await chama('projeto_salvar', { caminho: 'viva' })
    assert.deepStrictEqual(
      JSON.parse(readFileSync(salvo.caminho as string, 'utf8')),
      JSON.parse(JSON.stringify(projeto.doc)),
    )

    // 7. Recusa sem token e com token errado
    const url = `ws://127.0.0.1:${porta}/`
    await recusado(url)
    await recusado(url, ['token.errado'])

    // 8. Desconectou: volta ao modo headless
    cliente.desconecta()
    await dorme(200)
    const depois = await chama('parametro_definir', { nome: 'L', expr: '80' })
    assert.equal(depois.modo, undefined)
  } finally {
    cliente?.desconecta()
    await client.close()
    rmSync(pasta, { recursive: true, force: true })
  }
})
