// Classifica um arquivo importado pela extensão e decodifica com os parsers do core. Lógica pura, sem DOM.
import { ler3mf, lerObj, lerStl, lerSvg } from '@3dm/core/importar'
import type { Malha } from '@3dm/core/malha'

export type Classificado =
  | { tipo: 'malhas'; itens: { nome: string; malha: Malha }[] }
  | { tipo: 'svg'; contornos: [number, number][][]; largura: number; altura: number }
  | { tipo: 'invalido' }

/** Decodifica o arquivo. Exceções dos parsers propagam com a mensagem original. */
export function classifica(nome: string, bytes: Uint8Array): Classificado {
  const ext = (/\.([^.]+)$/.exec(nome)?.[1] ?? '').toLowerCase()
  const base = nome.replace(/\.[^.]+$/, '')
  const texto = () => new TextDecoder().decode(bytes)
  switch (ext) {
    case 'stl':
      return { tipo: 'malhas', itens: [{ nome: base, malha: lerStl(bytes) }] }
    case 'obj':
      return { tipo: 'malhas', itens: [{ nome: base, malha: lerObj(texto()) }] }
    case '3mf':
      return { tipo: 'malhas', itens: ler3mf(bytes) }
    case 'svg':
      return { tipo: 'svg', ...lerSvg(texto()) }
    default:
      return { tipo: 'invalido' }
  }
}
