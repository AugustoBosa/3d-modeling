// Integração: sobe o servidor MCP de verdade (stdio) e fala com ele pelo cliente do SDK.
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, describe, it, test } from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { z } from 'zod'
import { tools } from '../src/tools.ts'

const NOMES = ['projeto_novo', 'projeto_abrir', 'projeto_salvar', 'impressora_definir', 'impressoras_listar', 'parametro_definir', 'desfazer', 'refazer', 'features_listar']
const URIS = ['docs://api', 'printers://lista', 'projeto://atual']
const SERVIDOR = fileURLToPath(new URL('../bin/3d-modeling-mcp.mjs', import.meta.url))

type Resposta = { content: { type: string; text: string }[]; isError?: boolean }

describe('servidor MCP (stdio)', () => {
  let client: Client
  let pasta: string

  before(async () => {
    pasta = mkdtempSync(path.join(os.tmpdir(), 'mcp-teste-'))
    client = new Client({ name: 'teste', version: '0.0.0' })
    await client.connect(new StdioClientTransport({
      command: process.execPath,
      args: [SERVIDOR],
      // Porta 0 cairia no padrão 47800 (ponte.ts usa `||`), então a ponte fica desligada no teste.
      env: { ...process.env, MODELING_MCP_PORT: '0', MODELING_MCP_PONTE: '0', MODELING_MCP_DIR: pasta } as Record<string, string>,
    }))
  })

  after(async () => {
    await client.close()
    rmSync(pasta, { recursive: true, force: true })
  })

  const chama = async (name: string, args: Record<string, unknown> = {}) =>
    (await client.callTool({ name, arguments: args })) as Resposta

  const json = (r: Resposta) => JSON.parse(r.content[0].text) as Record<string, any>

  const projeto = async () => {
    const r = await client.readResource({ uri: 'projeto://atual' })
    return JSON.parse((r.contents[0] as { text: string }).text) as { parametros: Record<string, unknown> }
  }

  it('lista as 9 tools, cada uma com inputSchema', async () => {
    const { tools: lista } = await client.listTools()
    const nomes = lista.map(t => t.name)
    for (const n of NOMES) assert.ok(nomes.includes(n), `falta a tool ${n}`)
    for (const t of lista) assert.equal(t.inputSchema.type, 'object', `${t.name} sem inputSchema`)
  })

  it('lista os 3 recursos', async () => {
    const { resources } = await client.listResources()
    const uris = resources.map(r => r.uri)
    for (const u of URIS) assert.ok(uris.includes(u), `falta o recurso ${u}`)
  })

  it('docs://api documenta parametro_definir', async () => {
    const r = await client.readResource({ uri: 'docs://api' })
    assert.match((r.contents[0] as { text: string }).text, /parametro_definir/)
  })

  it('projeto_novo, parametro_definir e desfazer mudam o projeto', async () => {
    assert.equal(json(await chama('projeto_novo')).ok, true)

    assert.equal(json(await chama('parametro_definir', { nome: 'L', expr: '80' })).ok, true)
    assert.ok((await projeto()).parametros.L, 'L deveria existir')

    const d = json(await chama('desfazer'))
    assert.equal(d.ok, true)
    assert.equal((await projeto()).parametros.L, undefined, 'L não deveria existir após desfazer')
  })

  it('parametro_definir com nome inválido volta isError', async () => {
    const r = await chama('parametro_definir', { nome: '1x', expr: '1' })
    assert.equal(r.isError, true)
  })

  it('impressora_definir com id inexistente volta isError', async () => {
    const r = await chama('impressora_definir', { id: 'nao-existe' })
    assert.equal(r.isError, true)
  })

  it('projeto_salvar grava o arquivo na pasta do projeto', async () => {
    const r = json(await chama('projeto_salvar', { caminho: 'teste' }))
    assert.equal(r.ok, true)
    assert.ok(existsSync(path.join(pasta, 'teste.3dm.json')), 'arquivo não foi gravado')
  })
})

test('o exemplo de cada tool passa no próprio schema', () => {
  for (const t of tools) {
    assert.equal(z.object(t.entrada).safeParse(t.exemplo).success, true, `exemplo inválido em ${t.nome}`)
  }
})
