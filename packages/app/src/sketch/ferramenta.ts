// Contrato das ferramentas de desenho (L PL REC C A POL SLOT PO XL). Cada ferramenta é uma máquina de estados PURA:
// recebe pontos/opções/números e devolve o próximo passo; quando `adicao` vem preenchida, o chamador a aplica no sketch.
import type { Adicao, Pt, SketchFeature } from '@3dm/core/sketch'

/** Forma de prévia (elástico) desenhada pela vista; não entra no documento. */
export type Forma =
  | { k: 'linha'; a: Pt; b: Pt }
  | { k: 'circulo'; c: Pt; r: number }
  | { k: 'arco'; c: Pt; a: Pt; b: Pt } // anti-horário de a para b
  | { k: 'ponto'; p: Pt }

export interface Passo {
  prompt: string // texto do prompt (vem de T.ferr), com as opções entre colchetes
  opcoes: string[] // palavras clicáveis/digitáveis agora (vêm de T.ferr.op); [] se não há
  previa: Forma[] // prévia fixa deste passo (o que já foi definido)
  // Ids locais '@n' NUNCA se repetem dentro de um comando. Um '@n' que a adição não define refere algo criado por uma adição
  // anterior do mesmo comando (o chamador guarda o mapa '@n' -> id real). Ex.: polilinha emite uma adição por segmento.
  adicao?: Adicao // criar agora (pode vir em vários passos, ex.: cada segmento da polilinha)
  /** true = o chamador desfaz (projeto.desfaz) o último comando criado por esta ferramenta (Desfazer da polilinha). */
  desfazUltima?: boolean
  fim: boolean // true = comando terminou
}

export type EntradaFerr =
  | { tipo: 'ponto'; p: Pt; ref?: string } // ref = id de PONTO existente sob o snap (reusar em vez de criar)
  | { tipo: 'opcao'; opcao: string } // aceita a palavra inteira ou a inicial, sem diferenciar maiúsculas
  | { tipo: 'valor'; v: number } // número digitado (raio, lados, largura...)

export interface Ferramenta {
  readonly nome: string
  inicio(): Passo
  entra(e: EntradaFerr): Passo
  /** Prévia elástica enquanto o mouse se move (além de `previa` do último passo). */
  cursor(p: Pt): Forma[]
  /** Último ponto especificado (base de coordenadas relativas e da distância direta), ou null. */
  readonly ultimo: Pt | null
}
/** Contexto opcional para ferramentas que precisam olhar o sketch (TTR, arco tangente): `sk()` = sketch ativo já resolvido. */
export interface ContextoFerr { sk(): SketchFeature | undefined }
export type FabricaFerramenta = (ctx?: ContextoFerr) => Ferramenta
