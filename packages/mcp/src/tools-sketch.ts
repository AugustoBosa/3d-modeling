// Tools MCP de sketch (headless): criar sketch, adicionar entidades, restringir e fillet 2D.
// Cada chamada vira UM comando de undo (editaSketch); o solver resolve e grava as coordenadas no documento.
import { z } from 'zod'
import { aplicaAdicao, criarSketch, editaSketch, ehDimensao, fillet, sketchResolvido } from '@3dm/core/sketch'
import type { Adicao, EntSk, RestSk, TipoRestSk } from '@3dm/core/sketch'
import type { Sessao } from './sessao.ts'
import type { Tool } from './tool.ts'

const TIPOS_REST = [
  'coincidente', 'horizontal', 'vertical', 'paralela', 'perpendicular', 'tangente',
  'igual', 'concentrica', 'pontoNaCurva', 'simetria', 'fixa',
  'distancia', 'distanciaH', 'distanciaV', 'raio', 'diametro', 'angulo',
] as const satisfies readonly TipoRestSk[]

const itemEntidade = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('ponto'), x: z.number().describe('X em mm'), y: z.number().describe('Y em mm') }).describe('ponto isolado'),
  z.object({
    tipo: z.literal('linha'), x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number(),
    construcao: z.boolean().optional().describe('true = linha de construção (não gera perfil)'),
  }).describe('segmento de reta entre dois pontos'),
  z.object({
    tipo: z.literal('retangulo'), x: z.number().describe('X do canto inferior esquerdo'), y: z.number().describe('Y do canto inferior esquerdo'),
    largura: z.number(), altura: z.number(),
  }).describe('retângulo: 4 pontos, 4 linhas e restrições horizontal/vertical'),
  z.object({
    tipo: z.literal('circulo'), cx: z.number().describe('X do centro'), cy: z.number().describe('Y do centro'), r: z.number().describe('raio'),
  }).describe('círculo'),
  z.object({
    tipo: z.literal('arco'), cx: z.number(), cy: z.number(), r: z.number(),
    de: z.number().describe('ângulo inicial em graus'), ate: z.number().describe('ângulo final em graus; o arco vai no sentido anti-horário de "de" até "ate"'),
  }).describe('arco de círculo'),
  z.object({
    tipo: z.literal('poligono'), cx: z.number(), cy: z.number(), r: z.number().describe('raio dos vértices'),
    lados: z.number().int().min(3).describe('número de lados (>= 3); o primeiro vértice fica no ângulo 0'),
  }).describe('polígono regular inscrito em círculo'),
])
type ItemEntidade = z.infer<typeof itemEntidade>

const itemRestricao = z.object({
  tipo: z.enum(TIPOS_REST).describe('tipo da restrição'),
  e: z.array(z.string()).describe('ids das entidades, conforme o tipo: coincidente [ponto, ponto]; horizontal/vertical [linha] ou [ponto, ponto]; paralela/perpendicular/angulo [linha, linha]; tangente [linha, curva] ou [curva, curva]; igual [linha, linha] ou [curva, curva]; concentrica [ponto|círculo|arco, ponto|círculo|arco]; pontoNaCurva [ponto, linha|círculo|arco]; simetria [ponto, ponto, linha-eixo]; fixa [ponto]; distancia/distanciaH/distanciaV [ponto, ponto] ou [linha]; raio/diametro [círculo|arco]'),
  expr: z.union([z.string(), z.number()]).optional().describe('valor da cota em mm (ou graus, no angulo); obrigatório nas dimensões, proibido nas demais'),
  ref: z.boolean().optional().describe('true = cota de referência (só mostra o valor, não dirige a geometria)'),
  xy: z.tuple([z.number(), z.number()]).optional().describe('alvo [x, y] da restrição fixa; padrão: posição atual'),
}).describe('restrição do sketch')
type ItemRestricao = z.infer<typeof itemRestricao>

const estadoDoSketch = (s: Sessao, sketch: string) => {
  const r = sketchResolvido(s.doc, sketch)
  if (!r) throw new Error(`Sketch "${sketch}" não existe no documento.`)
  return { estado: r.info.estado, dof: r.info.dof, perfis: r.perfis.perfis.length }
}

