import { test } from 'node:test'
import assert from 'node:assert/strict'
import { despacha, estadoInicial } from '../src/teclado/despachante.ts'
import type { Acao, Ctx, Estado, Tecla } from '../src/teclado/despachante.ts'

// Contexto base: com selecao, linha vazia, fora de comando, sem sketch, preferencia Blender ligada.
const base: Ctx = { noSketch: true, selecao: 0, linhaVazia: true, emComando: false, imediatasBlender: true }
const ctx = (o: Partial<Ctx> = {}): Ctx => ({ ...base, ...o })
const com = (o: Partial<Ctx> = {}): Ctx => ctx({ selecao: 2, ...o })
const k = (key: string, mods: Partial<Tecla> = {}): Tecla => ({ key, ...mods })
const tipos = (acoes: Acao[]) => acoes.map(a => a.tipo)

// Roda uma sequencia de teclas a partir de um estado, devolvendo todas as acoes e o estado final.
function sequencia(teclas: Tecla[], c: Ctx, inicio: Estado = estadoInicial()) {
  let estado = inicio
  const acoes: Acao[] = []
  for (const t of teclas) {
    const r = despacha(estado, t, c)
    estado = r.estado
    acoes.push(...r.acoes)
  }
  return { estado, acoes }
}

// Tabela 7.5, E: sem selecao vira comando; no sketch com selecao vira restricao; E + X desfaz e vai para a linha.
test('E: sem selecao vai para a linha de comando', () => {
  const r = despacha(estadoInicial(), k('e'), ctx({ selecao: 0 }))
  assert.deepEqual(r.acoes, [{ tipo: 'paraLinha', texto: 'E' }], 'E sem selecao deve ir para a linha')
})

test('E: no sketch com selecao aplica restricao E', () => {
  const r = despacha(estadoInicial(), k('E'), com({ noSketch: true }))
  assert.deepEqual(r.acoes, [{ tipo: 'aplicaRestricao', letra: 'E' }], 'E no sketch com selecao deve aplicar restricao')
  assert.deepEqual(r.estado, { fase: 'restricao', letra: 'E' })
})

test('E seguido de X: desfaz restricao e cola EX na linha', () => {
  const r = sequencia([k('E'), k('X')], com({ noSketch: true }))
  assert.deepEqual(r.acoes.slice(1), [{ tipo: 'desfazRestricao' }, { tipo: 'paraLinha', texto: 'EX' }], 'E + X deve gerar EX')
  assert.deepEqual(r.estado, estadoInicial())
})

// Tabela 7.5, R: com selecao inicia giro; R + E vira RE; depois C vira REC.
test('R: com selecao inicia transformacao', () => {
  const r = despacha(estadoInicial(), k('r'), com())
  assert.deepEqual(r.acoes, [{ tipo: 'iniciaTransformacao', letra: 'R' }], 'R com selecao deve iniciar transformacao')
})

test('R, E, C: RE depois REC', () => {
  const r1 = despacha(estadoInicial(), k('R'), com())
  const r2 = despacha(r1.estado, k('E'), com())
  assert.deepEqual(r2.acoes, [{ tipo: 'cancelaTransformacao' }, { tipo: 'paraLinha', texto: 'RE' }], 'R + E deve gerar RE')
  const r3 = despacha(r2.estado, k('C'), ctx({ linhaVazia: false }))
  assert.deepEqual(r3.acoes, [{ tipo: 'paraLinha', texto: 'C' }], 'C com linha nao vazia vai para a linha (REC)')
})

test('R: sem selecao vai para a linha de comando', () => {
  const r = despacha(estadoInicial(), k('R'), ctx({ selecao: 0 }))
  assert.deepEqual(r.acoes, [{ tipo: 'paraLinha', texto: 'R' }], 'R sem selecao deve ir para a linha')
})

// Tabela 7.5, C: sempre comando de linha, em qualquer combinacao.
test('C: sempre vai para a linha, com ou sem selecao, sketch ou nao', () => {
  for (const sel of [0, 2]) for (const noSketch of [true, false]) {
    const r = despacha(estadoInicial(), k('C'), ctx({ selecao: sel, noSketch }))
    assert.deepEqual(r.acoes, [{ tipo: 'paraLinha', texto: 'C' }], `C deve ir para a linha (selecao=${sel}, noSketch=${noSketch})`)
  }
})

// Tabela 7.5, T: restricao no sketch com selecao; T + R desfaz e vai para a linha.
test('T: sem selecao vai para a linha de comando', () => {
  const r = despacha(estadoInicial(), k('T'), ctx({ selecao: 0 }))
  assert.deepEqual(r.acoes, [{ tipo: 'paraLinha', texto: 'T' }], 'T sem selecao deve ir para a linha')
})

