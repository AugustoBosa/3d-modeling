// Leitor de OBJ (só v e f). Faces com mais de 3 vértices viram leque de triângulos.
import type { Malha } from '../malha/tipos.ts'

export function lerObj(texto: string): Malha {
  const pos: number[] = []
  const tris: number[] = []
  for (const linha of texto.split(/\r?\n/)) {
    const [tipo, ...args] = linha.trim().split(/\s+/)
    if (tipo === 'v') {
      const xyz = args.slice(0, 3).map(Number)
      if (xyz.length < 3 || xyz.some((v) => !Number.isFinite(v))) throw new Error(`OBJ inválido: vértice mal formado (${linha})`)
      pos.push(...xyz)
    } else if (tipo === 'f') {
      const nv = pos.length / 3
      const idx = args.map((a) => {
        const i = parseInt(a.split('/')[0]!, 10)
        const n = i < 0 ? nv + i + 1 : i // negativo: relativo aos vértices já lidos
        if (!Number.isInteger(n) || n < 1 || n > nv) throw new Error(`OBJ inválido: índice ${a} fora do intervalo`)
        return n - 1
      })
      for (let k = 1; k + 1 < idx.length; k++) tris.push(idx[0]!, idx[k]!, idx[k + 1]!)
    }
  }
  if (tris.length === 0) throw new Error('OBJ inválido: sem faces')
  return { vertProps: new Float32Array(pos), triVerts: new Uint32Array(tris) }
}
