// Tipos mínimos do opentype.js 2.0 (o pacote não traz d.ts): só o que o módulo de texto usa.
// Import por default: o build UMD não expõe `parse` como export nomeado para o Node ESM.
declare module 'opentype.js' {
  export type PathCommand =
    | { type: 'M' | 'L'; x: number; y: number }
    | { type: 'Q'; x1: number; y1: number; x: number; y: number }
    | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
    | { type: 'Z' }

  export class Path {
    commands: PathCommand[]
  }

  export class Glyph {
    advanceWidth: number
  }

  export class Font {
    unitsPerEm: number
    getPath(text: string, x: number, y: number, fontSize: number): Path
    charToGlyph(ch: string): Glyph
    getKerningValue(esquerda: Glyph, direita: Glyph): number
  }

  const opentype: { parse(buf: ArrayBuffer): Font }
  export default opentype
}
