// Despachante de teclado puro (PROJETO_BASE 7.3): sem DOM.
// Recebe o estado, a tecla e o contexto; devolve o novo estado e as acoes.
// Nao muta nenhum dos argumentos.

export interface Tecla { key: string; ctrl?: boolean; alt?: boolean; shift?: boolean }
export interface Ctx {
  noSketch: boolean
  selecao: number
  linhaVazia: boolean
  emComando: boolean
  imediatasBlender: boolean
}
export type Letra = 'G' | 'R' | 'S'
export type LetraRestricao = 'H' | 'V' | 'I' | 'T' | 'E' | 'B'
export type Estado =
  | { fase: 'ocioso' }
  | { fase: 'transforma'; letra: Letra; eixo: 'X' | 'Y' | 'Z' | null; plano: boolean; numero: string }
  | { fase: 'restricao'; letra: LetraRestricao | 'D' }
export type Acao =
  | { tipo: 'iniciaTransformacao'; letra: Letra }
  | { tipo: 'eixo'; eixo: 'X' | 'Y' | 'Z'; plano: boolean }
  | { tipo: 'numero'; texto: string }
  | { tipo: 'confirmaTransformacao' } | { tipo: 'cancelaTransformacao' }
  | { tipo: 'aplicaRestricao'; letra: LetraRestricao }
  | { tipo: 'iniciaCota' }
  | { tipo: 'desfazRestricao' }
  | { tipo: 'cancelaCota' }
  | { tipo: 'confirmaRestricao' }
  | { tipo: 'paraLinha'; texto: string }
  | { tipo: 'alternaSketch' } | { tipo: 'proximoCampo' }
  | { tipo: 'cancelaComando' } | { tipo: 'limpaSelecao' }
  | { tipo: 'apaga' } | { tipo: 'apagaConfirma' }
  | { tipo: 'esconde' } | { tipo: 'mostraTudo' } | { tipo: 'isola' }
  | { tipo: 'menuAdicionar' } | { tipo: 'duplicaMove' }
  | { tipo: 'selecionaTudo' } | { tipo: 'limpaSelecaoTudo' }
  | { tipo: 'repete' }
  | { tipo: 'passa' }

const RESTRICOES: readonly string[] = ['H', 'V', 'I', 'T', 'E', 'B']

function ehRestricao(x: string): x is LetraRestricao {
  return RESTRICOES.includes(x)
}

export function estadoInicial(): Estado {
  return { fase: 'ocioso' }
}

export function despacha(e: Estado, t: Tecla, c: Ctx): { estado: Estado; acoes: Acao[] } {
  const k = t.key
  const L = /^[A-Za-z]$/.test(k) ? k.toUpperCase() : null
  const plano = t.shift === true
  const retorna = (estado: Estado, ...acoes: Acao[]) => ({ estado, acoes })
  const passa = () => retorna(e, { tipo: 'passa' })

  // Regra 0: Ctrl sem Alt. Em restricao, confirma a restricao.
  if (t.ctrl && !t.alt) {
    if (e.fase === 'restricao') return retorna(estadoInicial(), { tipo: 'confirmaRestricao' })
    return L === 'A' ? retorna(e, { tipo: 'selecionaTudo' }) : passa()
  }
  // Regra 5: Alt. So H e A tem acao; o resto segue o fluxo normal.
  if (t.alt) {
    if (L === 'H') return retorna(e, { tipo: 'mostraTudo' })
    if (L === 'A') return retorna(e, { tipo: 'limpaSelecaoTudo' })
    return passa()
  }

  // Regra 2a: transformacao em andamento (G/R/S).
  if (e.fase === 'transforma') {
    if (L === 'X' || L === 'Y' || L === 'Z') {
      return retorna({ ...e, eixo: L, plano }, { tipo: 'eixo', eixo: L, plano })
    }
    if (/^[0-9.-]$/.test(k)) {
      const texto = e.numero + k
      return retorna({ ...e, numero: texto }, { tipo: 'numero', texto })
    }
    if (k === 'Backspace') {
      const texto = e.numero.slice(0, -1)
      return retorna({ ...e, numero: texto }, { tipo: 'numero', texto })
    }
    if (k === 'Enter') return retorna(estadoInicial(), { tipo: 'confirmaTransformacao' })
    if (k === 'Escape') return retorna(estadoInicial(), { tipo: 'cancelaTransformacao' })
    if (L) {
      return retorna(
        estadoInicial(),
        { tipo: 'cancelaTransformacao' },
        { tipo: 'paraLinha', texto: e.letra + L },
      )
    }
    return passa()
  }

  // Regra 2b: restricao ja aplicada (H V I T E B ou D da cota).
  if (e.fase === 'restricao') {
    if (L) {
      const desfaz: Acao = e.letra === 'D' ? { tipo: 'cancelaCota' } : { tipo: 'desfazRestricao' }
      return retorna(estadoInicial(), desfaz, { tipo: 'paraLinha', texto: e.letra + L })
    }
    const confirma: Acao = { tipo: 'confirmaRestricao' }
    if (k.length === 1) {
      // Imprimivel nao-letra: na cota o digito e da ferramenta (passa); senao vai para a linha.
      const depois: Acao = e.letra === 'D' ? { tipo: 'passa' } : { tipo: 'paraLinha', texto: k }
      return retorna(estadoInicial(), confirma, depois)
    }
    return retorna(estadoInicial(), confirma)
  }

  // Fase ocioso. Regra 3: teclas sempre imediatas.
  if (k === 'Tab') return c.emComando ? retorna(e, { tipo: 'proximoCampo' }) : retorna(e, { tipo: 'alternaSketch' })
  if (k === 'Escape') return c.emComando ? retorna(e, { tipo: 'cancelaComando' }) : retorna(e, { tipo: 'limpaSelecao' })
  if (k === 'Delete') return c.selecao > 0 ? retorna(e, { tipo: 'apaga' }) : passa()
  if (k === 'Enter' || k === ' ') {
    return c.linhaVazia && !c.emComando ? retorna(e, { tipo: 'repete' }) : passa()
  }

  if (L) {
    // Regra 2: letras imediatas (so com preferencia Blender, selecao, linha vazia e fora de comando).
    if (c.selecao > 0 && c.linhaVazia && !c.emComando && c.imediatasBlender) {
      if (L === 'G' || L === 'R' || L === 'S') {
        return retorna({ fase: 'transforma', letra: L, eixo: null, plano: false, numero: '' }, { tipo: 'iniciaTransformacao', letra: L })
      }
      if (L === 'X') return retorna(e, { tipo: 'apagaConfirma' })
      if (!c.noSketch) {
        if (L === 'H') return retorna(e, t.shift ? { tipo: 'isola' } : { tipo: 'esconde' })
        if (L === 'D' && t.shift) return retorna(e, { tipo: 'duplicaMove' })
      } else {
        if (ehRestricao(L)) return retorna({ fase: 'restricao', letra: L }, { tipo: 'aplicaRestricao', letra: L })
        if (L === 'D') return retorna({ fase: 'restricao', letra: 'D' }, { tipo: 'iniciaCota' })
      }
    }
    if (L === 'A' && t.shift && c.linhaVazia && !c.emComando && c.imediatasBlender) {
      return retorna(e, { tipo: 'menuAdicionar' })
    }
    // Regra 1: qualquer outra letra vai para a linha de comando (AutoCAD puro).
    return retorna(e, { tipo: 'paraLinha', texto: L })
  }

  // Regra 1: digitos e demais imprimiveis vao para a linha de comando.
  if (k.length === 1) return retorna(e, { tipo: 'paraLinha', texto: k })
  return passa()
}
