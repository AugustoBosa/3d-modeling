// Leitor de 3MF: extrai cada <object> com malha do modelo principal.
import { strFromU8, unzipSync } from 'fflate'
import type { Malha } from '../malha/tipos.ts'

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const desescapa = (s: string) => s.replace(/&(amp|lt|gt|quot|apos);/g, (_, e: string) => ENT[e]!)
const atr = (s: string, nome: string) => s.match(new RegExp(`\\b${nome}="([^"]*)"`))?.[1]
const num = (s: string, nome: string) => {
  const v = Number(atr(s, nome))
  if (!Number.isFinite(v)) throw new Error(`3MF inválido: ${nome} ausente ou não numérico`)
  return v
}

export function ler3mf(bytes: Uint8Array): { nome: string; malha: Malha }[] {
  const arquivos = unzipSync(bytes)
  const caminho = '3D/3dmodel.model' in arquivos ? '3D/3dmodel.model' : Object.keys(arquivos).find((k) => k.endsWith('.model'))
  if (!caminho) throw new Error('3MF inválido: modelo não encontrado')
  const xml = strFromU8(arquivos[caminho]!)

  const resultado: { nome: string; malha: Malha }[] = []
  for (const obj of xml.matchAll(/<object\b([^>]*)>([\s\S]*?)<\/object>/g)) {
    const vs = [...obj[2]!.matchAll(/<vertex\b([^>]*)>/g)]
    const ts = [...obj[2]!.matchAll(/<triangle\b([^>]*)>/g)]
    if (ts.length === 0) continue // objetos só com <components> ou sem malha
    const vertProps = new Float32Array(vs.length * 3)
    vs.forEach((m, i) => {
      vertProps[i * 3] = num(m[1]!, 'x')
      vertProps[i * 3 + 1] = num(m[1]!, 'y')
      vertProps[i * 3 + 2] = num(m[1]!, 'z')
    })
    const triVerts = new Uint32Array(ts.length * 3)
    ts.forEach((m, t) => {
      for (let k = 1; k <= 3; k++) {
        const v = num(m[1]!, `v${k}`)
        if (!Number.isInteger(v) || v < 0 || v >= vs.length) throw new Error(`3MF inválido: índice de triângulo fora do intervalo (${v})`)
        triVerts[t * 3 + k - 1] = v
      }
    })
    const nome = atr(obj[1]!, 'name')
    resultado.push({ nome: nome ? desescapa(nome) : `Objeto ${resultado.length + 1}`, malha: { vertProps, triVerts } })
  }
  if (resultado.length === 0) throw new Error('3MF inválido: nenhum objeto com malha')
  return resultado
}
