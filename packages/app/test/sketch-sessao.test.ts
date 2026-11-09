import { test } from 'node:test'
import assert from 'node:assert/strict'
import { definirParametro } from '@3dm/core/doc'
import type { SketchFeature } from '@3dm/core/sketch'
import { adicionaRestricao, ORIGEM } from '@3dm/core/sketch'
import { criaProjeto } from '../src/projeto.ts'
import { criaSessaoSketch } from '../src/sketch/sessao.ts'
import type { Deps, SessaoSketch } from '../src/sketch/sessao.ts'
import type { EstadoModos } from '../src/status.ts'
import { T } from '../src/textos.ts'

type Ent = { id: string; tipo: string; x?: number; y?: number; r?: number; a?: string; b?: string; c?: string }
type Rest = { id: string; tipo: string; e: string[]; expr?: string; ref?: boolean }
interface Insp {
  ativo: boolean; sketchId: string | null; entidades: Ent[]; restricoes: Rest[]; estado: string
  selecao: string[]; ferramenta: string | null; prompt: string | null; opcoes: string[]
}

// Modos desligados por padrão (snap não interfere); `ligados` liga o que o teste pede.
function monta(ligados: Partial<EstadoModos> = {}) {
  const projeto = criaProjeto()
  const escritos: { texto: string; tipo: string }[] = []
  const modos: EstadoModos = { osnap: false, grid: false, ortho: false, snap: false, polar: false, otrack: false, dyn: false, ...ligados }
  const deps: Deps = {
    projeto,
    escreve: (texto, tipo) => { escritos.push({ texto, tipo }) },
    modos: () => modos,
    mmPorPixel: () => 0.1,
    confirma: () => true,
  }
  return { s: criaSessaoSketch(deps), projeto, escritos }
}

const insp = (s: { inspeciona(): object }) => s.inspeciona() as Insp
const pontos = (i: Insp) => i.entidades.filter(e => e.tipo === 'ponto')
const ponto = (i: Insp, x: number, y: number): string => {
  const p = pontos(i).find(q => q.x === x && q.y === y)
  if (!p) throw new Error(`sem ponto em ${x},${y}`)
  return p.id
}
const horizontais = (i: Insp) => i.restricoes.filter(r => r.tipo === 'horizontal').map(r => r.e[0])
const verticais = (i: Insp) => i.restricoes.filter(r => r.tipo === 'vertical').map(r => r.e[0])

function coordPonto(sk: SketchFeature, id: string) {
  const e = sk.entidades.find(x => x.id === id)
  if (e?.tipo !== 'ponto') throw new Error(`"${id}" não é ponto`)
  return e
}

test('REC 0,0 @80,50 com snap ligado: retangulo exato 80x50; Ctrl+Z volta ao vazio', () => {
  const { s, projeto } = monta({ osnap: true, grid: true, snap: true })
  s.inicia('RETANGULO')
  s.texto('0,0')
  s.texto('@80,50')
  const i = insp(s)
  assert.equal(i.entidades.filter(e => e.tipo === 'linha').length, 4)
  const cantos = pontos(i).filter(p => p.id !== ORIGEM)
  const xs = cantos.map(p => p.x ?? NaN), ys = cantos.map(p => p.y ?? NaN)
  assert.equal(cantos.length, 4)
  assert.equal(Math.max(...xs) - Math.min(...xs), 80)
  assert.equal(Math.max(...ys) - Math.min(...ys), 50)
  assert.deepEqual(i.restricoes.map(r => r.tipo).sort(), ['coincidente', 'fixa', 'horizontal', 'horizontal', 'vertical', 'vertical'])
  assert.equal(i.ferramenta, null)
  projeto.desfaz()
  assert.deepEqual(insp(s).entidades.map(e => e.id), [ORIGEM])
})

test('DIM: sem fixa manual, o canto em 0,0 fica preso à origem (coincidente) e as cotas de 80 e 50 deixam o retangulo definido', () => {
  const { s, projeto } = monta()
  s.inicia('RETANGULO')
  s.texto('0,0')
  s.texto('@80,50')
  let i = insp(s)
  assert.ok(i.restricoes.some(r => r.tipo === 'coincidente'))
  s.seleciona([horizontais(i)[0]])
  s.inicia('DIM')
  s.texto('80')
  i = insp(s)
  s.seleciona([verticais(i)[0]])
  s.inicia('DIM')
  s.texto('50')
  assert.equal(insp(s).estado, 'definido')
  assert.equal(insp(s).ferramenta, null)
})

