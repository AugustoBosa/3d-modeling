import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCoord, resolveCoord } from '../src/teclado/coordenadas.ts'

// avalia de teste: numeros, L, L/2, min(3,5); o resto devolve null.
const tabela: Record<string, number> = { L: 80, 'L/2': 40, 'min(3,5)': 3 }
function avalia(s: string): number | null {
  if (Object.hasOwn(tabela, s)) return tabela[s]
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s)
  return null
}

test('abs: x,y', () => {
  assert.deepStrictEqual(parseCoord('10,20', avalia), { tipo: 'abs', x: 10, y: 20 })
  assert.deepStrictEqual(parseCoord('-5.5,3', avalia), { tipo: 'abs', x: -5.5, y: 3 })
  assert.deepStrictEqual(parseCoord('L/2,10', avalia), { tipo: 'abs', x: 40, y: 10 })
  assert.deepStrictEqual(parseCoord('min(3,5),2', avalia), { tipo: 'abs', x: 3, y: 2 })
})

test('rel: @dx,dy', () => {
  const e = parseCoord('@80,50', avalia)
  assert.deepStrictEqual(e, { tipo: 'rel', dx: 80, dy: 50 })
  assert.deepStrictEqual(resolveCoord(e!, null, null), { x: 80, y: 50 })
  assert.deepStrictEqual(resolveCoord(parseCoord('@-5,0', avalia)!, { x: 10, y: 10 }, null), { x: 5, y: 10 })
})

test('polar: @d<ang', () => {
  assert.deepStrictEqual(parseCoord('@30<45', avalia), { tipo: 'polar', d: 30, ang: 45 })
  assert.deepStrictEqual(parseCoord('@L<30', avalia), { tipo: 'polar', d: 80, ang: 30 })
  assert.deepStrictEqual(
    resolveCoord(parseCoord('@30<45', avalia)!, { x: 0, y: 0 }, null),
    { x: 21.213203436, y: 21.213203436 },
  )
  const p = resolveCoord(parseCoord('@10<90', avalia)!, { x: 0, y: 0 }, null)
  assert.deepStrictEqual(p, { x: 0, y: 10 })
  assert.ok(!Object.is((p as { x: number }).x, -0))
  assert.deepStrictEqual(
    resolveCoord(parseCoord('@L<30', avalia)!, { x: 0, y: 0 }, null),
    { x: 69.282032303, y: 40 },
  )
})

test('dist: numero sozinho usa a direcao do cursor', () => {
  const e = parseCoord('50', avalia)
  assert.deepStrictEqual(e, { tipo: 'dist', d: 50 })
  assert.deepStrictEqual(resolveCoord(e!, { x: 0, y: 0 }, { x: 100, y: 0 }), { x: 50, y: 0 })
  assert.deepStrictEqual(resolveCoord(e!, { x: 0, y: 0 }, { x: 30, y: 40 }), { x: 30, y: 40 })
  assert.deepStrictEqual(parseCoord('L', avalia), { tipo: 'dist', d: 80 })
})

test('dist sem cursor ou cursor sobre o ultimo ponto da erro', () => {
  const e = parseCoord('50', avalia)!
  const semCursor = resolveCoord(e, { x: 0, y: 0 }, null)
  assert.ok('erro' in semCursor)
  assert.match(semCursor.erro, /cursor/)
  const semUltimo = resolveCoord(e, null, { x: 1, y: 1 })
  assert.ok('erro' in semUltimo)
  const mesmoPonto = resolveCoord(e, { x: 2, y: 2 }, { x: 2, y: 2 })
  assert.ok('erro' in mesmoPonto)
})

test('textos invalidos devolvem null', () => {
  for (const t of ['abc', '1,', ',2', '1,2,3', '@5', '@', '', '   ', '10<45']) {
    assert.equal(parseCoord(t, avalia), null, `esperado null para "${t}"`)
  }
})
