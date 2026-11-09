export type Parametros = Record<string, { expr: string }>
export type Resultado = { ok: true; valor: number } | { ok: false; erro: string }

type Op = '+' | '-' | '*' | '/' | '(' | ')' | ','
type Tok = { t: 'num'; v: number } | { t: 'id'; nome: string } | { t: 'op'; s: Op }

type No =
  | { k: 'num'; v: number }
  | { k: 'id'; nome: string }
  | { k: 'neg'; e: No }
  | { k: 'bin'; op: '+' | '-' | '*' | '/'; a: No; b: No }
  | { k: 'call'; nome: string; args: No[] }

class ErroExpr extends Error {}
const erro = (msg: string): ErroExpr => new ErroExpr(msg)

const CONSTANTES: Record<string, number> = { pi: Math.PI }
const grau = (x: number): number => (x * Math.PI) / 180

const FUNCOES: Record<string, { min: number; max: number; ex: string; f: (...a: number[]) => number }> = {
  min: { min: 1, max: Infinity, ex: 'min(3,5)', f: (...a) => Math.min(...a) },
  max: { min: 1, max: Infinity, ex: 'max(3,5)', f: (...a) => Math.max(...a) },
  round: { min: 1, max: 1, ex: 'round(2.5)', f: (x) => Math.round(x) },
  floor: { min: 1, max: 1, ex: 'floor(2.7)', f: (x) => Math.floor(x) },
  ceil: { min: 1, max: 1, ex: 'ceil(2.1)', f: (x) => Math.ceil(x) },
  abs: { min: 1, max: 1, ex: 'abs(-4)', f: (x) => Math.abs(x) },
  sqrt: {
    min: 1, max: 1, ex: 'sqrt(16)',
    f: (x) => {
      if (x < 0) throw erro('Raiz de número negativo. Use sqrt com valor maior ou igual a 0, como sqrt(16).')
      return Math.sqrt(x)
    },
  },
  sin: { min: 1, max: 1, ex: 'sin(30)', f: (x) => Math.sin(grau(x)) },
  cos: { min: 1, max: 1, ex: 'cos(60)', f: (x) => Math.cos(grau(x)) },
  tan: { min: 1, max: 1, ex: 'tan(45)', f: (x) => Math.tan(grau(x)) },
}

const OPS = '+-*/(),'

function tokeniza(texto: string): Tok[] {
  const toks: Tok[] = []
  const reNum = /\d+\.?\d*|\.\d+/y
  const reId = /[A-Za-z_][A-Za-z0-9_]*/y
  let i = 0
  while (i < texto.length) {
    const c = texto[i]
    if (/\s/.test(c)) { i++; continue }
    if (OPS.includes(c)) { toks.push({ t: 'op', s: c as Op }); i++; continue }
    reNum.lastIndex = i
    const mn = reNum.exec(texto)
    if (mn) { toks.push({ t: 'num', v: Number(mn[0]) }); i = reNum.lastIndex; continue }
    reId.lastIndex = i
    const mi = reId.exec(texto)
    if (mi) { toks.push({ t: 'id', nome: mi[0] }); i = reId.lastIndex; continue }
    throw erro(`Caractere "${c}" não é válido. Use números, parâmetros, + - * /, parênteses e funções.`)
  }
  return toks
}

const txt = (t: Tok): string => (t.t === 'num' ? String(t.v) : t.t === 'id' ? t.nome : t.s)

// Gramática: expr = termo (('+'|'-') termo)* ; termo = unario (('*'|'/') unario)* ;
// unario = ('+'|'-') unario | primario ; primario = num | id | id '(' args ')' | '(' expr ')'
function parse(texto: string): No {
  const toks = tokeniza(texto)
  if (toks.length === 0) throw erro('Expressão vazia. Digite um valor, como 80.')
  let i = 0

  const aceita = (...ops: Op[]): Op | undefined => {
    const t = toks[i]
    if (t?.t === 'op' && ops.includes(t.s)) { i++; return t.s }
    return undefined
  }

  const expr = (): No => {
    let no = termo()
    let op = aceita('+', '-')
    while (op === '+' || op === '-') { no = { k: 'bin', op, a: no, b: termo() }; op = aceita('+', '-') }
    return no
  }

  const termo = (): No => {
    let no = unario()
    let op = aceita('*', '/')
    while (op === '*' || op === '/') { no = { k: 'bin', op, a: no, b: unario() }; op = aceita('*', '/') }
    return no
  }

  const unario = (): No => {
    if (aceita('-')) return { k: 'neg', e: unario() }
    if (aceita('+')) return unario()
    return primario()
  }

  const primario = (): No => {
    const t = toks[i]
    if (!t) throw erro('Expressão incompleta. Complete-a com um valor após o operador, como 2*3.')
    if (t.t === 'num') { i++; return { k: 'num', v: t.v } }
    if (t.t === 'id') {
      i++
      if (!aceita('(')) return { k: 'id', nome: t.nome }
      if (!Object.hasOwn(FUNCOES, t.nome)) {
        throw erro(`Função "${t.nome}" não existe. Use min, max, round, floor, ceil, sqrt, abs, sin, cos ou tan.`)
      }
      const args: No[] = []
      if (!aceita(')')) {
        do { args.push(expr()) } while (aceita(','))
        if (!aceita(')')) throw erro('Parêntese aberto sem fechar. Feche com ")".')
      }
      const f = FUNCOES[t.nome]
      if (args.length < f.min || args.length > f.max) {
        throw erro(f.min === f.max
          ? `Função "${t.nome}" recebe ${f.min} argumento(s), mas recebeu ${args.length}. Ex.: ${f.ex}.`
          : `Função "${t.nome}" precisa de pelo menos ${f.min} argumento(s). Ex.: ${f.ex}.`)
      }
      return { k: 'call', nome: t.nome, args }
    }
    if (aceita('(')) {
      const dentro = expr()
      if (!aceita(')')) throw erro('Parêntese aberto sem fechar. Feche com ")".')
      return dentro
    }
    if (t.s === ')') throw erro('Parêntese ")" sem abertura. Remova-o ou abra um "(" antes.')
    throw erro(`Operador "${t.s}" sem valor antes. Coloque um número ou parâmetro antes dele.`)
  }

  const r = expr()
  const sobra = toks[i]
  if (sobra) {
    if (sobra.t === 'op' && sobra.s === ')') throw erro('Parêntese ")" sem abertura. Remova-o ou abra um "(" antes.')
    throw erro(`Sobrou "${txt(sobra)}" no fim da expressão. Remova-o ou corrija a sintaxe.`)
  }
  return r
}

