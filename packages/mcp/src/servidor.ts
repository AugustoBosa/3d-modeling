// Executável do MCP: stdio para o agente, ponte HTTP+WS para o app. Stdout é o protocolo: só stderr para avisos.
import path from 'node:path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { impressoras } from '@3dm/core/printers'
import { textoDocumento } from '@3dm/core/doc'
import { criaSessao } from './headless.ts'
import { iniciarPonte, type Ponte } from './ponte.ts'
import { docsApi, tools } from './tools.ts'
import { criaDespacho } from './despacho.ts'

const sessao = criaSessao(process.env.MODELING_MCP_DIR || path.join(process.cwd(), '3dm-projetos'))

let ponte: Ponte | null = null
if (process.env.MODELING_MCP_PONTE !== '0') {
  try {
    ponte = await iniciarPonte()
    process.stderr.write(`App: ${ponte.url}#token=${ponte.token}\n`)
  } catch (err) {
    process.stderr.write(`aviso: ponte do app não subiu (${(err as Error).message}). O MCP segue sem o app.\n`)
  }
}

const executa = criaDespacho(sessao, () => ponte)
const server = new McpServer({ name: '3d-modeling', version: '0.0.0' })

for (const t of tools) {
  server.registerTool(t.nome, { description: t.descricao, inputSchema: t.entrada }, async (args) => {
    try {
      const res = await executa(t, args as Record<string, unknown>)
      const { _anexos, ...resto } = (res ?? {}) as { _anexos?: { nome: string; mime: string; texto?: string; base64?: string }[] }
      const anexos = (_anexos ?? []).map(a => a.base64
        ? { type: 'image' as const, data: a.base64, mimeType: a.mime }
        : { type: 'resource' as const, resource: { uri: `captura://${a.nome}`, mimeType: a.mime, text: a.texto ?? '' } })
      return { content: [{ type: 'text' as const, text: JSON.stringify(resto) }, ...anexos] }
    } catch (err) {
      return { isError: true, content: [{ type: 'text', text: (err as Error).message }] }
    }
  })
}

server.registerResource('docs-api', 'docs://api', {
  description: 'Referência das tools: nomes, parâmetros e exemplos.',
  mimeType: 'text/markdown',
}, (uri) => ({ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: docsApi() }] }))

server.registerResource('impressoras', 'printers://lista', {
  description: 'Impressoras disponíveis no core.',
  mimeType: 'application/json',
}, (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(impressoras, null, 2) }] }))

server.registerResource('projeto-atual', 'projeto://atual', {
  description: 'Documento do projeto atual (.3dm.json).',
  mimeType: 'application/json',
}, (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: textoDocumento(sessao.doc) }] }))

const fechar = async () => {
  await ponte?.fechar()
  process.exit(0)
}
process.stdin.on('end', fechar)
process.on('SIGINT', fechar)

await server.connect(new StdioServerTransport())
