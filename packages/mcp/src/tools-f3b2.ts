// Tools MCP de importação: SVG vira sketch (importar_svg) e texto vira sólido extrudado (texto_3d).
// A fonte Roboto é lida uma vez e fica em cache de módulo.
import { readFileSync } from 'node:fs'
import { z } from 'zod'
import { sketchDePolilinhas, lerSvg } from '@3dm/core/importar'
import { adicionaFeature, idLivre } from '@3dm/core/features'
import type { Feature } from '@3dm/core/doc'
import { sketchResolvido } from '@3dm/core/sketch'
import { carregaFonte, textoParaContornos } from '@3dm/core/texto'
import { executaChecando, resumo } from './modelo.ts'
import type { Sessao } from './sessao.ts'
import type { Tool } from './tool.ts'

const PLANO = z.enum(['XY', 'XZ', 'YZ'])
type Fonte = ReturnType<typeof carregaFonte>

let fonteCache: Fonte | undefined

function fonte(): Fonte {
  if (fonteCache) return fonteCache
  let bytes: Buffer
  try {
    bytes = readFileSync(new URL('../../../node_modules/@fontsource/roboto/files/roboto-latin-400-normal.woff', import.meta.url))
  } catch (e) {
    throw new Error(`não foi possível ler a fonte Roboto: ${e instanceof Error ? e.message : String(e)}. Correção: instale a dependência @fontsource/roboto (npm install na raiz).`)
  }
  fonteCache = carregaFonte(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
  return fonteCache
}

/** Lê o SVG de um caminho relativo à pasta do projeto (caminhoSaida barra traversal). */
function lePlanoSvg(s: Sessao, caminho: string): string {
  let abs: string
  try {
    abs = s.caminhoSaida(caminho)
  } catch (e) {
    throw new Error(`${e instanceof Error ? e.message : String(e)}. Correção: use um caminho dentro da pasta do projeto ou passe o texto do SVG.`)
  }
  try {
    return readFileSync(abs, 'utf8')
  } catch (e) {
    throw new Error(`não foi possível ler o SVG "${caminho}": ${e instanceof Error ? e.message : String(e)}. Correção: confira se o arquivo existe na pasta do projeto ou passe o texto do SVG.`)
  }
}

export const toolsF3b2: Tool[] = [
  {
    nome: 'importar_svg',
    descricao: 'Importa um SVG como sketch: contornos fechados viram perfis, em mm, no plano escolhido. svg é o texto do SVG ou um caminho relativo à pasta do projeto. escala multiplica as coordenadas; offset desloca o plano ao longo da normal. Desfazível.',
    entrada: {
      svg: z.string().describe('texto do SVG (começa com <) ou caminho relativo à pasta do projeto'),
      plano: PLANO.describe('plano de trabalho do sketch'),
      escala: z.number().positive().optional().describe('fator sobre as coordenadas. Padrão: 1.'),
      offset: z.number().optional().describe('distância em mm ao longo da normal do plano. Padrão: 0.'),
    },
    exemplo: { svg: '<svg xmlns="http://www.w3.org/2000/svg" width="20mm" height="10mm" viewBox="0 0 20 10"><rect x="0" y="0" width="20" height="10"/></svg>', plano: 'XY' },
    executa(s: Sessao, { svg, plano, escala, offset }: { svg: string; plano: 'XY' | 'XZ' | 'YZ'; escala?: number; offset?: number }) {
      const texto = svg.trimStart().startsWith('<') ? svg : lePlanoSvg(s, svg)
      const r = lerSvg(texto)
      if (!r.contornos.length) {
        throw new Error('O SVG não tem contornos fechados (rect, circle, ellipse, polygon, polyline ou path fechado). Correção: confira o conteúdo do SVG e use formas fechadas.')
      }
      const cmd = sketchDePolilinhas(r.contornos, { base: plano, offset: offset ?? 0 }, escala ?? 1)
      s.executa(cmd)
      const perfis = sketchResolvido(s.doc, cmd.id)?.perfis.perfis.length ?? 0
      return { ok: true, sketch: cmd.id, contornos: r.contornos.length, largura: r.largura, altura: r.altura, perfis }
    },
  },
  {
    nome: 'texto_3d',
    descricao: 'Cria um texto em 3D (fonte Roboto): sketch com os contornos do texto e extrusão de espessura em mm. tamanho é a altura em mm; plano padrão XY; posicao [x, y] em mm no plano. Desfazível.',
    entrada: {
      texto: z.string().describe('texto a gerar'),
      tamanho: z.number().positive().describe('tamanho em mm'),
      espessura: z.number().positive().describe('espessura da extrusão em mm'),
      plano: PLANO.optional().describe('plano de trabalho. Padrão: XY.'),
      posicao: z.tuple([z.number(), z.number()]).optional().describe('posição [x, y] em mm no plano. Padrão: [0, 0].'),
    },
    exemplo: { texto: 'Oi', tamanho: 10, espessura: 2 },
    executa(s: Sessao, { texto, tamanho, espessura, plano, posicao }: { texto: string; tamanho: number; espessura: number; plano?: 'XY' | 'XZ' | 'YZ'; posicao?: [number, number] }) {
      if (!texto.trim()) throw new Error('texto vazio. Correção: informe ao menos um caractere que não seja espaço.')
      const contornos = textoParaContornos(fonte(), texto, tamanho)
      if (!contornos.length) throw new Error('o texto não gera contornos. Correção: use letras ou números.')
      const [dx, dy] = posicao ?? [0, 0]
      const deslocados = contornos.map(c => c.map(([x, y]): [number, number] => [x + dx, y + dy]))
      const sk = sketchDePolilinhas(deslocados, { base: plano ?? 'XY', offset: 0 })
      s.executa(sk)
      try {
        const id = idLivre(s.doc, 'ex')
        const f = { id, tipo: 'extrude', sketch: sk.id, distancia: espessura } as Feature
        const r = executaChecando(s, adicionaFeature(f))
        return { ok: true, sketch: sk.id, id, ...resumo(r) }
      } catch (e) {
        s.desfaz()
        throw e
      }
    },
  },
]
