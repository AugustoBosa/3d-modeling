// Tipos das features de geometria (PROJETO_BASE §6.6) e o contexto de execução. Valores numéricos já avaliados (mm / graus):
// a avaliação de expressões e a ligação com o tipo Feature do documento são da rodada 2.
import type { Manifold } from 'manifold-3d'
import type { Lixo, Perfil, PlanoLocal, Vec2, Vec3 } from '../kernel/tipos.ts'

export type Operacao = 'nova' | 'unir' | 'subtrair' | 'interseccao'

interface Base {
  id: string
  /** Corpo afetado por unir/subtrair/interseccao e pelas modificadoras. Omitido = o corpo mais recente. */
  alvo?: string
  suprimida?: boolean
}
/** Features que geram um sólido-ferramenta e o combinam com o alvo por `operacao` (padrão 'nova'). */
interface Geradora extends Base { operacao?: Operacao }

export interface BordaExtrude { modo: 'chanfro' | 'fillet'; tamanho: number; onde: 'topo' | 'base' | 'ambas' }

export interface FExtrude extends Geradora {
  tipo: 'extrude'
  sketch: string
  /** Índices dos perfis do sketch; omitido = todos. */
  perfis?: number[]
  distancia: number
  /** normal: de 0 a +distancia ao longo da normal · simetrica: ±distancia/2 · duas: +distancia e -distancia2 ·
   *  ate: da face do sketch até o plano `ate`, medido ao longo da normal do sketch (`distancia` é ignorada). */
  modo?: 'normal' | 'simetrica' | 'duas' | 'ate'
  distancia2?: number
  /** Plano de destino do modo 'ate'. */
  ate?: PlanoLocal
  /** Ângulo de saída em graus (positivo afunila para o topo). Aproximação: escala uniforme em torno do centro da bbox do perfil. */
  taper?: number
  borda?: BordaExtrude
}
export interface FRevolve extends Geradora {
  tipo: 'revolve'
  sketch: string
  perfis?: number[]
  /** Eixo no plano local do sketch: ponto + direção. O perfil fica de um lado do eixo. */
  eixo: { ponto: Vec2; dir: Vec2 }
  graus: number
  simetrico?: boolean
}
export interface FPrimitiva extends Geradora {
  tipo: 'caixa' | 'cilindro' | 'esfera' | 'cone' | 'toro'
  /** Posição do centro da base (caixa/cilindro/cone) ou do centro (esfera/toro), no mundo. */
  pos: Vec3
  /** caixa: [x,y,z] · cilindro: [r, altura] · esfera: [r] · cone: [rBase, rTopo, altura] · toro: [raioMaior, raioMenor]. */
  dim: number[]
}
export interface FBooleana extends Base {
  tipo: 'booleana'
  op: 'unir' | 'subtrair' | 'interseccao'
  /** Corpos-ferramenta; o resultado fica em `alvo` (obrigatório). */
  ferramentas: string[]
  manter?: boolean
}
export interface FShell extends Base {
  tipo: 'shell'
  espessura: number
  /** Faces abertas (prisma extrudado em +Z global): 'topo' = +Z, 'base' = -Z. Laterais não abertas. */
  abrir: ('topo' | 'base')[]
}
export type TipoFuro = 'simples' | 'escareado' | 'rebaixado'
export interface FFuro extends Base {
  tipo: 'furo'
  plano: PlanoLocal // origem = ponto na face; o furo entra no sentido -normal
  posicoes: Vec2[] // no plano local
  tipoFuro: TipoFuro
  /** Se `preset` (M2..M8), diâmetros vêm da tabela; senão `diametro` manda. */
  preset?: 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'M8'
  diametro?: number
  /** Furo para inserto roscado de latão (usa a tabela de insertos do preset). */
  inserto?: boolean
  /** Omitido = passante. */
  profundidade?: number
  /** Compensação de calibração somada ao diâmetro (F6). Padrão 0. */
  compensacao?: number
}
export interface FPadrao extends Base {
  tipo: 'padrao'
  /** linear: n cópias (incluindo a original) a cada `passo` mm ao longo de `dir` · circular: n cópias em `graus` totais em torno do eixo. */
  modo: 'linear' | 'circular'
  n: number
  dir?: Vec3
  passo?: number
  eixo?: { ponto: Vec3; dir: Vec3 }
  graus?: number
}
export interface FEspelho extends Base {
  tipo: 'espelho'
  plano: PlanoLocal // espelha em relação ao plano (origem + normal)
  /** Mantém o original e une o espelhado (padrão true). */
  manter?: boolean
}
export interface FCorte extends Base {
  tipo: 'corte'
  plano: PlanoLocal
  /** 'acima' = lado da normal · 'abaixo' · 'ambos' (divide em `<alvo>` e `<alvo>_b`). */
  manter: 'acima' | 'abaixo' | 'ambos'
}
export interface FTransformacao extends Base {
  tipo: 'transformacao'
  mover?: Vec3
  /** Graus em torno dos eixos globais X, Y, Z (nessa ordem), em torno de `pivo` (padrão origem). */
  girar?: Vec3
  pivo?: Vec3
  escala?: number | Vec3
  /** Se definido, o original fica e o resultado vira um corpo novo com este id (Shift+D / CO). */
  copiaId?: string
}
export type FeatureGeo = FExtrude | FRevolve | FPrimitiva | FBooleana | FShell | FFuro | FPadrao | FEspelho | FCorte | FTransformacao

/** Mudança de corpos produzida por UMA feature. null = corpo removido. Os Manifold do delta pertencem ao cache da
 *  regeneração: sempre objetos NOVOS (nunca um corpo existente reaproveitado) e fora do `lixo`. */
export type Delta = Record<string, Manifold | null>

export interface Ctx {
  /** Estado atual dos corpos (antes desta feature). Somente leitura: não delete nem modifique. */
  corpos: ReadonlyMap<string, Manifold>
  /** Perfis do sketch (resolvedor injetado). Lança se o sketch tem erro. */
  perfis(sketchId: string): Perfil[]
  /** Sólidos temporários: tudo que não vai para o Delta entra aqui (`ctx.lixo.add(...)`). */
  lixo: Lixo
  /** Tolerância cordal em mm (TOL_PREVIA ou TOL_EXPORT). */
  tol: number
}

/** Erro de feature com causa + correção (§6.15). A regeneração o transforma em `{erro}`. */
export class ErroFeature extends Error {
  correcao: string
  constructor(causa: string, correcao: string) { super(causa); this.correcao = correcao }
}