test('DIM com =L liga a cota ao parametro: mudar L atualiza a geometria sem novo comando', () => {
  const { s, projeto } = monta()
  projeto.executa(definirParametro('L', '80'))
  s.inicia('RETANGULO')
  s.texto('0,0')
  s.texto('@80,50')
  const i = insp(s)
  const l1 = horizontais(i)[0]
  s.seleciona([l1])
  s.inicia('DIM')
  s.texto('=L')
  assert.equal(insp(s).restricoes.find(r => r.e[0] === l1 && r.tipo === 'distancia')?.expr, 'L')
  projeto.executa(definirParametro('L', '100'))
  const sk = s.vista()!.sk
  const linha = sk.entidades.find(e => e.id === l1)
  if (linha?.tipo !== 'linha') throw new Error('sem linha')
  const pa = coordPonto(sk, linha.a), pb = coordPonto(sk, linha.b)
  assert.ok(Math.abs(Math.abs(pb.x - pa.x) - 100) < 1e-6)
})

test('letras: H vira horizontal em linha inclinada; E com 2 linhas; seleção inválida devolve false', () => {
  const { s, escritos } = monta()
  s.inicia('LINHA')
  s.clique({ x: 0, y: 0 })
  s.clique({ x: 30, y: 40 })
  s.esc()
  const lin = insp(s).entidades.find(e => e.tipo === 'linha')!.id
  s.seleciona([lin])
  assert.equal(s.aplicaRestricao('H'), true)
  assert.ok(insp(s).restricoes.some(r => r.tipo === 'horizontal' && r.e[0] === lin))

  const r = monta()
  r.s.inicia('RETANGULO')
  r.s.texto('0,0')
  r.s.texto('@80,50')
  const hs = horizontais(insp(r.s))
  r.s.seleciona([hs[0], hs[1]])
  assert.equal(r.s.aplicaRestricao('E'), true)
  assert.ok(insp(r.s).restricoes.some(q => q.tipo === 'igual'))

  r.s.seleciona([ponto(insp(r.s), 0, 0)])
  assert.equal(r.s.aplicaRestricao('T'), false)
  assert.deepEqual(r.escritos.at(-1), { texto: T.sk.restricaoInvalida('T'), tipo: 'erro' })
  assert.ok(escritos.length > 0)
})

test('CIRCULO por texto: centro 0,0 e raio 20', () => {
  const { s } = monta()
  s.inicia('CIRCULO')
  s.texto('0,0')
  s.texto('20')
  const i = insp(s)
  const c = i.entidades.find(e => e.tipo === 'circulo')!
  assert.equal(c.r, 20)
  const centro = i.entidades.find(e => e.id === c.c)!
  assert.deepEqual([centro.x, centro.y], [0, 0])
  assert.equal(i.ferramenta, null)
})

test('OFFSET e APARAR por editor com cliques', () => {
  const { s } = monta()
  s.inicia('LINHA')
  s.clique({ x: 0, y: 0 })
  s.clique({ x: 80, y: 0 })
  s.esc()
  // OFFSET: valor, depois clique na entidade e clique no lado
  s.inicia('OFFSET')
  s.texto('5')
  s.clique({ x: 40, y: 0 })
  s.clique({ x: 40, y: 5 })
  assert.equal(insp(s).ferramenta, null)
  const linhasY = insp(s).entidades.filter(e => e.tipo === 'linha').length
  assert.equal(linhasY, 2)

  // APARAR: repete; esc termina
  s.inicia('APARAR')
  s.clique({ x: 40, y: 0 })
  assert.equal(insp(s).ferramenta, 'APARAR')
  s.esc()
  assert.equal(insp(s).ferramenta, null)
})