test('T: no sketch com selecao aplica restricao T', () => {
  const r = despacha(estadoInicial(), k('T'), com({ noSketch: true }))
  assert.deepEqual(r.acoes, [{ tipo: 'aplicaRestricao', letra: 'T' }], 'T no sketch com selecao deve aplicar restricao')
})

test('T seguido de R: TR com desfazRestricao', () => {
  const r = sequencia([k('T'), k('R')], com({ noSketch: true }))
  assert.deepEqual(r.acoes.slice(1), [{ tipo: 'desfazRestricao' }, { tipo: 'paraLinha', texto: 'TR' }], 'T + R deve gerar TR')
})

// Tabela 7.5, H: fora do sketch esconde; no sketch restringe; sem selecao vai para a linha.
test('H: fora do sketch com selecao esconde', () => {
  const r = despacha(estadoInicial(), k('H'), com({ noSketch: false }))
  assert.deepEqual(r.acoes, [{ tipo: 'esconde' }], 'H fora do sketch com selecao deve esconder')
})

test('H: no sketch com selecao aplica restricao H', () => {
  const r = despacha(estadoInicial(), k('H'), com({ noSketch: true }))
  assert.deepEqual(r.acoes, [{ tipo: 'aplicaRestricao', letra: 'H' }], 'H no sketch com selecao deve aplicar restricao')
})

test('H: sem selecao vai para a linha de comando', () => {
  const r = despacha(estadoInicial(), k('H'), ctx({ selecao: 0, noSketch: false }))
  assert.deepEqual(r.acoes, [{ tipo: 'paraLinha', texto: 'H' }], 'H sem selecao deve ir para a linha')
})

// Tabela 7.5, X: apaga com selecao; sem selecao vai para a linha; E + X vira EX.
test('X: com selecao apaga (apagaConfirma)', () => {
  const r = despacha(estadoInicial(), k('X'), com())
  assert.deepEqual(r.acoes, [{ tipo: 'apagaConfirma' }], 'X com selecao deve pedir apagaConfirma')
})

test('X: sem selecao vai para a linha de comando', () => {
  const r = despacha(estadoInicial(), k('X'), ctx({ selecao: 0 }))
  assert.deepEqual(r.acoes, [{ tipo: 'paraLinha', texto: 'X' }], 'X sem selecao deve ir para a linha')
})

test('X depois de E no sketch: EX', () => {
  const r = sequencia([k('E'), k('X')], com({ noSketch: true }))
  assert.deepEqual(r.acoes.at(-1), { tipo: 'paraLinha', texto: 'EX' }, 'E + X no sketch deve gerar EX')
})

// Teclas de funcao fora do despachante.
test('F3 passa sem mudar o estado', () => {
  const r = despacha(estadoInicial(), k('F3'), com())
  assert.deepEqual(r.acoes, [{ tipo: 'passa' }], 'F3 nao e do despachante')
  assert.deepEqual(r.estado, estadoInicial())
})

// Tab e Esc.
test('Tab: ocioso alterna sketch, em comando vai ao proximo campo', () => {
  assert.deepEqual(despacha(estadoInicial(), k('Tab'), ctx()).acoes, [{ tipo: 'alternaSketch' }], 'Tab ocioso deve alternar sketch')
  assert.deepEqual(despacha(estadoInicial(), k('Tab'), ctx({ emComando: true })).acoes, [{ tipo: 'proximoCampo' }], 'Tab em comando deve ir ao proximo campo')
})

test('Esc: ocioso limpa selecao, em comando cancela comando', () => {
  assert.deepEqual(despacha(estadoInicial(), k('Escape'), com()).acoes, [{ tipo: 'limpaSelecao' }], 'Esc ocioso deve limpar selecao')
  assert.deepEqual(despacha(estadoInicial(), k('Escape'), ctx({ emComando: true })).acoes, [{ tipo: 'cancelaComando' }], 'Esc em comando deve cancelar comando')
})

// Shift.
test('Shift+A: menu de adicionar', () => {
  const r = despacha(estadoInicial(), k('A', { shift: true }), ctx({ selecao: 0 }))
  assert.deepEqual(r.acoes, [{ tipo: 'menuAdicionar' }], 'Shift+A deve abrir o menu de adicionar')
})

test('Shift+D com selecao fora do sketch: duplicaMove', () => {
  const r = despacha(estadoInicial(), k('D', { shift: true }), com({ noSketch: false }))
  assert.deepEqual(r.acoes, [{ tipo: 'duplicaMove' }], 'Shift+D com selecao deve duplicar e mover')
})