/** Converte os itens de sketch_adicionar em entidades com ids locais '@n' (únicos no lote). */
function montaAdicao(entidades: ItemEntidade[]): { adicao: Adicao; itens: { tipo: string; locais: string[] }[] } {
  let n = 0
  const loc = () => `@${++n}`
  const ents: EntSk[] = []
  const rests: RestSk[] = []
  const itens: { tipo: string; locais: string[] }[] = []

  for (const it of entidades) {
    const ini = ents.length
    const ids: string[] = []
    const ponto = (x: number, y: number): string => {
      const id = loc()
      ents.push({ id, tipo: 'ponto', x, y })
      return id
    }
    const linha = (a: string, b: string, construcao?: boolean): string => {
      const id = loc()
      ents.push({ id, tipo: 'linha', a, b, ...(construcao ? { construcao } : {}) })
      return id
    }
    if (it.tipo === 'ponto') {
      ponto(it.x, it.y)
    } else if (it.tipo === 'linha') {
      linha(ponto(it.x1, it.y1), ponto(it.x2, it.y2), it.construcao)
    } else if (it.tipo === 'retangulo') {
      const { x, y, largura: l, altura: h } = it
      const p1 = ponto(x, y), p2 = ponto(x + l, y), p3 = ponto(x + l, y + h), p4 = ponto(x, y + h)
      const base = linha(p1, p2), dir = linha(p2, p3), topo = linha(p3, p4), esq = linha(p4, p1)
      for (const [tipo, e] of [['horizontal', [base, topo]], ['vertical', [dir, esq]]] as const) {
        for (const l1 of e) rests.push({ id: loc(), tipo, e: [l1] })
      }
    } else if (it.tipo === 'circulo') {
      const c = ponto(it.cx, it.cy)
      ents.push({ id: loc(), tipo: 'circulo', c, r: it.r })
    } else if (it.tipo === 'arco') {
      const rad = (g: number) => (g * Math.PI) / 180
      const c = ponto(it.cx, it.cy)
      const a = ponto(it.cx + it.r * Math.cos(rad(it.de)), it.cy + it.r * Math.sin(rad(it.de)))
      const b = ponto(it.cx + it.r * Math.cos(rad(it.ate)), it.cy + it.r * Math.sin(rad(it.ate)))
      ents.push({ id: loc(), tipo: 'arco', c, a, b })
    } else {
      const pts: string[] = []
      for (let i = 0; i < it.lados; i++) {
        const t = (2 * Math.PI * i) / it.lados
        pts.push(ponto(it.cx + it.r * Math.cos(t), it.cy + it.r * Math.sin(t)))
      }
      pts.forEach((p, i) => linha(p, pts[(i + 1) % pts.length]))
    }
    for (let i = ini; i < ents.length; i++) ids.push(ents[i].id)
    itens.push({ tipo: it.tipo, locais: ids })
  }
  return { adicao: { entidades: ents, restricoes: rests }, itens }
}

/** Converte uma restrição do usuário em RestSk com id local, validando expr conforme o tipo. */
function montaRestricao(r: ItemRestricao, i: number): RestSk {
  const dim = ehDimensao(r.tipo)
  if (dim && r.expr === undefined) {
    throw new Error(`A restrição "${r.tipo}" precisa de expr (valor ou expressão, ex.: "80" ou "L/2"). Informe o valor da cota em mm.`)
  }
  if (!dim && r.expr !== undefined) {
    throw new Error(`A restrição "${r.tipo}" não usa expr. Remova o campo expr; só as cotas (distancia, raio, angulo...) têm valor.`)
  }
  const out: RestSk = { id: `@r${i + 1}`, tipo: r.tipo, e: r.e }
  if (r.expr !== undefined) out.expr = String(r.expr)
  if (r.ref) out.ref = true
  if (r.xy) out.xy = r.xy
  return out
}

