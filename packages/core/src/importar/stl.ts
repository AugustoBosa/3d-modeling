// Leitor de STL (binário e ASCII) que devolve malha indexada com vértices soldados.
import type { Malha } from '../malha/tipos.ts'

/** Soldagem: vértices com a mesma posição exata (floats32) viram um só índice. Entrada: 9 floats por triângulo. */
function soldar(cantos: Float32Array): Malha {
  const pos: number[] = []
  const mapa = new Map<string, number>()
  const triVerts = new Uint32Array(cantos.length / 3)
  for (let c = 0; c < triVerts.length; c++) {
    const x = cantos[c * 3]!, y = cantos[c * 3 + 1]!, z = cantos[c * 3 + 2]!
    const chave = `${x},${y},${z}`
    let i = mapa.get(chave)
    if (i === undefined) {
      i = mapa.size
      mapa.set(chave, i)
      pos.push(x, y, z)
    }
    triVerts[c] = i
  }
  return { vertProps: new Float32Array(pos), triVerts }
}

function cantosBinario(bytes: Uint8Array): Float32Array {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const nt = dv.getUint32(80, true)
  const cantos = new Float32Array(nt * 9)
  // Cada triângulo: 12 bytes de normal (ignorada), 36 de vértices, 2 de atributo.
  for (let t = 0; t < nt; t++) for (let k = 0; k < 9; k++) cantos[t * 9 + k] = dv.getFloat32(84 + 50 * t + 12 + 4 * k, true)
  return cantos
}

function cantosAscii(bytes: Uint8Array): Float32Array {
  const texto = new TextDecoder().decode(bytes)
  const nums: number[] = []
  for (const m of texto.matchAll(/^\s*vertex\s+(\S+)\s+(\S+)\s+(\S+)/gm)) {
    for (let k = 1; k <= 3; k++) {
      const v = Number(m[k])
      if (!Number.isFinite(v)) throw new Error(`STL inválido: coordenada não numérica (${m[k]})`)
      nums.push(v)
    }
  }
  if (nums.length % 9 !== 0) throw new Error('STL inválido: vértices não formam triângulos')
  return Float32Array.from(nums)
}

/** Lê STL binário (tamanho == 84 + 50*n) ou ASCII. Vértices idênticos são soldados. */
export function lerStl(bytes: Uint8Array): Malha {
  const binario = bytes.length >= 84 &&
    84 + 50 * new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(80, true) === bytes.length
  const cantos = binario ? cantosBinario(bytes) : cantosAscii(bytes)
  if (cantos.length === 0) throw new Error('STL inválido: sem triângulos')
  return soldar(cantos)
}
