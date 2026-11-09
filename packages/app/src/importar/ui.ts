// Comandos IMPORTAR, LIMPAREF e TEXTO, e a entrada de arquivos (seletor e arrastar sobre a vista).
// A fonte do texto é carregada só na primeira vez que TEXTO roda (import dinâmico, fora do bundle inicial).
import type * as ModuloTexto from '@3dm/core/texto'
import { sketchDePolilinhas } from '@3dm/core/importar'
import { adicionaFeature, idLivre } from '@3dm/core/features'
import type { Projeto } from '../projeto.ts'
import type { Contexto, Registro } from '../linha/registro.ts'
import type { Vista } from '../viewport/vista.ts'
import { novaFeature } from '../features/esquemas.ts'
import { T } from '../textos.ts'
import { classifica } from './classifica.ts'
import { criaReferencias } from './referencia.ts'

export interface DepsImportar {
  projeto: Projeto
  vista: Vista
  reg: Registro
  aviso(t: string, erro?: boolean): void
}

type Fonte = ReturnType<typeof ModuloTexto.carregaFonte>
let fonteCarregada: Promise<{ modulo: typeof ModuloTexto; fonte: Fonte }> | undefined

/** Carrega o módulo de texto e a Roboto uma vez; se falhar, tenta de novo na próxima vez. */
function carregaFonteSobDemanda() {
  fonteCarregada ??= Promise.all([
    import('@3dm/core/texto'),
    import('@fontsource/roboto/files/roboto-latin-400-normal.woff?url').then(m => m.default),
  ]).then(async ([modulo, url]) => {
    const r = await fetch(url)
    if (!r.ok) throw new Error(String(r.status))
    return { modulo, fonte: modulo.carregaFonte(await r.arrayBuffer()) }
  }).catch(e => { fonteCarregada = undefined; throw e })
  return fonteCarregada
}

export function criaImportar(d: DepsImportar) {
  const { projeto, reg, aviso } = d
  const referencias = criaReferencias(d.vista)
  const PLANO = { base: 'XY' as const, offset: 0 }

  async function importaArquivo(f: File): Promise<void> {
    try {
      const r = classifica(f.name, new Uint8Array(await f.arrayBuffer()))
      if (r.tipo === 'malhas') {
        if (!r.itens.length) return aviso(T.importar.formatoInvalido(f.name), true)
        for (const it of r.itens) aviso(T.importar.referencia(it.nome, referencias.adiciona(it.nome, it.malha)))
      } else if (r.tipo === 'svg') {
        if (!r.contornos.length) return aviso(T.importar.svgVazio(f.name), true)
        projeto.executa(sketchDePolilinhas(r.contornos, PLANO))
        aviso(T.importar.svgOk(f.name, r.contornos.length))
      } else {
        aviso(T.importar.formatoInvalido(f.name), true)
      }
    } catch (e) {
      aviso(T.importar.falhou(f.name, (e as Error).message), true)
    }
  }

  function abreSeletor() {
    const i = Object.assign(document.createElement('input'), { type: 'file', accept: T.importar.aceita, multiple: true })
    i.onchange = () => { for (const f of Array.from(i.files ?? [])) void importaArquivo(f) }
    i.click()
  }

  /** Número positivo da pergunta; vazio usa o padrão. Devolve undefined se cancelou ou se o valor é inválido. */
  async function lePositivo(ctx: Contexto, pergunta: string, padrao: number): Promise<number | undefined> {
    const r = await ctx.pergunta(pergunta)
    if (r === null) return undefined
    const t = r.trim()
    if (!t) return padrao
    const v = Number(t)
    if (!Number.isFinite(v) || v <= 0) { aviso(T.texto.numeroInvalido(t), true); return undefined }
    return v
  }

  async function textoCmd(ctx: Contexto) {
    const texto = (await ctx.pergunta(T.texto.perguntaTexto, true))?.trim()
    if (texto === undefined) return
    if (!texto) return aviso(T.texto.vazio, true)
    const tamanho = await lePositivo(ctx, T.texto.perguntaTamanho, 10)
    if (tamanho === undefined) return
    const espessura = await lePositivo(ctx, T.texto.perguntaAltura, 2)
    if (espessura === undefined) return
    aviso(T.texto.carregando)
    let carregada: Awaited<ReturnType<typeof carregaFonteSobDemanda>>
    try { carregada = await carregaFonteSobDemanda() } catch { return aviso(T.texto.fonteFalhou, true) }
    const contornos = carregada.modulo.textoParaContornos(carregada.fonte, texto, tamanho)
    if (!contornos.length) return aviso(T.texto.vazio, true)
    const sk = sketchDePolilinhas(contornos, PLANO)
    projeto.executa(sk)
    const f = novaFeature('extrude', idLivre(projeto.doc, 'ex'), { corpos: [], sketches: [sk.id] })
    f.distancia = espessura
    projeto.executa(adicionaFeature(f))
    aviso(T.texto.criado(texto))
  }

  const vistaEl = document.getElementById('vista')
  vistaEl?.addEventListener('dragover', e => e.preventDefault())
  vistaEl?.addEventListener('drop', e => {
    e.preventDefault()
    for (const f of Array.from(e.dataTransfer?.files ?? [])) void importaArquivo(f)
  })

  reg.registra({ nome: 'IMPORTAR', aliases: ['IMP', 'IMPORT'], descricao: T.importar.cmd.IMPORTAR, executa: () => abreSeletor() })
  reg.registra({
    nome: 'LIMPAREF', aliases: [], descricao: T.importar.removerRef,
    executa() { referencias.limpa(); aviso(T.importar.refsRemovidas) },
  })
  reg.registra({ nome: 'TEXTO', aliases: ['TEXT', 'TXT'], descricao: T.texto.cmd.TEXTO, executa: textoCmd })

  return { importaArquivo, abreSeletor, quantidade: () => referencias.quantidade() }
}
