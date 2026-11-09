// Formato do sketch dentro do documento (feature tipo "sketch", PROJETO_BASE §5.2) e transformações de plano.
// Entidades e restrições se referem umas às outras por id (string). As coordenadas dos pontos guardam o ÚLTIMO
// resultado do solver; a verdade paramétrica são as restrições (cotas com `expr`).
import type { Feature } from '../doc/index.ts'

export interface Pt { x: number; y: number }
export type PlanoBase = 'XY' | 'XZ' | 'YZ'
/** offset em mm ao longo da normal. `offsetExpr` (opcional, ex.: "H") manda; `offset` guarda o último valor calculado. */
export interface Plano { base: PlanoBase; offset: number; offsetExpr?: string }

interface Base { id: string; construcao?: boolean } // construcao: linha de construção, não gera perfil
export type EntSk =
  | (Base & { tipo: 'ponto'; x: number; y: number })
  | (Base & { tipo: 'linha'; a: string; b: string }) // a, b = ids de pontos
  | (Base & { tipo: 'circulo'; c: string; r: number }) // c = id do ponto central
  | (Base & { tipo: 'arco'; c: string; a: string; b: string }) // centro + extremos; sentido ANTI-HORÁRIO de a para b

export type TipoRestSk =
  | 'coincidente' | 'horizontal' | 'vertical' | 'paralela' | 'perpendicular' | 'tangente'
  | 'igual' | 'concentrica' | 'pontoNaCurva' | 'simetria' | 'fixa'
  | 'distancia' | 'distanciaH' | 'distanciaV' | 'raio' | 'diametro' | 'angulo'

/** `e` = ids de entidades (mesma convenção do solver: ver solver.ts `compilar`). Dimensões têm `expr` (ângulo em GRAUS);
 *  `ref: true` = cota de referência (só mostra, não dirige). `xy` = alvo da "fixa". */
export interface RestSk { id: string; tipo: TipoRestSk; e: string[]; expr?: string; ref?: boolean; xy?: [number, number] }
export const ehDimensao = (t: TipoRestSk) => ['distancia', 'distanciaH', 'distanciaV', 'raio', 'diametro', 'angulo'].includes(t)

export interface SketchFeature extends Feature {
  tipo: 'sketch'
  plano: Plano
  entidades: EntSk[]
  restricoes: RestSk[]
}

export const ehSketch = (f: Feature | undefined): f is SketchFeature => !!f && f.tipo === 'sketch'

/** Ponto (u, v) do plano → [x, y, z] do mundo. XY: (u,v,off) · XZ: (u,off,v) · YZ: (off,u,v). */
export function planoParaMundo(p: Plano, u: number, v: number): [number, number, number] {
  return p.base === 'XY' ? [u, v, p.offset] : p.base === 'XZ' ? [u, p.offset, v] : [p.offset, u, v]
}

/** Origem do sketch: ponto p0 em (0,0), fixo pela restrição r0. Não se move, não se apaga, não se copia. */
export const ORIGEM = 'p0'
export const RESTR_ORIGEM = 'r0'

/** Próximo id livre com o prefixo (p1, l3, r2…). */
export function novoId(sk: { entidades: { id: string }[]; restricoes: { id: string }[] }, prefixo: string): string {
  let max = 0
  for (const x of [...sk.entidades, ...sk.restricoes]) if (x.id.startsWith(prefixo)) max = Math.max(max, Number(x.id.slice(prefixo.length)) || 0)
  return prefixo + (max + 1)
}

/** Novas entidades/restrições vindas de uma ferramenta. Ids que começam com '@' são LOCAIS (ex. '@1'; viram ids reais ao aplicar);
 *  qualquer outro id refere uma entidade que já existe no sketch (ex.: ponto 'p3' sob o snap). */
export interface Adicao { entidades: EntSk[]; restricoes: RestSk[] }