test('esc cancela; clique seleciona; janela esquerda->direita e direita->esquerda', () => {
  const { s } = monta()
  assert.equal(s.texto('1'), false)
  s.inicia('LINHA')
  s.clique({ x: 0, y: 0 })
  s.esc()
  assert.equal(insp(s).ferramenta, null)

  s.inicia('RETANGULO')
  s.texto('0,0')
  s.texto('@80,50')
  s.clique({ x: 40, y: 0 })
  const i = insp(s)
  assert.deepEqual(i.selecao, [horizontais(i)[0]])
  s.esc()
  assert.equal(insp(s).selecao.length, 0)

  // janela (esquerda->direita) só pega o que está inteiro dentro: os pontos em (0,0) (origem e canto)
  s.janela({ x: -10, y: -10 }, { x: 40, y: 10 })
  assert.deepEqual([...insp(s).selecao].sort(), pontos(insp(s)).filter(p => p.x === 0 && p.y === 0).map(p => p.id).sort())
  // cruzamento (direita->esquerda) pega o que toca: a linha de baixo e a da esquerda
  s.janela({ x: 40, y: 10 }, { x: -10, y: -10 })
  const sel = insp(s).selecao
  assert.ok(sel.includes(horizontais(insp(s))[0]))
  assert.ok(sel.includes(ponto(insp(s), 0, 0)))
})

test('POLILINHA com 3 cliques e Enter: 2 segmentos', () => {
  const { s } = monta()
  s.inicia('POLILINHA')
  s.clique({ x: 0, y: 0 })
  s.clique({ x: 50, y: 0 })
  s.clique({ x: 50, y: 30 })
  s.enter()
  const i = insp(s)
  assert.equal(i.entidades.filter(e => e.tipo === 'linha').length, 2)
  assert.equal(pontos(i).filter(p => p.id !== ORIGEM).length, 3)
  assert.equal(i.ferramenta, null)
})

// Linha (10,10)-(40,50) fora da origem (sem coincidir com p0), centro (25,30), selecionada.
function linhaSel(s: SessaoSketch): void {
  s.inicia('LINHA')
  s.clique({ x: 10, y: 10 })
  s.clique({ x: 40, y: 50 })
  s.esc()
  s.seleciona([insp(s).entidades.find(e => e.tipo === 'linha')!.id])
}
const perto = (i: Insp, x: number, y: number) =>
  pontos(i).some(p => Math.abs((p.x ?? NaN) - x) < 1e-6 && Math.abs((p.y ?? NaN) - y) < 1e-6)

test('G eixo X e número 10: move 10 mm em x e é UM comando desfazível', () => {
  const { s, projeto } = monta()
  linhaSel(s)
  const antes = structuredClone(projeto.doc)
  s.iniciaTransformacao('G')
  s.eixoTransformacao('X', false)
  s.numeroTransformacao('10')
  s.confirmaTransformacao()
  assert.equal(s.transformacao, null)
  assert.ok(perto(insp(s), 20, 10) && perto(insp(s), 50, 50))
  projeto.desfaz()
  assert.deepEqual(projeto.doc, antes)
})

test('G com cursor: delta é o cursor menos o ponto de partida', () => {
  const { s } = monta()
  linhaSel(s)
  s.cursor({ x: 0, y: 0 })
  s.iniciaTransformacao('G')
  s.cursor({ x: 5, y: 7 })
  assert.deepEqual(s.transformacao, { letra: 'G', eixo: null, plano: false, numero: '' })
  assert.ok(perto(insp(s), 15, 17))
  s.confirmaTransformacao()
  assert.ok(perto(insp(s), 15, 17) && perto(insp(s), 45, 57))
})

test('R 90 graus: linha gira em torno do baricentro', () => {
  const { s } = monta()
  linhaSel(s)
  s.iniciaTransformacao('R')
  s.numeroTransformacao('90')
  s.confirmaTransformacao()
  const i = insp(s)
  assert.ok(perto(i, 45, 15) && perto(i, 5, 45))
})

test('S fator 2: escala a partir do baricentro', () => {
  const { s } = monta()
  linhaSel(s)
  s.iniciaTransformacao('S')
  s.numeroTransformacao('2')
  s.confirmaTransformacao()
  const i = insp(s)
  assert.ok(perto(i, -5, -10) && perto(i, 55, 70))
})

test('prévia: vista() mostra a transformação sem alterar o documento; Z é ignorado', () => {
  const { s, projeto } = monta()
  linhaSel(s)
  s.iniciaTransformacao('G')
  s.eixoTransformacao('X', false)
  s.eixoTransformacao('Z', false)
  assert.equal(s.transformacao?.eixo, 'X')
  s.numeroTransformacao('10')
  const antes = structuredClone(projeto.doc)
  assert.ok(perto(insp(s), 20, 10))
  assert.deepEqual(projeto.doc, antes)
  assert.equal(insp(s).ativo, true)
})

