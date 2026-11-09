// "Nenhum texto de UI fora de textos.ts" (PLANO §1.2, F0). Heurística: procura texto em atribuições de UI e letras acentuadas em literais.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const raiz = new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const arquivos = (d: string): string[] => readdirSync(d).flatMap(n => statSync(join(d, n)).isDirectory() ? arquivos(join(d, n)) : [join(d, n)])
const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')

const ts = arquivos(raiz).filter(f => f.endsWith('.ts') && relative(raiz, f) !== 'textos.ts' && !f.endsWith('.d.ts'))

// atribui texto literal a uma propriedade visível, ou passa literal para new Option / setAttribute de texto
const ATRIB = /\b(textContent|innerText|innerHTML|placeholder|title|ariaLabel|alt)\s*[:=]\s*(['"`])(?=[^'"`]*[A-Za-zÀ-ÖØ-öø-ÿ])/
const OPTION = /new Option\(\s*['"`]/
const ATTR = /setAttribute\(\s*['"](title|aria-label|placeholder|alt)['"]\s*,\s*['"`]/
const ACENTO = /(['"`])[^'"`\n]*[À-ÖØ-öø-ÿ][^'"`\n]*\1/

test('arquivos de src (exceto textos.ts) não têm texto de UI', () => {
  assert.ok(ts.length > 10, 'achou os arquivos?')
  const achados: string[] = []
  for (const f of ts) {
    semComentarios(readFileSync(f, 'utf8')).split('\n').forEach((linha, i) => {
      const l = linha.replace(/\$\{[^}]*\}/g, '') // interpolações vêm de textos.ts
      if (ATRIB.test(l) || OPTION.test(l) || ATTR.test(l) || ACENTO.test(l)) achados.push(`${relative(raiz, f)}:${i + 1}: ${l.trim()}`)
    })
  }
  assert.deepEqual(achados, [])
})

test('index.html não tem texto visível (só o <title> da marca)', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const visivel = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|title)[\s\S]*?<\/\1>/g, '').replace(/<[^>]+>/g, '').trim()
  assert.equal(visivel, '')
})
