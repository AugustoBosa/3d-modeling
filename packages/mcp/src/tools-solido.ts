// Tools MCP de features de sólido (headless): extrudar, revolver, primitivas, booleana, shell, furo, padrão, espelho,
// chanfro e edição/remoção de features. Cada tool que cria feature monta o objeto, executa pelo core e, se a regeneração
// falha, executaChecando desfaz e lança Error com causa + correção.
import { z } from 'zod'
import { adicionaFeature, editaFeature, idLivre, removeFeature } from '@3dm/core/features'
import type { Operacao } from '@3dm/core/features'
import type { Feature } from '@3dm/core/doc'
import { executaChecando, resumo } from './modelo.ts'
import type { Sessao } from './sessao.ts'
import type { Tool } from './tool.ts'

const Num = z.union([z.number(), z.string()])
const Vec2 = z.tuple([Num, Num])
const Vec3 = z.tuple([Num, Num, Num])
const Plano = z.object({
  origem: Vec3.describe('origem do plano, em mm'),
  normal: Vec3.describe('normal do plano'),
  eixoX: Vec3.describe('direção do eixo X local do plano'),
})
const OPERACAO = z.enum(['nova', 'unir', 'subtrair', 'interseccao'])
  .describe('nova = corpo separado; unir, subtrair ou interseccao = combina com o alvo')
const ALVO = z.string().optional().describe('corpo afetado; omitido = o corpo mais recente')

type Numero = number | string
type V2 = [Numero, Numero]
type V3 = [Numero, Numero, Numero]
type PlanoIn = { origem: V3; normal: V3; eixoX: V3 }

const PRIMITIVAS = {
  caixa: { prefixo: 'cx', dim: 3, forma: '[x, y, z]' },
  cilindro: { prefixo: 'ci', dim: 2, forma: '[raio, altura]' },
  esfera: { prefixo: 'esf', dim: 1, forma: '[raio]' },
  cone: { prefixo: 'co', dim: 3, forma: '[raioBase, raioTopo, altura]' },
  toro: { prefixo: 'to', dim: 2, forma: '[raioMaior, raioMenor]' },
} as const

const semVazios = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))

/** Monta a feature com id livre, executa pelo core e devolve o estado das features e dos corpos. */
function cria(s: Sessao, prefixo: string, tipo: string, campos: Record<string, unknown>) {
  const id = idLivre(s.doc, prefixo)
  const r = executaChecando(s, adicionaFeature({ ...semVazios(campos), id, tipo } as Feature))
  return { ok: true, id, ...resumo(r) }
}