test('Shift+H com selecao fora do sketch: isola', () => {
  const r = despacha(estadoInicial(), k('H', { shift: true }), com({ noSketch: false }))
  assert.deepEqual(r.acoes, [{ tipo: 'isola' }], 'Shift+H fora do sketch deve isolar')
})

test('Shift+X em transformacao: eixo X com plano', () => {
  const r1 = despacha(estadoInicial(), k('R'), com())
  const r2 = despacha(r1.estado, k('X', { shift: true }), com())
  assert.deepEqual(r2.acoes, [{ tipo: 'eixo', eixo: 'X', plano: true }], 'Shift+X deve travar o plano perpendicular a X')
  assert.deepEqual(r2.estado, { fase: 'transforma', letra: 'R', eixo: 'X', plano: true, numero: '' })
})

// Transformacao com eixo e numero.
test('G, X, 5, 0, Enter: sequencia completa e volta a ocioso', () => {
  const r = sequencia([k('G'), k('X'), k('5'), k('0'), k('Enter')], com())
  assert.deepEqual(r.acoes, [
    { tipo: 'iniciaTransformacao', letra: 'G' },
    { tipo: 'eixo', eixo: 'X', plano: false },
    { tipo: 'numero', texto: '5' },
    { tipo: 'numero', texto: '50' },
    { tipo: 'confirmaTransformacao' },
  ], 'sequencia de G X 5 0 Enter')
  assert.deepEqual(r.estado, estadoInicial(), 'deve voltar a ocioso')
})

test('G e Esc: cancela a transformacao', () => {
  const r = sequencia([k('G'), k('Escape')], com())
  assert.deepEqual(r.acoes.at(-1), { tipo: 'cancelaTransformacao' }, 'Esc deve cancelar a transformacao')
  assert.deepEqual(r.estado, estadoInicial())
})

test('G, 1, 2, Backspace: edita o numero', () => {
  const r = sequencia([k('G'), k('1'), k('2'), k('Backspace')], com())
  assert.deepEqual(r.acoes.at(-1), { tipo: 'numero', texto: '1' }, 'Backspace deve remover o ultimo caractere')
  assert.equal(r.estado.fase, 'transforma')
})

// Cota D.
test('D no sketch com selecao: inicia cota', () => {
  const r = despacha(estadoInicial(), k('D'), com({ noSketch: true }))
  assert.deepEqual(r.acoes, [{ tipo: 'iniciaCota' }], 'D no sketch deve iniciar cota')
  assert.deepEqual(r.estado, { fase: 'restricao', letra: 'D' })
})

test('D seguido de I: cancela cota e cola DI', () => {
  const r = sequencia([k('D'), k('I')], com({ noSketch: true }))
  assert.deepEqual(r.acoes.slice(1), [{ tipo: 'cancelaCota' }, { tipo: 'paraLinha', texto: 'DI' }], 'D + I deve gerar DI')
})

// Regra 2b: confirmacao da restricao e letras que nao sao restricao.
test('H, Enter: confirma e volta a ocioso', () => {
  const r = sequencia([k('H'), k('Enter')], com({ noSketch: true }))
  assert.deepEqual(r.acoes.at(-1), { tipo: 'confirmaRestricao' }, 'Enter deve confirmar a restricao')
  assert.deepEqual(r.estado, estadoInicial())
})

test('H, Escape: confirma a restricao', () => {
  const r = sequencia([k('H'), k('Escape')], com({ noSketch: true }))
  assert.deepEqual(r.acoes.at(-1), { tipo: 'confirmaRestricao' }, 'Esc deve confirmar a restricao')
})

test('V, 5: confirma e cola o digito na linha', () => {
  const r = sequencia([k('V'), k('5')], com({ noSketch: true }))
  assert.deepEqual(r.acoes.slice(1), [{ tipo: 'confirmaRestricao' }, { tipo: 'paraLinha', texto: '5' }], 'digito deve confirmar e ir para a linha')
  assert.deepEqual(r.estado, estadoInicial())
})

test('D, 5: o digito fica para a ferramenta de cota (passa)', () => {
  const r = sequencia([k('D'), k('5')], com({ noSketch: true }))
  assert.deepEqual(r.acoes.slice(1), [{ tipo: 'confirmaRestricao' }, { tipo: 'passa' }], 'na cota o digito e consumido pela ferramenta')
})

