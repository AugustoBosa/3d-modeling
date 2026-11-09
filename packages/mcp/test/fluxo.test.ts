// Integração: fluxo-exemplo "caixa com tampa" pelo servidor MCP (stdio). Prova que o 3MF headless é igual ao que o core
// produz a partir do resultado do worker do app (mesmo Regenerador, mesma tolerância de exportação).
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { lerDocumento } from '@3dm/core/doc'
import { config3mfDe, escrever3mf, saborDe } from '@3dm/core/export'
import { filamentoPorId } from '@3dm/core/filaments'
import { TOL_EXPORT } from '@3dm/core/kernel'
import { impressoraPorId } from '@3dm/core/printers'
import { Regenerador } from '@3dm/core/regen'
import { processa } from '../../app/src/worker/processa.ts'

const SERVIDOR = fileURLToPath(new URL('../bin/3d-modeling-mcp.mjs', import.meta.url))

type Conteudo = { type: string; text?: string; resource?: { uri: string; mimeType: string; text: string } }
type Resposta = { content: Conteudo[]; isError?: boolean }

test('fluxo caixa com tampa: modelo, impressão, capturas, export e hash igual ao do core', { timeout: 60_000 }, async () => {
  const pasta = mkdtempSync(path.join(os.tmpdir(), 'mcp-fluxo-'))
  const client = new Client({ name: 'teste-fluxo', version: '0.0.0' })
  try {
    await client.connect(new StdioClientTransport({
      command: process.execPath,
      args: [SERVIDOR],
      // Ponte desligada: o teste só fala por stdio.
      env: { ...process.env, MODELING_MCP_PORT: '0', MODELING_MCP_PONTE: '0', MODELING_MCP_DIR: pasta } as Record<string, string>,
    }))

    const bruta = async (nome: string, args: Record<string, unknown> = {}): Promise<Resposta> => {
      const r = await client.callTool({ name: nome, arguments: args }) as Resposta
      const texto = r.content.find(c => c.type === 'text')?.text ?? ''
      if (r.isError) throw new Error(`${nome} falhou: ${texto}`)
      return r
    }
    const chama = async (nome: string, args: Record<string, unknown> = {}): Promise<any> => {
      const r = await bruta(nome, args)
      return JSON.parse(r.content.find(c => c.type === 'text')!.text!)
    }

    // 1. Projeto e parâmetros
    await chama('projeto_novo')
    await chama('parametro_definir', { nome: 'L', expr: '80' })
    await chama('parametro_definir', { nome: 'W', expr: '50' })
    await chama('parametro_definir', { nome: 'H', expr: '30' })
    await chama('parametro_definir', { nome: 'parede', expr: '2' })
    await chama('parametro_definir', { nome: 'folga', expr: '0.2' })

    // 2. Caixa: retângulo, extrusão e casca aberta no topo
    await chama('sketch_criar', { plano: 'XY' })
    const sk = await chama('sketch_adicionar', {
      sketch: 'sk1',
      entidades: [{ tipo: 'retangulo', x: 0, y: 0, largura: 80, altura: 50 }],
    })
    assert.equal(sk.perfis, 1)
    await chama('extrudar', { sketch: 'sk1', distancia: 'H' })
    await chama('shell', { espessura: 'parede', abrir: ['topo'] })

    // 3. Tampa: placa + encaixe unido à placa
    const tampa = await chama('primitiva', { tipo: 'caixa', pos: [0, 0, 32], dim: ['L', 'W', 2] })
    await chama('primitiva', {
      tipo: 'caixa',
      pos: ['parede+folga', 'parede+folga', 30],
      dim: ['L-2*(parede+folga)', 'W-2*(parede+folga)', 2],
      operacao: 'unir',
      alvo: tampa.id,
    })

    // 4. Medidas: 2 corpos, todos fechados, caixa 80x50x30 com volume esperado
    const info = await chama('modelo_info')
    assert.equal(info.corpos.length, 2)
    assert.ok(info.corpos.every((c: { fechada: boolean }) => c.fechada === true), 'todos os corpos devem ser fechados')
    const caixa = info.corpos.find((c: { bbox: { tamanho: number[] } }) => c.bbox.tamanho.every((v: number, i: number) => Math.abs(v - [80, 50, 30][i]) < 1e-3))
    assert.ok(caixa, 'corpo da caixa 80x50x30 não encontrado')
    assert.ok(Math.abs(caixa.volume_mm3 - (80 * 50 * 30 - 76 * 46 * 28)) <= 1, `volume ${caixa.volume_mm3}`)
    assert.ok(caixa.massa_g > 0)

    // 5. Impressão: sem bloqueio nem erro
    const impressao = await chama('verificar_impressao')
    assert.equal(impressao.ok, true, `achados: ${JSON.stringify(impressao.achados)}`)

    // 6. Capturas: 4 vistas como resource SVG e arquivos gravados
    const capturas = await bruta('captura')
    const svgs = capturas.content.filter(c => c.type === 'resource')
    assert.equal(svgs.length, 4)
    for (const c of svgs) {
      assert.equal(c.resource!.mimeType, 'image/svg+xml')
      assert.ok(c.resource!.text.startsWith('<svg'))
    }
    for (const v of ['iso', 'frente', 'topo', 'direita']) {
      assert.ok(existsSync(path.join(pasta, 'capturas', `${v}.svg`)), `captura ${v} ausente`)
    }

    // 7. Exportação: 3MF (começa com PK) e STL com um arquivo por corpo
    const exp3mf = await chama('exportar', { formato: '3mf', caminho: 'caixa-com-tampa.3mf' })
    const arq3mf = exp3mf.arquivos[0].caminho as string
    assert.ok(existsSync(arq3mf))
    assert.equal(readFileSync(arq3mf).subarray(0, 2).toString('latin1'), 'PK')

    const expStl = await chama('exportar', { formato: 'stl', caminho: 'caixa.stl' })
    assert.equal(expStl.arquivos.length, 2)
    for (const a of expStl.arquivos) assert.ok(existsSync(a.caminho), `STL ausente: ${a.caminho}`)

    // 8. Projeto salvo e hash: o 3MF do core a partir do worker tem de ser igual ao do MCP
    const salvo = await chama('projeto_salvar', { caminho: 'caixa' })
    const doc = lerDocumento(readFileSync(salvo.caminho as string, 'utf8'))
    const r = processa({ id: 1, tipo: 'regen', doc, tol: TOL_EXPORT }, new Regenerador())
    if ('erro' in r) throw new Error(r.erro)
    const corpos = r.corpos.map(c => ({
      nome: c.id,
      malha: { posicoes: c.pos, indices: c.idx },
      cor: doc.aparencia[c.id]?.cor ?? '#d9b36c',
      slot: 1,
    }))
    const imp = impressoraPorId(doc.impressora)!
    const bytes = escrever3mf({ corpos, sabor: saborDe(imp), config: config3mfDe(imp, filamentoPorId('pla')!) })
    const hashCore = createHash('sha256').update(bytes).digest('hex')
    const hashMcp = createHash('sha256').update(readFileSync(arq3mf)).digest('hex')
    assert.equal(hashCore, hashMcp)

    // 9. Desfazer e refazer a última feature sólida
    const antes = (await chama('features_listar')).features.length
    await chama('desfazer')
    assert.equal((await chama('features_listar')).features.length, antes - 1)
    await chama('refazer')
    assert.equal((await chama('features_listar')).features.length, antes)
  } finally {
    await client.close()
    rmSync(pasta, { recursive: true, force: true })
  }
})
