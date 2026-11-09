import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/tokens.css', import.meta.url), 'utf8')
const bloco = (cab: string) => {
  const i = css.indexOf(cab), f = css.indexOf('\n}', i)
  return Object.fromEntries([...css.slice(i, f).matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map(m => [m[1], m[2]]))
}
const escuro = bloco(':root {'), claro = { ...escuro, ...bloco(':root[data-theme="light"]') }

const lum = (h: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(c => c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4)
  return .2126 * r + .7152 * g + .0722 * b
}
const razao = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05) }

const TEXTO = ['--txt', '--titulo', '--nota', '--aviso', '--erro', '--ok', '--atencao']
const GRAFICO = ['--eixo-x', '--eixo-y', '--eixo-z', '--cota', '--selecao', '--destaque', '--volume-impressora', '--restricao-ok', '--restricao-sub', '--restricao-conflito']

for (const [nome, t] of [['escuro', escuro], ['claro', claro]] as const) {
  test(`tema ${nome}: contraste WCAG AA`, () => {
    for (const k of TEXTO) for (const fundo of ['--bg', '--painel']) assert.ok(razao(t[k], t[fundo]) >= 4.5, `${k} sobre ${fundo}: ${razao(t[k], t[fundo]).toFixed(2)}`)
    assert.ok(razao(t['--btn-txt'], t['--btn']) >= 4.5, 'botão')
    assert.ok(razao(t['--txt'], t['--ativo']) >= 4.5, 'texto sobre ativo')
    for (const k of GRAFICO) assert.ok(razao(t[k], t['--bg']) >= 3, `${k} sobre --bg: ${razao(t[k], t['--bg']).toFixed(2)}`)
  })
}

test('claro redefine a paleta do §4.2 e não esquece nenhum token', () => {
  assert.equal(claro['--bg'], '#f4f5f7'); assert.equal(claro['--painel'], '#e9ebee')
  assert.equal(claro['--txt'], '#1d1f22'); assert.equal(claro['--peca'], '#8f8a80')
  const claroSo = bloco(':root[data-theme="light"]')
  for (const k of Object.keys(escuro)) assert.ok(k in claroSo, `${k} sem versão clara`)
})
