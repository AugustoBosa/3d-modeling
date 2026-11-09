// Tools MCP extras (headless): consulta e edição do sketch, supressão e ordem de features, marcador, parâmetros e medição.
// sketch_editar e medir validam cada operação com z.discriminatedUnion dentro de executa; o `entrada` exposto ao MCP
// é um shape plano (z.ZodRawShape), como em todas as tools.
import { z } from 'zod'
import { moveFeature, moveMarcador, removeParametro, renomeiaParametro, suprimeFeature } from '@3dm/core/features'
import { alternaConstrucao, aparar, apagar, copiar, editaExprCota, editaSketch, escalar, espelhar, estender, girar, mover, offset, removeRestricao, sketchResolvido } from '@3dm/core/sketch'
import { angulo, areaFace, arredonda, distancia, raioCirculo, volumeMalha } from '@3dm/core/medir'
import { executaChecando, regenera, resumo } from './modelo.ts'
import type { Sessao } from './sessao.ts'
import type { Tool } from './tool.ts'

const V3 = z.tuple([z.number(), z.number(), z.number()])
const S = { sketch: z.string() }
const IDS = z.array(z.string()).describe('ids das entidades, ex.: ["l1", "p2"]')

const OPERACOES = z.discriminatedUnion('operacao', [
  z.object({ ...S, operacao: z.literal('mover'), ids: IDS, dx: z.number(), dy: z.number() }),
  z.object({ ...S, operacao: z.literal('copiar'), ids: IDS, dx: z.number(), dy: z.number() }),
  z.object({ ...S, operacao: z.literal('girar'), ids: IDS, cx: z.number(), cy: z.number(), graus: z.number() }),
  z.object({ ...S, operacao: z.literal('escalar'), ids: IDS, cx: z.number(), cy: z.number(), fator: z.number() }),
  z.object({ ...S, operacao: z.literal('espelhar'), ids: IDS, ax: z.number(), ay: z.number(), bx: z.number(), by: z.number(), manter: z.boolean().optional() }),
  z.object({ ...S, operacao: z.literal('apagar'), ids: IDS }),
  z.object({ ...S, operacao: z.literal('construcao'), ids: IDS }),
  z.object({ ...S, operacao: z.literal('aparar'), alvo: z.string(), x: z.number(), y: z.number() }),
  z.object({ ...S, operacao: z.literal('estender'), alvo: z.string(), x: z.number(), y: z.number() }),
  z.object({ ...S, operacao: z.literal('offset'), alvo: z.string(), distancia: z.number(), x: z.number(), y: z.number() }),
  z.object({ ...S, operacao: z.literal('cota'), restricao: z.string(), expr: z.union([z.string(), z.number()]) }),
  z.object({ ...S, operacao: z.literal('remover_restricao'), restricao: z.string() }),
])

const MEDIDAS = z.discriminatedUnion('modo', [
  z.object({ modo: z.literal('distancia'), a: V3, b: V3 }),
  z.object({ modo: z.literal('angulo'), a: V3, vertice: V3, b: V3 }),
  z.object({ modo: z.literal('raio'), pontos: z.array(V3).min(3) }),
  z.object({ modo: z.literal('volume'), corpo: z.string() }),
  z.object({ modo: z.literal('area_face'), corpo: z.string(), triangulo: z.number().int().min(0) }),
])

/** Valida os argumentos com o schema; erro do zod vira mensagem em pt-BR com os campos. */
function valida<T extends z.ZodType>(schema: T, args: unknown, nome: string): z.output<T> {
  const r = schema.safeParse(args)
  if (r.success) return r.data
  const campos = [...new Set(r.error.issues.map((i) => i.path.join('.') || 'operação'))]
  throw new Error(`Campos inválidos em ${nome}: ${campos.join(', ')}. Correção: confira os campos exigidos por cada operação na descrição da tool.`)
}

function sketchOuErro(s: Sessao, id: string) {
  const r = sketchResolvido(s.doc, id)
  if (!r) throw new Error(`Sketch "${id}" não existe no documento. Correção: use o id de um sketch (ex.: sk1).`)
  return r
}