type Ctx = { params: Parametros; pilha: string[] }

function valorDe(nome: string, ctx: Ctx): number {
  if (Object.hasOwn(CONSTANTES, nome)) return CONSTANTES[nome]
  if (!Object.hasOwn(ctx.params, nome)) {
    if (Object.hasOwn(FUNCOES, nome)) throw erro(`Função "${nome}" precisa de parênteses, como ${FUNCOES[nome].ex}.`)
    throw erro(`Parâmetro "${nome}" não existe. Crie-o com o comando PARAM.`)
  }
  if (ctx.pilha.includes(nome)) {
    const ciclo = [...ctx.pilha.slice(ctx.pilha.indexOf(nome)), nome]
    throw erro(`Referência circular: ${ciclo.join(' -> ')}. Remova a dependência.`)
  }
  return calc(parse(ctx.params[nome].expr), { params: ctx.params, pilha: [...ctx.pilha, nome] })
}

function calc(no: No, ctx: Ctx): number {
  switch (no.k) {
    case 'num': return no.v
    case 'neg': return -calc(no.e, ctx)
    case 'id': return valorDe(no.nome, ctx)
    case 'call': return FUNCOES[no.nome].f(...no.args.map((a) => calc(a, ctx)))
    case 'bin': {
      const a = calc(no.a, ctx)
      const b = calc(no.b, ctx)
      if (no.op === '+') return a + b
      if (no.op === '-') return a - b
      if (no.op === '*') return a * b
      if (b === 0) throw erro('Divisão por zero. Troque o divisor por outro valor.')
      return a / b
    }
  }
}

/** Avalia `texto` com os parâmetros. Um parâmetro cuja expr referencia outros é avaliado recursivamente. Nunca lança. */
export function avalia(texto: string, parametros: Parametros = {}): Resultado {
  try {
    const valor = calc(parse(texto), { params: parametros, pilha: [] })
    if (!Number.isFinite(valor)) return { ok: false, erro: 'Resultado não é um número finito. Verifique os valores.' }
    return { ok: true, valor }
  } catch (e) {
    if (e instanceof ErroExpr) return { ok: false, erro: e.message }
    return { ok: false, erro: 'Erro inesperado ao avaliar a expressão. Verifique o texto.' }
  }
}

/** Nomes de identificadores usados em `texto` que NÃO são função nem constante (ex.: 'L', 'parede'). Sem repetir. Texto inválido -> []. */
export function dependencias(texto: string): string[] {
  let ast: No
  try { ast = parse(texto) } catch { return [] }
  const nomes: string[] = []
  const visita = (no: No): void => {
    switch (no.k) {
      case 'num': return
      case 'neg': visita(no.e); return
      case 'bin': visita(no.a); visita(no.b); return
      case 'id':
        if (!Object.hasOwn(CONSTANTES, no.nome) && !Object.hasOwn(FUNCOES, no.nome) && !nomes.includes(no.nome)) {
          nomes.push(no.nome)
        }
        return
      case 'call': no.args.forEach(visita); return
    }
  }
  visita(ast)
  return nomes
}

/** Se os parâmetros têm dependência circular (A usa B, B usa A, ou A usa A), devolve os nomes do ciclo (ex.: ['A','B']); senão null. */
export function achaCiclo(parametros: Parametros): string[] | null {
  const estado = new Map<string, 'vendo' | 'ok'>()
  const pilha: string[] = []
  const visita = (nome: string): string[] | null => {
    const e = estado.get(nome)
    if (e === 'ok') return null
    if (e === 'vendo') return pilha.slice(pilha.indexOf(nome))
    estado.set(nome, 'vendo')
    pilha.push(nome)
    for (const dep of dependencias(parametros[nome].expr)) {
      if (!Object.hasOwn(parametros, dep)) continue
      const ciclo = visita(dep)
      if (ciclo) return ciclo
    }
    pilha.pop()
    estado.set(nome, 'ok')
    return null
  }
  for (const nome of Object.keys(parametros)) {
    const ciclo = visita(nome)
    if (ciclo) return ciclo
  }
  return null
}