test('esc cancela a transformação sem mudar o documento', () => {
  const { s, projeto } = monta()
  linhaSel(s)
  const antes = structuredClone(projeto.doc)
  s.iniciaTransformacao('G')
  s.numeroTransformacao('10')
  s.esc()
  assert.equal(s.transformacao, null)
  assert.deepEqual(projeto.doc, antes)
  assert.ok(perto(insp(s), 10, 10))
})

test('sem seleção não inicia a transformação', () => {
  const { s, escritos } = monta()
  s.iniciaTransformacao('G')
  assert.equal(s.transformacao, null)
  assert.deepEqual(escritos.at(-1), { texto: T.ed.nadaSelecionado, tipo: 'erro' })
})

test('acao: despacha as ações principais e devolve false para as que não são do sketch', () => {
  const { s, projeto } = monta()
  assert.equal(s.acao({ tipo: 'selecionaTudo' }), false)
  assert.equal(s.acao({ tipo: 'alternaSketch' }), true)
  assert.equal(s.ativo, true)
  assert.equal(s.acao({ tipo: 'paraLinha', texto: 'L' }), false)
  assert.equal(s.acao({ tipo: 'repete' }), false)
  linhaSel(s)
  assert.equal(s.acao({ tipo: 'iniciaTransformacao', letra: 'G' }), true)
  assert.equal(s.acao({ tipo: 'eixo', eixo: 'X', plano: false }), true)
  assert.equal(s.acao({ tipo: 'numero', texto: '10' }), true)
  assert.equal(s.acao({ tipo: 'confirmaTransformacao' }), true)
  assert.ok(perto(insp(s), 20, 10))
  assert.equal(s.acao({ tipo: 'apaga' }), true)
  assert.equal(insp(s).entidades.filter(e => e.tipo === 'linha').length, 0)
  assert.equal(s.acao({ tipo: 'alternaSketch' }), true)
  assert.equal(s.ativo, false)
  assert.equal(projeto.podeRefazer, false)
})

test('desfazRestricao remove a última restrição e não permite refazer', () => {
  const { s, projeto } = monta()
  linhaSel(s)
  assert.equal(s.acao({ tipo: 'aplicaRestricao', letra: 'H' }), true)
  assert.ok(insp(s).restricoes.some(r => r.tipo === 'horizontal'))
  assert.equal(s.acao({ tipo: 'desfazRestricao' }), true)
  assert.equal(insp(s).restricoes.some(r => r.tipo === 'horizontal'), false)
  assert.equal(projeto.podeRefazer, false)
})

test('regra 2b: letra que NÃO aplicou restrição não desfaz nada (t r, e x, d i com uma linha só)', () => {
  const { s, projeto } = monta()
  linhaSel(s)
  const antes = insp(s).entidades.length, cmds = projeto.podeDesfazer
  for (const letra of ['T', 'E'] as const) {
    assert.equal(s.aplicaRestricao(letra), false) // não se aplica a uma linha só
    assert.equal(s.acao({ tipo: 'desfazRestricao' }), true) // o despachante manda desfazer; não há nada seu para desfazer
  }
  assert.equal(insp(s).entidades.length, antes, 'a linha desenhada não pode sumir')
  assert.equal(projeto.podeDesfazer, cmds)
})

test('regra 2b: desfaz só a restrição aplicada, mesmo com outros comandos antes (PARAM) e depois de confirmar não desfaz', () => {
  const { s, projeto } = monta()
  projeto.executa(definirParametro('L', '100'))
  linhaSel(s)
  assert.equal(s.aplicaRestricao('H'), true)
  s.acao({ tipo: 'desfazRestricao' })
  assert.equal(projeto.doc.parametros.L?.expr, '100', 'PARAM continua')
  assert.equal(insp(s).restricoes.some(r => r.tipo === 'horizontal'), false)
  assert.equal(s.aplicaRestricao('H'), true)
  s.acao({ tipo: 'confirmaRestricao' })
  s.acao({ tipo: 'desfazRestricao' }) // já confirmada: não desfaz
  assert.ok(insp(s).restricoes.some(r => r.tipo === 'horizontal'))
})