export const toolsSketch: Tool[] = [
  {
    nome: 'sketch_criar',
    descricao: 'Cria um sketch vazio num plano de trabalho (XY, XZ ou YZ), com a origem p0 fixa. Devolve o id do sketch (ex.: sk1). Desfazível.',
    entrada: {
      plano: z.enum(['XY', 'XZ', 'YZ']).describe('plano de trabalho'),
      offset: z.number().optional().describe('distância em mm ao longo da normal do plano. Padrão: 0.'),
    },
    exemplo: { plano: 'XY' },
    executa(s: Sessao, { plano, offset }: { plano: 'XY' | 'XZ' | 'YZ'; offset?: number }) {
      const c = criarSketch({ base: plano, offset: offset ?? 0 })
      s.executa(c)
      return { ok: true, sketch: c.id }
    },
  },
  {
    nome: 'sketch_adicionar',
    descricao: 'Adiciona entidades a um sketch numa única ação desfazível. Tipos: ponto, linha (x1,y1,x2,y2), retangulo (x,y,largura,altura; com horizontal/vertical), circulo (cx,cy,r), arco (cx,cy,r,de,ate em graus, anti-horário), poligono (cx,cy,r,lados). Devolve os ids criados por item.',
    entrada: {
      sketch: z.string().describe('id do sketch, ex.: sk1'),
      entidades: z.array(itemEntidade).describe('entidades a criar, na ordem'),
    },
    exemplo: { sketch: 'sk1', entidades: [{ tipo: 'retangulo', x: 0, y: 0, largura: 80, altura: 50 }] },
    executa(s: Sessao, { sketch, entidades }: { sketch: string; entidades: ItemEntidade[] }) {
      const { adicao, itens } = montaAdicao(entidades)
      const mapa = new Map<string, string>()
      s.executa(editaSketch('ADICIONAR', sketch, (sk) => { aplicaAdicao(sk, adicao, mapa) }))
      const real = (l: string) => mapa.get(l) ?? ''
      return {
        ok: true,
        itens: itens.map((it) => ({ tipo: it.tipo, ids: it.locais.map(real) })),
        ...estadoDoSketch(s, sketch),
      }
    },
  },
  {
    nome: 'sketch_restringir',
    descricao: 'Aplica restrições a um sketch numa única ação desfazível. Cotas (distancia, distanciaH, distanciaV, raio, diametro, angulo) exigem expr; as demais não aceitam expr. Tipos e entidades em `e`: coincidente [ponto, ponto]; horizontal/vertical [linha]; paralela/perpendicular [linha, linha]; tangente [linha, curva] ou [curva, curva]; igual [linha, linha] ou [curva, curva]; concentrica [centros]; pontoNaCurva [ponto, linha|curva]; simetria [ponto, ponto, linha-eixo]; fixa [ponto] (+xy); distancia [ponto, ponto] ou [linha]; raio/diametro [círculo|arco]; angulo [linha, linha] (graus).',
    entrada: {
      sketch: z.string().describe('id do sketch, ex.: sk1'),
      restricoes: z.array(itemRestricao).describe('restrições a aplicar'),
    },
    exemplo: { sketch: 'sk1', restricoes: [{ tipo: 'distancia', e: ['p1', 'p2'], expr: '80' }] },
    executa(s: Sessao, { sketch, restricoes }: { sketch: string; restricoes: ItemRestricao[] }) {
      const rs = restricoes.map(montaRestricao)
      s.executa(editaSketch('RESTRINGIR', sketch, (sk) => { aplicaAdicao(sk, { entidades: [], restricoes: rs }) }))
      return { ok: true, restricoes: rs.length, ...estadoDoSketch(s, sketch) }
    },
  },
  {
    nome: 'fillet_sketch',
    descricao: 'Arredonda o canto entre duas linhas do sketch com um arco de raio dado (mm); as linhas devem compartilhar um ponto ou se cruzar no prolongamento. Raio 0 une as linhas no canto. Desfazível. Devolve o id do arco criado.',
    entrada: {
      sketch: z.string().describe('id do sketch, ex.: sk1'),
      linha1: z.string().describe('id da primeira linha do canto'),
      linha2: z.string().describe('id da segunda linha do canto'),
      raio: z.number().min(0).describe('raio do arco em mm (0 = canto vivo)'),
    },
    exemplo: { sketch: 'sk1', linha1: 'l1', linha2: 'l4', raio: 5 },
    executa(s: Sessao, { sketch, linha1, linha2, raio }: { sketch: string; linha1: string; linha2: string; raio: number }) {
      let arco = ''
      s.executa(editaSketch('FILLET', sketch, (sk) => { arco = fillet(sk, linha1, linha2, raio) }))
      return { ok: true, arco, ...estadoDoSketch(s, sketch) }
    },
  },
]