function corpoDe(s: Sessao, id: string) {
  const corpos = regenera(s).corpos
  const m = corpos.get(id)
  if (!m) throw new Error(`Corpo "${id}" não existe. Corpos: ${[...corpos.keys()].join(', ') || 'nenhum'}. Correção: use um dos corpos listados.`)
  return m
}

export const toolsExtra: Tool[] = [
  {
    nome: 'sketch_estado',
    descricao: 'Lê o estado de um sketch sem alterar nada: estado (subdefinido, definido ou conflito), graus de liberdade (dof), restrições culpadas do conflito, erros de cota, número de perfis, pontas soltas e autointerseções, com entidades e restrições.',
    entrada: {
      sketch: z.string().describe('id do sketch, ex.: sk1'),
    },
    exemplo: { sketch: 'sk1' },
    executa(s: Sessao, { sketch }: { sketch: string }) {
      const { sk, info, perfis } = sketchOuErro(s, sketch)
      return {
        estado: info.estado,
        dof: info.dof,
        culpadas: info.culpadas,
        erros: info.erros,
        perfis: perfis.perfis.length,
        pontasSoltas: perfis.pontasSoltas.length,
        autointersecoes: perfis.autointersecoes.length,
        entidades: sk.entidades,
        restricoes: sk.restricoes.map(({ id, tipo, e, expr, ref }) => ({ id, tipo, e, expr, ref })),
      }
    },
  },
  {
    nome: 'sketch_editar',
    descricao: 'Edita um sketch numa operação desfazível. mover/copiar {ids,dx,dy}; girar {ids,cx,cy,graus}; escalar {ids,cx,cy,fator}; espelhar {ids,ax,ay,bx,by,manter?} (manter padrão true); apagar {ids}; construcao {ids} (alterna linha de construção); aparar/estender {alvo,x,y}; offset {alvo,distancia,x,y} (x,y = lado); cota {restricao,expr}; remover_restricao {restricao}. Devolve ids criados (copiar, espelhar, offset), estado, dof e perfis.',
    entrada: {
      sketch: z.string().describe('id do sketch, ex.: sk1'),
      operacao: z.enum(['mover', 'copiar', 'girar', 'escalar', 'espelhar', 'apagar', 'construcao', 'aparar', 'estender', 'offset', 'cota', 'remover_restricao']).describe('operação a aplicar'),
      ids: IDS.optional(),
      dx: z.number().optional().describe('deslocamento em X, em mm'),
      dy: z.number().optional().describe('deslocamento em Y, em mm'),
      cx: z.number().optional().describe('X do centro'),
      cy: z.number().optional().describe('Y do centro'),
      graus: z.number().optional().describe('ângulo em graus (girar)'),
      fator: z.number().optional().describe('fator de escala (escalar)'),
      ax: z.number().optional().describe('X do primeiro ponto do eixo (espelhar)'),
      ay: z.number().optional().describe('Y do primeiro ponto do eixo (espelhar)'),
      bx: z.number().optional().describe('X do segundo ponto do eixo (espelhar)'),
      by: z.number().optional().describe('Y do segundo ponto do eixo (espelhar)'),
      manter: z.boolean().optional().describe('espelhar: true (padrão) mantém o original'),
      alvo: z.string().optional().describe('id da entidade (aparar, estender, offset)'),
      x: z.number().optional().describe('X do ponto de clique (aparar, estender) ou do lado (offset)'),
      y: z.number().optional().describe('Y do ponto de clique (aparar, estender) ou do lado (offset)'),
      distancia: z.number().optional().describe('distância do offset em mm'),
      restricao: z.string().optional().describe('id da restrição (cota, remover_restricao)'),
      expr: z.union([z.string(), z.number()]).optional().describe('novo valor da cota, em mm ou graus'),
    },
    exemplo: { sketch: 'sk1', operacao: 'mover', ids: ['l1'], dx: 10, dy: 0 },
    executa(s: Sessao, args: unknown) {
      const a = valida(OPERACOES, args, 'sketch_editar')
      let criados: string[] = []
      switch (a.operacao) {
        case 'mover':
          s.executa(editaSketch('MOVER', a.sketch, (sk) => mover(sk, a.ids, a.dx, a.dy), { prender: true })); break
        case 'copiar':
          s.executa(editaSketch('COPIAR', a.sketch, (sk) => { criados = copiar(sk, a.ids, a.dx, a.dy) })); break
        case 'girar':
          s.executa(editaSketch('GIRAR', a.sketch, (sk) => girar(sk, a.ids, { x: a.cx, y: a.cy }, a.graus), { prender: true })); break
        case 'escalar':
          s.executa(editaSketch('ESCALAR', a.sketch, (sk) => escalar(sk, a.ids, { x: a.cx, y: a.cy }, a.fator), { prender: true })); break
        case 'espelhar':
          s.executa(editaSketch('ESPELHAR', a.sketch, (sk) => { criados = espelhar(sk, a.ids, { x: a.ax, y: a.ay }, { x: a.bx, y: a.by }, a.manter ?? true) })); break
        case 'apagar':
          s.executa(editaSketch('APAGAR', a.sketch, (sk) => apagar(sk, a.ids))); break
        case 'construcao':
          s.executa(editaSketch('CONSTRUCAO', a.sketch, (sk) => alternaConstrucao(sk, a.ids))); break
        case 'aparar':
          s.executa(editaSketch('APARAR', a.sketch, (sk) => aparar(sk, a.alvo, { x: a.x, y: a.y }))); break
        case 'estender':
          s.executa(editaSketch('ESTENDER', a.sketch, (sk) => estender(sk, a.alvo, { x: a.x, y: a.y }))); break
        case 'offset':
          s.executa(editaSketch('OFFSET', a.sketch, (sk) => { criados = offset(sk, a.alvo, a.distancia, { x: a.x, y: a.y }) })); break
        case 'cota':
          s.executa(editaExprCota(a.sketch, a.restricao, String(a.expr))); break
        case 'remover_restricao':
          s.executa(removeRestricao(a.sketch, a.restricao)); break
      }
      const { info, perfis } = sketchOuErro(s, a.sketch)
      return {
        ok: true,
        ...(criados.length > 0 ? { ids: criados } : {}),
        estado: info.estado,
        dof: info.dof,
        perfis: perfis.perfis.length,
      }
    },
  },
  {
    nome: 'feature_suprimir',
    descricao: 'Suprime (suprimida = true, padrão) ou reativa (false) uma feature: a feature some da regeneração sem ser apagada. Desfazível.',
    entrada: {
      id: z.string().describe('id da feature, ex.: ex1'),
      suprimida: z.boolean().optional().describe('true (padrão) suprime; false reativa'),
    },
    exemplo: { id: 'ex1', suprimida: true },
    executa(s: Sessao, { id, suprimida }: { id: string; suprimida?: boolean }) {
      const r = executaChecando(s, suprimeFeature(id, suprimida ?? true))
      return { ok: true, ...resumo(r) }
    },
  },
  {
    nome: 'marcador_mover',
    descricao: 'Põe o marcador de histórico numa feature: as features depois dele ficam ocultas. id null mostra tudo. Desfazível.',
    entrada: {
      id: z.string().nullable().describe('id da feature onde fica o marcador, ou null para mostrar todas'),
    },
    exemplo: { id: 'ex1' },
    executa(s: Sessao, { id }: { id: string | null }) {
      const r = executaChecando(s, moveMarcador(id))
      return { ok: true, ...resumo(r) }
    },
  },
  {
    nome: 'feature_mover',
    descricao: 'Reordena uma feature no histórico, para a posição indice (0 = primeira). Desfazível.',
    entrada: {
      id: z.string().describe('id da feature, ex.: ex1'),
      indice: z.number().int().min(0).describe('nova posição na lista de features, a partir de 0'),
    },
    exemplo: { id: 'ex1', indice: 0 },
    executa(s: Sessao, { id, indice }: { id: string; indice: number }) {
      const r = executaChecando(s, moveFeature(id, indice))
      return { ok: true, ...resumo(r) }
    },
  },
  {
    nome: 'parametro_renomear',
    descricao: 'Renomeia um parâmetro e reescreve as expressões que o citam (parâmetros, cotas e campos das features). Desfazível.',
    entrada: {
      de: z.string().describe('nome atual do parâmetro, ex.: L'),
      para: z.string().describe('novo nome do parâmetro, ex.: C'),
    },
    exemplo: { de: 'L', para: 'C' },
    executa(s: Sessao, { de, para }: { de: string; para: string }) {
      s.executa(renomeiaParametro(de, para))
      return { ok: true, parametros: s.doc.parametros }
    },
  },
  {
    nome: 'parametro_remover',
    descricao: 'Remove um parâmetro. Recusa se alguma expressão de parâmetro, feature ou cota ainda cita o nome. Desfazível.',
    entrada: {
      nome: z.string().describe('nome do parâmetro, ex.: L'),
    },
    exemplo: { nome: 'L' },
    executa(s: Sessao, { nome }: { nome: string }) {
      const padrao = new RegExp(`\\b${nome.replace(/\W/g, '\\$&')}\\b`)
      const usos: string[] = []
      for (const f of s.doc.features) if (padrao.test(JSON.stringify(f))) usos.push(`feature ${f.id}`)
      for (const [k, p] of Object.entries(s.doc.parametros)) if (k !== nome && padrao.test(JSON.stringify(p))) usos.push(`parâmetro ${k}`)
      if (usos.length > 0) {
        throw new Error(`O parâmetro "${nome}" é usado por ${usos.join(', ')}. Correção: troque ou renomeie as expressões antes.`)
      }
      s.executa(removeParametro(nome))
      return { ok: true, parametros: s.doc.parametros }
    },
  },
  {
    nome: 'medir',
    descricao: 'Mede em mm ou graus. distancia {a,b}; angulo {a,vertice,b} (graus); raio {pontos} (mín. 3 pontos de um círculo); volume {corpo}; area_face {corpo,triangulo} (área da face plana que contém o triângulo). Pontos são [x,y,z].',
    entrada: {
      modo: z.enum(['distancia', 'angulo', 'raio', 'volume', 'area_face']).describe('o que medir'),
      a: V3.optional().describe('primeiro ponto [x,y,z] (distancia, angulo)'),
      b: V3.optional().describe('segundo ponto [x,y,z] (distancia, angulo)'),
      vertice: V3.optional().describe('vértice do ângulo [x,y,z]'),
      pontos: z.array(V3).optional().describe('pontos [x,y,z] sobre o círculo (raio), mín. 3'),
      corpo: z.string().optional().describe('id do corpo (volume, area_face), ex.: cx1'),
      triangulo: z.number().int().min(0).optional().describe('índice do triângulo da malha (area_face)'),
    },
    exemplo: { modo: 'distancia', a: [0, 0, 0], b: [3, 4, 12] },
    executa(s: Sessao, args: unknown) {
      const a = valida(MEDIDAS, args, 'medir')
      switch (a.modo) {
        case 'distancia':
          return { ok: true, modo: a.modo, valor: arredonda(distancia(a.a, a.b)), unidade: 'mm' }
        case 'angulo':
          return { ok: true, modo: a.modo, valor: arredonda(angulo(a.a, a.vertice, a.b)), unidade: 'graus' }
        case 'raio':
          return { ok: true, modo: a.modo, valor: arredonda(raioCirculo(a.pontos).raio), unidade: 'mm' }
        case 'volume':
          return { ok: true, modo: a.modo, valor: arredonda(volumeMalha(corpoDe(s, a.corpo))), unidade: 'mm³' }
        case 'area_face': {
          const m = corpoDe(s, a.corpo)
          const nt = m.triVerts.length / 3
          if (a.triangulo >= nt) throw new Error(`Triângulo ${a.triangulo} não existe no corpo "${a.corpo}" (ele tem ${nt}). Correção: use um índice de 0 a ${nt - 1}.`)
          return { ok: true, modo: a.modo, valor: arredonda(areaFace(m, a.triangulo)), unidade: 'mm²' }
        }
      }
    },
  },
]