export const toolsSolido: Tool[] = [
  {
    nome: 'extrudar',
    descricao: 'Extrude um sketch fechado em um sólido. Distância em mm (aceita expressão de parâmetro). Modo normal, simetrica, duas ou ate. Pode ter chanfro ou fillet na borda. Desfazível.',
    entrada: {
      sketch: z.string().describe('id do sketch, ex.: sk1'),
      distancia: Num.describe('altura da extrusão em mm, ou expressão de parâmetro'),
      modo: z.enum(['normal', 'simetrica', 'duas', 'ate']).optional().describe('normal = de 0 a distancia; simetrica = ±distancia/2; duas = distancia para cima e distancia2 para baixo; ate = até um plano. Padrão: normal.'),
      distancia2: Num.optional().describe('distância para baixo em mm, só no modo duas'),
      operacao: OPERACAO.optional(),
      alvo: ALVO,
      perfis: z.array(z.number().int()).optional().describe('índices dos perfis do sketch; omitido = todos'),
      taper: Num.optional().describe('ângulo de saída em graus; positivo afunila para o topo'),
      borda: z.object({
        modo: z.enum(['chanfro', 'fillet']).describe('chanfro ou arredondamento'),
        tamanho: Num.describe('tamanho do chanfro ou raio do fillet, em mm'),
        onde: z.enum(['topo', 'base', 'ambas']).describe('em qual borda aplicar'),
      }).optional().describe('chanfro ou fillet na borda do extrude'),
    },
    exemplo: { sketch: 'sk1', distancia: 10 },
    executa(s: Sessao, a: { sketch: string; distancia: Numero; modo?: string; distancia2?: Numero; operacao?: Operacao; alvo?: string; perfis?: number[]; taper?: Numero; borda?: { modo: string; tamanho: Numero; onde: string } }) {
      return cria(s, 'ex', 'extrude', { ...a })
    },
  },
  {
    nome: 'revolver',
    descricao: 'Gira um sketch fechado em torno de um eixo do plano do sketch, em graus (padrão 360). Desfazível.',
    entrada: {
      sketch: z.string().describe('id do sketch, ex.: sk1'),
      eixo: z.object({
        ponto: Vec2.describe('ponto do eixo no plano local do sketch, em mm'),
        dir: Vec2.describe('direção do eixo no plano local do sketch'),
      }).describe('eixo de revolução'),
      graus: Num.optional().describe('ângulo da revolução em graus. Padrão: 360.'),
      simetrico: z.boolean().optional().describe('true = revolve nos dois sentidos a partir do eixo'),
      operacao: OPERACAO.optional(),
      alvo: ALVO,
      perfis: z.array(z.number().int()).optional().describe('índices dos perfis do sketch; omitido = todos'),
    },
    exemplo: { sketch: 'sk1', eixo: { ponto: [0, 0], dir: [1, 0] } },
    executa(s: Sessao, a: { sketch: string; eixo: { ponto: V2; dir: V2 }; graus?: Numero; simetrico?: boolean; operacao?: Operacao; alvo?: string; perfis?: number[] }) {
      return cria(s, 'rv', 'revolve', { ...a, graus: a.graus ?? 360 })
    },
  },
  {
    nome: 'primitiva',
    descricao: 'Cria uma primitiva sólida: caixa, cilindro, esfera, cone ou toro. dim em mm: caixa [x,y,z]; cilindro [raio,altura]; esfera [raio]; cone [raioBase,raioTopo,altura]; toro [raioMaior,raioMenor]. pos é o centro da base (caixa, cilindro, cone) ou o centro (esfera, toro). Desfazível.',
    entrada: {
      tipo: z.enum(['caixa', 'cilindro', 'esfera', 'cone', 'toro']).describe('tipo da primitiva'),
      dim: z.array(Num).describe('dimensões em mm, na ordem indicada na descrição da tool'),
      pos: Vec3.optional().describe('posição em mm. Padrão: [0, 0, 0].'),
      operacao: OPERACAO.optional(),
      alvo: ALVO,
    },
    exemplo: { tipo: 'caixa', dim: [10, 20, 30] },
    executa(s: Sessao, a: { tipo: keyof typeof PRIMITIVAS; dim: Numero[]; pos?: V3; operacao?: Operacao; alvo?: string }) {
      const p = PRIMITIVAS[a.tipo]
      if (a.dim.length !== p.dim) {
        throw new Error(`primitiva "${a.tipo}" precisa de dim=${p.forma} (${p.dim} valores), recebeu ${a.dim.length}. Correção: ajuste o campo dim.`)
      }
      return cria(s, p.prefixo, a.tipo, { dim: a.dim, pos: a.pos ?? [0, 0, 0], operacao: a.operacao, alvo: a.alvo })
    },
  },
  {
    nome: 'booleana',
    descricao: 'Combina corpos: unir, subtrair ou interseccao. O resultado fica no corpo alvo; as ferramentas são consumidas (a não ser que manter seja true). Desfazível.',
    entrada: {
      op: z.enum(['unir', 'subtrair', 'interseccao']).describe('operação booleana'),
      alvo: z.string().describe('corpo que recebe o resultado'),
      ferramentas: z.array(z.string()).describe('corpos que entram na operação, ex.: ["ci1"]'),
      manter: z.boolean().optional().describe('true = mantém as ferramentas além do resultado'),
    },
    exemplo: { op: 'subtrair', alvo: 'cx1', ferramentas: ['ci1'] },
    executa(s: Sessao, a: { op: 'unir' | 'subtrair' | 'interseccao'; alvo: string; ferramentas: string[]; manter?: boolean }) {
      return cria(s, 'bo', 'booleana', { ...a })
    },
  },
  {
    nome: 'shell',
    descricao: 'Oca o corpo com paredes de espessura em mm. abrir define as faces abertas: topo (+Z) e/ou base (-Z). Desfazível.',
    entrada: {
      alvo: ALVO,
      espessura: Num.describe('espessura da parede em mm'),
      abrir: z.array(z.enum(['topo', 'base'])).describe('faces abertas; lista vazia = oco fechado'),
    },
    exemplo: { alvo: 'cx1', espessura: 2, abrir: ['topo'] },
    executa(s: Sessao, a: { alvo?: string; espessura: Numero; abrir: ('topo' | 'base')[] }) {
      return cria(s, 'sh', 'shell', { ...a })
    },
  },
  {
    nome: 'furo',
    descricao: 'Faz furos numa face. plano: origem é um ponto na face, normal aponta para fora da face; posicoes são coordenadas no plano local, em mm. Diâmetro pelo preset (M2 a M8) ou por diametro. Passante sem profundidade. Desfazível.',
    entrada: {
      plano: Plano.describe('plano da face onde o furo entra, no sentido -normal'),
      posicoes: z.array(Vec2).describe('centros dos furos no plano local, em mm'),
      tipoFuro: z.enum(['simples', 'escareado', 'rebaixado']).optional().describe('tipo do furo. Padrão: simples.'),
      preset: z.enum(['M2', 'M3', 'M4', 'M5', 'M6', 'M8']).optional().describe('rosca métrica; define o diâmetro pela tabela'),
      diametro: Num.optional().describe('diâmetro em mm, se não houver preset'),
      inserto: z.boolean().optional().describe('true = furo para inserto roscado de latão'),
      profundidade: Num.optional().describe('profundidade em mm. Omitido = passante.'),
      alvo: ALVO,
    },
    exemplo: { plano: { origem: [0, 0, 30], normal: [0, 0, 1], eixoX: [1, 0, 0] }, posicoes: [[0, 0]], preset: 'M3', alvo: 'cx1' },
    executa(s: Sessao, a: { plano: PlanoIn; posicoes: V2[]; tipoFuro?: string; preset?: string; diametro?: Numero; inserto?: boolean; profundidade?: Numero; alvo?: string }) {
      return cria(s, 'fu', 'furo', { ...a, tipoFuro: a.tipoFuro ?? 'simples' })
    },
  },
  {
    nome: 'padrao',
    descricao: 'Repete um corpo: linear (n cópias a cada passo mm ao longo de dir) ou circular (n cópias em graus totais em torno de um eixo). Desfazível.',
    entrada: {
      alvo: ALVO,
      modo: z.enum(['linear', 'circular']).describe('linear ou circular'),
      n: Num.describe('número de cópias, incluindo a original'),
      dir: Vec3.optional().describe('direção do padrão linear'),
      passo: Num.optional().describe('distância entre cópias em mm, no padrão linear'),
      eixo: z.object({ ponto: Vec3, dir: Vec3 }).optional().describe('eixo do padrão circular, em mm'),
      graus: Num.optional().describe('ângulo total do padrão circular, em graus'),
    },
    exemplo: { alvo: 'cx1', modo: 'linear', n: 3, dir: [1, 0, 0], passo: 10 },
    executa(s: Sessao, a: { alvo?: string; modo: 'linear' | 'circular'; n: Numero; dir?: V3; passo?: Numero; eixo?: { ponto: V3; dir: V3 }; graus?: Numero }) {
      return cria(s, 'pa', 'padrao', { ...a })
    },
  },
  {
    nome: 'espelhar',
    descricao: 'Espelha um corpo em relação a um plano. Por padrão mantém o original e une o espelhado. Desfazível.',
    entrada: {
      alvo: ALVO,
      plano: Plano.describe('plano de espelho (origem e normal, em mm)'),
      manter: z.boolean().optional().describe('true (padrão) = mantém o original e une o espelhado'),
    },
    exemplo: { alvo: 'cx1', plano: { origem: [0, 0, 0], normal: [1, 0, 0], eixoX: [0, 1, 0] } },
    executa(s: Sessao, a: { alvo?: string; plano: PlanoIn; manter?: boolean }) {
      return cria(s, 'esp', 'espelho', { ...a })
    },
  },
  {
    nome: 'chanfro',
    descricao: 'Muda a borda de uma feature extrude para chanfro ou fillet, com tamanho em mm. Desfazível.',
    entrada: {
      feature: z.string().describe('id da feature extrude, ex.: ex1'),
      tamanho: Num.describe('tamanho do chanfro ou raio do fillet, em mm'),
      modo: z.enum(['chanfro', 'fillet']).optional().describe('chanfro ou fillet. Padrão: chanfro.'),
      onde: z.enum(['topo', 'base', 'ambas']).optional().describe('em qual borda aplicar. Padrão: topo.'),
    },
    exemplo: { feature: 'ex1', tamanho: 1 },
    executa(s: Sessao, a: { feature: string; tamanho: Numero; modo?: 'chanfro' | 'fillet'; onde?: 'topo' | 'base' | 'ambas' }) {
      const f = s.doc.features.find((x) => x.id === a.feature)
      if (!f || f.tipo !== 'extrude') {
        throw new Error(`A feature "${a.feature}" ${f ? 'não é um extrude' : 'não existe'}. Chanfro e fillet de borda valem para features extrude; use features_listar para ver os ids. Correção: informe o id de um extrude.`)
      }
      const borda = { modo: a.modo ?? 'chanfro', tamanho: a.tamanho, onde: a.onde ?? 'topo' }
      const r = executaChecando(s, editaFeature(a.feature, { borda }))
      return { ok: true, id: a.feature, ...resumo(r) }
    },
  },
  {
    nome: 'feature_editar',
    descricao: 'Altera campos de uma feature existente (ex.: distancia de um extrude). Campo com valor null é removido. Desfazível.',
    entrada: {
      id: z.string().describe('id da feature, ex.: ex1'),
      campos: z.record(z.string(), z.unknown()).describe('campos a alterar, ex.: {"distancia": 15}; null remove o campo'),
    },
    exemplo: { id: 'ex1', campos: { distancia: 15 } },
    executa(s: Sessao, a: { id: string; campos: Record<string, unknown> }) {
      const patch = Object.fromEntries(Object.entries(a.campos).map(([k, v]) => [k, v === null ? undefined : v]))
      const r = executaChecando(s, editaFeature(a.id, patch))
      return { ok: true, id: a.id, ...resumo(r) }
    },
  },
  {
    nome: 'feature_apagar',
    descricao: 'Remove uma feature do histórico. Desfazível.',
    entrada: {
      id: z.string().describe('id da feature, ex.: ex1'),
    },
    exemplo: { id: 'ex1' },
    executa(s: Sessao, a: { id: string }) {
      const r = executaChecando(s, removeFeature(a.id))
      return { ok: true, removida: a.id, ...resumo(r) }
    },
  },
]
