// Tools MCP: cada uma opera pela Sessao (headless hoje). `docsApi` gera o markdown de `docs://api` a partir de `tools`.
import { z } from 'zod'
import { definirImpressora } from '@3dm/core/doc'
import { definirParametroCompleto } from '@3dm/core/features'
import { impressoraPorId, impressoras } from '@3dm/core/printers'
import type { Tool } from './tool.ts'
import { toolsSketch } from './tools-sketch.ts'
import { toolsSolido } from './tools-solido.ts'
import { toolsModelo } from './tools-modelo.ts'
import { toolsExtra } from './tools-extra.ts'
import { toolsExtra2 } from './tools-extra2.ts'
import { toolsF3b } from './tools-f3b.ts'
import { toolsF3b2 } from './tools-f3b2.ts'
export type { Tool } from './tool.ts'


function checaImpressora(id: string) {
  if (!impressoraPorId(id)) throw new Error(`impressora desconhecida: ${id}. Use impressoras_listar.`)
}

const basicas: Tool[] = [
  {
    nome: 'projeto_novo',
    descricao: 'Cria um projeto vazio, descartando o atual e o histórico de desfazer.',
    entrada: {
      impressora: z.string().optional().describe('id da impressora (ver impressoras_listar). Padrão: a impressora padrão.'),
      nome: z.string().optional().describe('nome do projeto, usado no nome dos arquivos exportados.'),
    },
    exemplo: {},
    executa(s, { impressora, nome }: { impressora?: string; nome?: string }) {
      if (impressora !== undefined) checaImpressora(impressora)
      s.novo(impressora)
      if (nome !== undefined) s.doc.nome = nome
      return { ok: true, impressora: s.doc.impressora, nome: s.doc.nome }
    },
  },
  {
    nome: 'projeto_abrir',
    descricao: 'Abre um projeto .3dm.json da pasta do projeto, descartando o atual e o histórico de desfazer.',
    entrada: {
      caminho: z.string().describe('caminho do arquivo, relativo à pasta do projeto. A extensão .3dm.json é opcional.'),
    },
    exemplo: { caminho: 'peca.3dm.json' },
    executa(s, { caminho }: { caminho: string }) {
      s.abrir(caminho)
      return { ok: true, parametros: Object.keys(s.doc.parametros).length, features: s.doc.features.length }
    },
  },
  {
    nome: 'projeto_salvar',
    descricao: 'Grava o projeto atual como .3dm.json na pasta do projeto.',
    entrada: {
      caminho: z.string().optional().describe('caminho de destino, relativo à pasta do projeto. Sem ele, usa o último caminho ou o nome do projeto.'),
    },
    exemplo: { caminho: 'peca' },
    executa(s, { caminho }: { caminho?: string }) {
      return { ok: true, caminho: s.salvar(caminho) }
    },
  },
  {
    nome: 'impressora_definir',
    descricao: 'Troca a impressora ativa do projeto. Desfazível.',
    entrada: {
      id: z.string().describe('id da impressora (ver impressoras_listar).'),
    },
    exemplo: { id: 'bambu-p2s' },
    executa(s, { id }: { id: string }) {
      checaImpressora(id)
      s.executa(definirImpressora(id))
      return { ok: true, impressora: id }
    },
  },
  {
    nome: 'impressoras_listar',
    descricao: 'Lista as impressoras disponíveis e a ativa no projeto.',
    entrada: {},
    exemplo: {},
    executa(s) {
      return {
        impressoras: impressoras.map(p => ({ id: p.id, nome: p.nome, volume: p.volume, slicer: p.slicer })),
        ativa: s.doc.impressora,
      }
    },
  },
  {
    nome: 'parametro_definir',
    descricao: 'Cria ou altera um parâmetro do projeto com uma expressão. Desfazível.',
    entrada: {
      nome: z.string().describe('nome do parâmetro: letras, números e _, sem começar por número.'),
      expr: z.string().describe('expressão do valor, por exemplo "80" ou "L / 2".'),
    },
    exemplo: { nome: 'L', expr: '80' },
    executa(s, { nome, expr }: { nome: string; expr: string }) {
      s.executa(definirParametroCompleto(nome, { expr }))
      return { ok: true, parametros: s.doc.parametros }
    },
  },
  {
    nome: 'desfazer',
    descricao: 'Desfaz o último comando do projeto.',
    entrada: {},
    exemplo: {},
    executa(s) {
      const nome = s.desfaz()
      return { ok: nome !== null, comando: nome }
    },
  },
  {
    nome: 'refazer',
    descricao: 'Refaz o comando desfeito por último.',
    entrada: {},
    exemplo: {},
    executa(s) {
      const nome = s.refaz()
      return { ok: nome !== null, comando: nome }
    },
  },
  {
    nome: 'features_listar',
    descricao: 'Lista as features do projeto, na ordem em que foram criadas.',
    entrada: {},
    exemplo: {},
    executa(s) {
      return { features: s.doc.features.map(f => ({ id: f.id, tipo: f.tipo })) }
    },
  },
]

export const tools: Tool[] = [...basicas, ...toolsSketch, ...toolsSolido, ...toolsModelo, ...toolsExtra, ...toolsExtra2, ...toolsF3b, ...toolsF3b2]

/** Markdown compacto da API das tools (recurso `docs://api`). */
export function docsApi(): string {
  const linhas = [
    '# API das tools do 3d-modeling', '',
    'Convenções: mm e graus; campos numéricos aceitam número ou expressão de parâmetro (ex.: "L/2", defina antes com parametro_definir). Ids de feature/entidade vêm nas respostas (sk1, ex1, cx1...). Toda tool entra na pilha de desfazer. Feature que falha na regeneração é desfeita sozinha e o erro vem com causa + correção.',
    'Fluxo: parametro_definir -> sketch_criar -> sketch_adicionar -> extrudar -> shell/furo/... -> verificar_impressao -> captura -> exportar.',
    '',
  ]
  for (const t of tools) {
    const schema = z.toJSONSchema(z.object(t.entrada)) as {
      properties?: Record<string, { type?: string; description?: string }>
      required?: string[]
    }
    const props = schema.properties ?? {}
    const obrigatorios = new Set(schema.required ?? [])
    linhas.push(`## ${t.nome}`, '', t.descricao, '')
    const nomes = Object.keys(props)
    if (nomes.length === 0) linhas.push('Sem parâmetros.')
    for (const n of nomes) {
      const p = props[n]
      const situacao = obrigatorios.has(n) ? 'obrigatório' : 'opcional'
      linhas.push(`- \`${n}\`: ${p.type ?? 'any'}, ${situacao}${p.description ? ` — ${p.description}` : ''}`)
    }
    linhas.push('', 'Exemplo:', '```json', JSON.stringify(t.exemplo), '```', '')
  }
  return linhas.join('\n')
}
