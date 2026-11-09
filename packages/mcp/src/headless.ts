// Sessão headless do MCP: um documento em memória + pilha de undo, lido e gravado como .3dm.json numa pasta.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { criaPilha, lerDocumento, novoDocumento, textoDocumento } from '@3dm/core/doc'
import type { Documento, Pilha } from '@3dm/core/doc'
import type { Sessao } from './sessao.ts'

const EXT = '.3dm.json'

export function criaSessao(pasta: string): Sessao {
  const base = path.resolve(pasta)
  let doc: Documento = novoDocumento()
  let caminho: string | null = null
  const ouvintes: (() => void)[] = []
  const avisa = () => ouvintes.forEach(f => f())
  let pilha: Pilha<Documento> = criaPilha(doc, avisa)

  // A pilha guarda a referência do doc: ao trocar o doc, recria a pilha.
  const troca = (d: Documento) => { doc = d; pilha = criaPilha(doc, avisa); avisa() }

  // ponytail: sem bloqueio de symlink; a checagem é lexical (path.relative), como pede o escopo.
  function resolve(c: string): string {
    const abs = path.resolve(base, c.endsWith(EXT) ? c : c + EXT)
    const rel = path.relative(base, abs)
    if (path.isAbsolute(rel) || rel === '..' || rel.startsWith('..' + path.sep)) throw new Error(`caminho fora da pasta do projeto: ${c}`)
    return abs
  }

  function caminhoSaida(c: string): string {
    const abs = path.resolve(base, c)
    const rel = path.relative(base, abs)
    if (path.isAbsolute(rel) || rel === '..' || rel.startsWith('..' + path.sep)) throw new Error(`caminho fora da pasta do projeto: ${c}`)
    return abs
  }

  return {
    caminhoSaida,
    carrega: troca,
    get doc() { return doc },
    get podeDesfazer() { return pilha.podeDesfazer },
    get podeRefazer() { return pilha.podeRefazer },
    novo(impressora) { caminho = null; troca(novoDocumento(impressora)) },
    abrir(c) {
      const abs = resolve(c)
      const d = lerDocumento(readFileSync(abs, 'utf8'))
      caminho = abs
      troca(d)
    },
    salvar(c) {
      const abs = c !== undefined ? resolve(c)
        : caminho ?? resolve(`${(doc.nome ?? 'projeto').replace(/[^A-Za-z0-9_-]/g, '-')}${EXT}`)
      mkdirSync(path.dirname(abs), { recursive: true })
      writeFileSync(abs, textoDocumento(doc), 'utf8')
      caminho = abs
      return abs
    },
    executa(c) { pilha.executa(c) },
    desfaz() { return pilha.desfaz()?.nome ?? null },
    refaz() { return pilha.refaz()?.nome ?? null },
    aoMudar(f) { ouvintes.push(f) },
  }
}
