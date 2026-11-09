// Texto → contornos 2D em mm via opentype.js. Sem DOM: a fonte entra como bytes.
import opentype, { type Font, type Glyph, type PathCommand } from 'opentype.js'

type P = [number, number]

// ponytail: número fixo de segmentos por curva (sem refinamento adaptativo); sobe se glifos grandes ficarem facetados.
const SEGMENTOS = 8

export function carregaFonte(bytes: ArrayBuffer): Font {
  try {
    return opentype.parse(bytes)
  } catch (e) {
    throw new Error(`fonte inválida: ${e instanceof Error ? e.message : String(e)}`)
  }
}

const igual = (a: P, b: P): boolean => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9

/** Remove pontos repetidos seguidos e o ponto final igual ao inicial. */
function limpa(c: P[]): P[] {
  const r: P[] = []
  for (const p of c) if (!r.length || !igual(r[r.length - 1]!, p)) r.push(p)
  if (r.length > 1 && igual(r[0]!, r[r.length - 1]!)) r.pop()
  return r
}

export function textoParaContornos(fonte: Font, texto: string, tamanhoMm: number): P[][] {
  const contornos: P[][] = []
  let atual: P[] = []
  let cur: P = [0, 0]
  const fecha = () => {
    const c = limpa(atual)
    if (c.length >= 3) contornos.push(c)
    atual = []
  }
  // opentype dá y para cima com a linha de base em y=0 no sistema de fonte; o desenho usa y para baixo: inverte.
  const alvo = (x: number, y: number): P => [x, -y]
  const passos = (fim: P, pontos: (t: number) => P) => {
    for (let k = 1; k <= SEGMENTOS; k++) atual.push(pontos(k / SEGMENTOS))
    cur = fim
  }
  const comando = (c: PathCommand) => {
    switch (c.type) {
      case 'M':
        fecha()
        cur = alvo(c.x, c.y)
        atual = [cur]
        break
      case 'L':
        cur = alvo(c.x, c.y)
        atual.push(cur)
        break
      case 'Q': {
        const p0 = cur, q = alvo(c.x1, c.y1), e = alvo(c.x, c.y)
        passos(e, (t) => {
          const u = 1 - t
          return [u * u * p0[0] + 2 * u * t * q[0] + t * t * e[0], u * u * p0[1] + 2 * u * t * q[1] + t * t * e[1]]
        })
        break
      }
      case 'C': {
        const p0 = cur, a = alvo(c.x1, c.y1), b = alvo(c.x2, c.y2), e = alvo(c.x, c.y)
        passos(e, (t) => {
          const u = 1 - t
          const k0 = u * u * u, k1 = 3 * u * u * t, k2 = 3 * u * t * t, k3 = t * t * t
          return [k0 * p0[0] + k1 * a[0] + k2 * b[0] + k3 * e[0], k0 * p0[1] + k1 * a[1] + k2 * b[1] + k3 * e[1]]
        })
        break
      }
      case 'Z':
        fecha()
        break
    }
  }
  // ponytail: getPath(texto) quebra com 2+ caracteres (bug do opentype 2.0 no GSUB ccmp da Roboto), então
  // desenha caractere a caractere com avanço e kerning da própria fonte. Sem ligaduras; volta a getPath(texto) quando o bug for corrigido.
  const escala = tamanhoMm / fonte.unitsPerEm
  let x = 0
  let anterior: Glyph | undefined
  for (const ch of texto) {
    const g = fonte.charToGlyph(ch)
    if (anterior) x += fonte.getKerningValue(anterior, g) * escala
    for (const c of fonte.getPath(ch, x, 0, tamanhoMm).commands) comando(c)
    x += g.advanceWidth * escala
    anterior = g
  }
  fecha()
  return contornos
}