test('no sketch com selecao, L, C, A, O vao direto para a linha (sem restricao)', () => {
  for (const letra of ['L', 'C', 'A', 'O']) {
    const r = despacha(estadoInicial(), k(letra), com({ noSketch: true }))
    assert.deepEqual(r.acoes, [{ tipo: 'paraLinha', texto: letra }], `${letra} deve ir direto para a linha`)
    assert.deepEqual(r.estado, estadoInicial(), `${letra} nao deve entrar em restricao`)
  }
})

test('REC, RO e SC digitados com selecao', () => {
  const ro = sequencia([k('R'), k('O')], com())
  assert.deepEqual(ro.acoes.at(-1), { tipo: 'paraLinha', texto: 'RO' }, 'R + O deve gerar RO')
  const sc = sequencia([k('S'), k('C')], com())
  assert.deepEqual(sc.acoes.at(-1), { tipo: 'paraLinha', texto: 'SC' }, 'S + C deve gerar SC')
  const rec = sequencia([k('R'), k('E')], com())
  const c = despacha(rec.estado, k('C'), ctx({ linhaVazia: false }))
  assert.deepEqual(c.acoes, [{ tipo: 'paraLinha', texto: 'C' }], 'REC deve completar na linha')
})

// Preferencia imediatasBlender desligada: nenhuma letra e imediata.
test('imediatasBlender=false: G vai para a linha; Tab, Esc e Del continuam', () => {
  const off = com({ imediatasBlender: false })
  assert.deepEqual(despacha(estadoInicial(), k('G'), off).acoes, [{ tipo: 'paraLinha', texto: 'G' }], 'G nao deve ser imediata')
  assert.deepEqual(despacha(estadoInicial(), k('Tab'), off).acoes, [{ tipo: 'alternaSketch' }], 'Tab continua imediata')
  assert.deepEqual(despacha(estadoInicial(), k('Escape'), off).acoes, [{ tipo: 'limpaSelecao' }], 'Esc continua imediata')
  assert.deepEqual(despacha(estadoInicial(), k('Delete'), off).acoes, [{ tipo: 'apaga' }], 'Del continua imediata')
})

// Ctrl e Alt.
test('Ctrl+A seleciona tudo; Ctrl+Z passa', () => {
  assert.deepEqual(despacha(estadoInicial(), k('a', { ctrl: true }), ctx()).acoes, [{ tipo: 'selecionaTudo' }], 'Ctrl+A deve selecionar tudo')
  assert.deepEqual(despacha(estadoInicial(), k('z', { ctrl: true }), ctx()).acoes, [{ tipo: 'passa' }], 'Ctrl+Z e tratado fora')
})

test('Alt+H mostra tudo; Alt+A limpa a selecao toda', () => {
  assert.deepEqual(despacha(estadoInicial(), k('h', { alt: true }), com()).acoes, [{ tipo: 'mostraTudo' }], 'Alt+H deve mostrar tudo')
  assert.deepEqual(despacha(estadoInicial(), k('a', { alt: true }), com()).acoes, [{ tipo: 'limpaSelecaoTudo' }], 'Alt+A deve limpar a selecao')
})

// Enter e espaco com linha vazia repetem o comando.
test('Enter e espaco com linha vazia repetem; com linha nao vazia passam', () => {
  assert.deepEqual(despacha(estadoInicial(), k('Enter'), ctx()).acoes, [{ tipo: 'repete' }], 'Enter com linha vazia deve repetir')
  assert.deepEqual(despacha(estadoInicial(), k(' '), ctx()).acoes, [{ tipo: 'repete' }], 'espaco com linha vazia deve repetir')
  assert.deepEqual(despacha(estadoInicial(), k('Enter'), ctx({ linhaVazia: false })).acoes, [{ tipo: 'passa' }], 'Enter com linha nao vazia passa')
})

// Pureza: mesma entrada, mesmo resultado; entradas nao mudam.
test('pureza: despacha duas vezes com o mesmo estado da o mesmo resultado sem mutar a entrada', () => {
  const estado: Estado = Object.freeze({ fase: 'transforma', letra: 'R', eixo: null, plano: false, numero: '1' }) as Estado
  const tecla = Object.freeze(k('X', { shift: true }))
  const contexto = Object.freeze(com())
  const r1 = despacha(estado, tecla, contexto)
  const r2 = despacha(estado, tecla, contexto)
  assert.deepEqual(r1, r2, 'duas chamadas com a mesma entrada devem dar o mesmo resultado')
  assert.deepEqual(estado, { fase: 'transforma', letra: 'R', eixo: null, plano: false, numero: '1' }, 'o estado de entrada nao pode mudar')
})
