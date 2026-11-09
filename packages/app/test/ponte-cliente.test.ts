import { test } from 'node:test'
import assert from 'node:assert/strict'
import { novoDocumento } from '@3dm/core/doc'
import { criaProjeto } from '../src/projeto.ts'
import {
  criaClientePonte,
  ehSiteHttpsPublico,
  tokenDoHash,
  urlLocal,
  type EstadoPonte,
  type TextosPonte,
} from '../src/ponte/cliente.ts'
import { iniciarPonte, type Ponte } from '../../mcp/src/ponte.ts'
import type { ResultadoCaptura } from '../../mcp/src/protocolo.ts'

const TOKEN = 'token-de-teste'

const textos: TextosPonte = {
  desconectado: 'off',
  conectando: 'conn',
  conectado: 'on',
  reconectando: (s) => `re${s}`,
  semPermissao: (u) => `sem ${u}`,
}

const espera = async (cond: () => boolean, ms = 2000): Promise<void> => {
  const fim = Date.now() + ms
  while (!cond()) {
    if (Date.now() > fim) throw new Error('tempo esgotado')
    await new Promise((r) => setTimeout(r, 10))
  }
}

const dorme = (ms: number) => new Promise((r) => setTimeout(r, ms))

function cenario(porta: number) {
  const projeto = criaProjeto()
  const estados: EstadoPonte[] = []
  const cli = criaClientePonte({
    projeto,
    capturar: async () => [{ vista: 'iso', png: 'AAAA' }],
    aoEstado: (e) => estados.push(e),
    textos,
    urlWs: () => `ws://127.0.0.1:${porta}/`,
    esperasMs: [20],
  })
  return { projeto, cli, estados }
}

const comParametro = (nome: string, expr: string) => ({ ...novoDocumento(), parametros: { [nome]: { expr } } })

test('conecta com token certo e envia o estado ao servidor', async () => {
  const ponte: Ponte = await iniciarPonte({ porta: 0, token: TOKEN })
  const { projeto, cli } = cenario(ponte.porta)
  try {
    cli.conecta(TOKEN)
    await espera(() => cli.estado === 'conectado')
    await espera(() => ponte.estado !== null)
    assert.deepEqual(ponte.estado?.doc, JSON.parse(JSON.stringify(projeto.doc)))
  } finally {
    cli.desconecta()
    await ponte.fechar()
  }
})

test('aplicar troca o documento, chega ao servidor e desfaz', async () => {
  const ponte = await iniciarPonte({ porta: 0, token: TOKEN })
  const { projeto, cli } = cenario(ponte.porta)
  try {
    cli.conecta(TOKEN)
    await espera(() => cli.estado === 'conectado')
    await ponte.pede('aplicar', { doc: comParametro('L', '5'), nome: 'teste' })
    assert.deepEqual(projeto.doc.parametros.L, { expr: '5' })
    await espera(() => ponte.estado?.doc.parametros.L !== undefined)
    projeto.desfaz()
    assert.equal(projeto.doc.parametros.L, undefined)
  } finally {
    cli.desconecta()
    await ponte.fechar()
  }
})

test('desfazer e refazer devolvem o nome do comando ou null', async () => {
  const ponte = await iniciarPonte({ porta: 0, token: TOKEN })
  const { cli } = cenario(ponte.porta)
  try {
    cli.conecta(TOKEN)
    await espera(() => cli.estado === 'conectado')
    await ponte.pede('aplicar', { doc: comParametro('A', '1'), nome: 'a' })
    await ponte.pede('aplicar', { doc: comParametro('B', '2'), nome: 'b' })
    assert.deepEqual(await ponte.pede('desfazer', {}), { comando: 'MCP b' })
    assert.deepEqual(await ponte.pede('desfazer', {}), { comando: 'MCP a' })
    assert.deepEqual(await ponte.pede('desfazer', {}), { comando: null })
    assert.deepEqual(await ponte.pede('refazer', {}), { comando: 'MCP a' })
  } finally {
    cli.desconecta()
    await ponte.fechar()
  }
})

test('captura devolve as imagens', async () => {
  const ponte = await iniciarPonte({ porta: 0, token: TOKEN })
  const { cli } = cenario(ponte.porta)
  try {
    cli.conecta(TOKEN)
    await espera(() => cli.estado === 'conectado')
    const r = (await ponte.pede('captura', { vistas: ['iso'] })) as ResultadoCaptura
    assert.deepEqual(r, { imagens: [{ vista: 'iso', png: 'AAAA' }] })
  } finally {
    cli.desconecta()
    await ponte.fechar()
  }
})

test('token errado nunca conecta e desconecta encerra os timers', async () => {
  const ponte = await iniciarPonte({ porta: 0, token: TOKEN })
  const { cli, estados } = cenario(ponte.porta)
  try {
    cli.conecta('errado')
    await dorme(200)
    assert.equal(ponte.conectado, false)
    assert.notEqual(cli.estado, 'conectado')
    cli.desconecta()
    assert.equal(cli.estado, 'desconectado')
    const antes = estados.length
    await dorme(100)
    assert.equal(estados.length, antes)
  } finally {
    cli.desconecta()
    await ponte.fechar()
  }
})

test('reconecta com o mesmo token depois que o servidor volta', async () => {
  const ponte1 = await iniciarPonte({ porta: 0, token: TOKEN })
  const porta = ponte1.porta
  const { cli } = cenario(porta)
  let ponte2: Ponte | null = null
  try {
    cli.conecta(TOKEN)
    await espera(() => cli.estado === 'conectado')
    await ponte1.fechar()
    await espera(() => cli.estado === 'reconectando')
    ponte2 = await iniciarPonte({ porta, token: TOKEN })
    await espera(() => cli.estado === 'conectado', 3000)
  } finally {
    cli.desconecta()
    if (ponte2) await ponte2.fechar()
  }
})

test('tokenDoHash, ehSiteHttpsPublico e urlLocal', () => {
  assert.equal(tokenDoHash('#token=abc'), 'abc')
  assert.equal(tokenDoHash('#a=1&token=abc'), 'abc')
  assert.equal(tokenDoHash('#a=1'), null)
  assert.equal(tokenDoHash('#token='), null)
  assert.equal(tokenDoHash(''), null)

  assert.equal(ehSiteHttpsPublico({ protocol: 'https:', hostname: 'meu.site.com' }), true)
  assert.equal(ehSiteHttpsPublico({ protocol: 'https:', hostname: 'localhost' }), false)
  assert.equal(ehSiteHttpsPublico({ protocol: 'https:', hostname: '127.0.0.1' }), false)
  assert.equal(ehSiteHttpsPublico({ protocol: 'http:', hostname: 'meu.site.com' }), false)
  assert.equal(ehSiteHttpsPublico({ protocol: 'http:', hostname: 'localhost' }), false)

  assert.equal(urlLocal(1234), 'http://127.0.0.1:1234/')
  assert.equal(urlLocal(), 'http://127.0.0.1:47800/')
})
