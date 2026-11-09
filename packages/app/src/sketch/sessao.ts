// Controlador do modo sketch, sem DOM: liga o projeto às ferramentas de desenho (ferramenta.ts), aos editores (editor.ts),
// à seleção, às restrições por letra e às cotas (DIM). A tela só chama estes métodos e lê o estado.
import type { Comando, Documento } from '@3dm/core/doc'
import { avalia } from '@3dm/core/expr'
import type { Alvo, Pt, SketchFeature, TipoRestSk } from '@3dm/core/sketch'
import {
  acha, achaSketch, adicionaRestricao, aplicaAdicao, ancoraCota, apagar, criarSketch, detectaPerfis, dimInteligente, ehSketch, editaExprCota,
  editaSketch, escalar, girar, infere, mover, normalizaExpr, pontosDe, porRetangulo, resolveSnap, sketchResolvido, todas,
} from '@3dm/core/sketch'
import type { Projeto } from '../projeto.ts'
import type { EstadoModos } from '../status.ts'
import type { Ferramenta, FabricaFerramenta, EntradaFerr, Forma, Passo } from './ferramenta.ts'
import type { Editor, Resp } from './editor.ts'
import * as fa from './ferramentas-a.ts'
import * as fb from './ferramentas-b.ts'
import { EDITORES } from './editores.ts'
import { parseCoord, resolveCoord } from '../teclado/coordenadas.ts'
import type { Entrada } from '../teclado/coordenadas.ts'
import type { Acao, LetraRestricao } from '../teclado/despachante.ts'
import { T } from '../textos.ts'

export interface Deps {
  projeto: Projeto
  escreve(texto: string, tipo: 'info' | 'erro' | 'prompt'): void   // linha de comando
  modos(): EstadoModos                                              // OSNAP/ORTHO/POLAR/GRID/SNAP atuais
  mmPorPixel(): number                                              // para tolerâncias de clique (tol = 8 px)
  confirma(texto: string): boolean                                  // diálogo (X apaga com confirmação)
}
export interface SessaoSketch {
  readonly ativo: boolean
  readonly sketchId: string | null
  readonly selecao: ReadonlySet<string>
  readonly ultimoPonto: Pt | null        // último ponto da ferramenta ativa (base do DYN)
  readonly prompt: string | null          // prompt da ferramenta/editor/cota ativa
  readonly opcoes: string[]
  readonly ferramenta: string | null      // nome da ferramenta/editor/'DIM' ativa
  entra(base?: 'XY' | 'XZ' | 'YZ'): void  // sem base: reabre o ÚLTIMO sketch do documento; se não houver, cria um XY. Com base: cria um sketch novo naquele plano (offset 0). Escreve T.sk.entrou.
  sai(): void
  /** Inicia ferramenta ('LINHA'...'SLOT','PONTO','CONSTRUCAO'), editor (chaves de EDITORES) ou 'DIM'. Fora do sketch, entra num sketch XY automaticamente. */
  inicia(nome: string): void
  clique(p: Pt, opc?: { shift?: boolean; mais?: boolean }): void    // ponto no plano (mm). Passa por snap/ortho/polar/grade. Sem ferramenta ativa = seleção por clique (acha; shift/mais = alterna no conjunto).
  janela(a: Pt, b: Pt, opc?: { mais?: boolean }): void              // seleção por retângulo (porRetangulo)
  /** Texto digitado na linha de comando COM ferramenta/editor/DIM ativo. Devolve true se consumiu. */
  texto(t: string): boolean
  enter(): void   // finaliza o que for finalizável (polilinha, seleção do editor, aceitar valor da cota); sem nada ativo: não faz nada
  esc(): void     // cancela ferramenta/editor/DIM; sem nada ativo: limpa a seleção
  cursor(p: Pt, opc?: { shift?: boolean }): { alvo: Alvo | null; previa: Forma[] }   // guarda p como "cursor atual" (para distância direta)
  seleciona(ids: string[]): void; limpaSelecao(): void; selecionaTudo(): void
  aplicaRestricao(letra: LetraRestricao): boolean   // pela seleção; false (e mensagem T.sk.restricaoInvalida) se não serve
  apaga(confirmar: boolean): void         // apaga a seleção (editaSketch + apagar); X usa confirmar=true (deps.confirma)
  /** Transformação modal (G/R/S) em andamento; null se não há. */
  readonly transformacao: { letra: 'G' | 'R' | 'S'; eixo: 'X' | 'Y' | null; plano: boolean; numero: string } | null
  /** Inicia G (mover), R (girar) ou S (escalar) pela seleção, a partir do cursor atual. Exige seleção. */
  iniciaTransformacao(letra: 'G' | 'R' | 'S'): void
  /** X/Y travam o eixo; Z é ignorado no 2D; plano=true (Shift+X...) não trava nada. */
  eixoTransformacao(eixo: 'X' | 'Y' | 'Z', plano: boolean): void
  /** Número digitado (acumulado); aceita expressão simples (avalia). */
  numeroTransformacao(texto: string): void
  /** Executa a transformação como UM comando (desfazível). Enter e clique chamam isto. */
  confirmaTransformacao(): void
  cancelaTransformacao(): void
  /** Executa uma ação do despachante de teclado. true = tratou; false = o chamador trata. Sem sketch ativo só alterna o sketch. */
  acao(a: Acao): boolean
  /** Estado para desenhar/inspecionar: sketch resolvido (sketchResolvido) do sketch ativo. Com transformação, prévia (cópia) já transformada. */
  vista(): ReturnType<typeof sketchResolvido>
  inspeciona(): object    // {ativo, sketchId, entidades, restricoes, estado, dof, culpadas, erros, perfis, pontasSoltas, autointersecoes, selecao, ferramenta, prompt, opcoes, transformacao}
  aoMudar(f: () => void): void   // chamado quando algo visível mudou (ferramenta, seleção, doc)
}

type DimBase = NonNullable<ReturnType<typeof dimInteligente>>
type TipoR = keyof typeof T.sk.restricaoNomes
interface ModoFerr { k: 'ferr'; f: Ferramenta; passo: Passo; mapa: Map<string, string> }
interface ModoEd { k: 'ed'; ed: Editor; resps: Resp[] }
interface ModoDim { k: 'dim'; ids: string[]; base: DimBase | null }
type Modo = ModoFerr | ModoEd | ModoDim
/** Transformação G/R/S em andamento: ids da seleção no início, ponto de partida e centro (baricentro). */
interface Transf { letra: 'G' | 'R' | 'S'; eixo: 'X' | 'Y' | null; plano: boolean; numero: string; ids: string[]; partida: Pt; centro: Pt }

const PRENDE = new Set(['MOVER', 'GIRAR', 'ESCALAR']) // editores que movem o que já existia: os pontos movidos ficam presos na solução

const FERRAMENTAS: Record<string, FabricaFerramenta> = {
  LINHA: fa.linha, POLILINHA: fa.polilinha, RETANGULO: fa.retangulo, PONTO: fa.ponto, CONSTRUCAO: fa.construcao,
  CIRCULO: fb.circulo, ARCO: fb.arco, POLIGONO: fb.poligono, SLOT: fb.slot,
}

const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase()
/** Opção digitada (palavra inteira ou inicial, sem maiúsculas nem acento) que casa com uma das `opcoes`, ou null. */
function achaOpcao(t: string, opcoes: string[]): string | null {
  const d = norm(t)
  return d === '' ? null : (opcoes.find(o => d === norm(o) || d === norm(o)[0]) ?? null)
}
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e))
const curva = (t: string | undefined) => t === 'linha' || t === 'circulo' || t === 'arco'
const circ = (t: string | undefined) => t === 'circulo' || t === 'arco'

/** Restrições que uma letra gera para a seleção (uma por entrada), ou null se a seleção não serve. */
function restricoesPara(letra: LetraRestricao, ids: string[], sk: SketchFeature): { tipo: TipoR; e: string[] }[] | null {
  const tipos = ids.map(id => sk.entidades.find(x => x.id === id)?.tipo)
  const dois = ids.length === 2
  const pontos = tipos.filter(t => t === 'ponto').length
  const todasLinha = ids.length > 0 && tipos.every(t => t === 'linha')
  switch (letra) {
    case 'H':
    case 'V': {
      const tipo = letra === 'H' ? 'horizontal' : 'vertical'
      if (todasLinha) return ids.map(e => ({ tipo, e: [e] }))
      return dois && pontos === 2 ? [{ tipo, e: ids }] : null
    }
    case 'I': {
      if (dois && pontos === 2) return [{ tipo: 'coincidente', e: ids }]
      if (dois && pontos === 1) {
        const ip = tipos.indexOf('ponto'), ic = 1 - ip
        return curva(tipos[ic]) ? [{ tipo: 'pontoNaCurva', e: [ids[ip], ids[ic]] }] : null
      }
      return null
    }
    case 'T': return dois && tipos.every(curva) ? [{ tipo: 'tangente', e: ids }] : null
    case 'E': return dois && (todasLinha || tipos.every(circ)) ? [{ tipo: 'igual', e: ids }] : null
    case 'B': return dois && todasLinha ? [{ tipo: 'paralela', e: ids }] : null
    default: return null
  }
}

/** Baricentro dos pontos que a seleção move (pontosDe). */
function centroDe(sk: SketchFeature, ids: string[]): Pt {
  const set = new Set(pontosDe(sk, ids))
  const ps = sk.entidades.flatMap(e => (e.tipo === 'ponto' && set.has(e.id) ? [e] : []))
  const n = ps.length || 1
  return { x: ps.reduce((s, p) => s + p.x, 0) / n, y: ps.reduce((s, p) => s + p.y, 0) / n }
}

export function criaSessaoSketch(d: Deps): SessaoSketch {
  const projeto = d.projeto
  let ativo = false
  let sketchId: string | null = null
  let modo: Modo | null = null
  let cursorAtual: Pt | null = null
  let transf: Transf | null = null
  const sel = new Set<string>()
  const ouvintes: (() => void)[] = []
  const avisa = () => ouvintes.forEach(f => f())
  const tol = () => 8 * d.mmPorPixel()
  const sketchAtual = (): SketchFeature | undefined => (ativo && sketchId !== null ? achaSketch(projeto.doc, sketchId) : undefined)
  const avaliaNum = (s: string): number | null => {
    const r = avalia(s, projeto.doc.parametros)
    return r.ok ? r.valor : null
  }
  // Prévia ao vivo: cópia resolvida do sketch com a operação aplicada (o documento não muda).
  const vistaAtual = () => {
    if (!ativo || sketchId === null) return undefined
    const v = sketchResolvido(projeto.doc, sketchId)
    if (!v || !transf) return v
    try { operacao(transf).aplica(v.sk) } catch { /* fator inválido: a prévia fica sem efeito */ }
    return { ...v, perfis: detectaPerfis(v.sk) }
  }
  const transfVisivel = () => (transf ? { letra: transf.letra, eixo: transf.eixo, plano: transf.plano, numero: transf.numero } : null)
  // comandos da última restrição por letra: a regra 2b só desfaz o que ELA aplicou (e só se ainda estiverem no topo da pilha)
  let restrLetra: Comando<Documento>[] = []
  /** Roda um comando de edição; falha vira linha de erro. */
  function run(c: Comando<Documento>): boolean {
    try { projeto.executa(c); return true } catch (e) { d.escreve(msg(e), 'erro'); return false }
  }

  // Snap: OSNAP/ORTHO/POLAR/GRADE de deps.modos(). Ponto de `ref` só para extremidade/centro (id de ponto existente).
  function snapa(p: Pt, shift: boolean): Alvo | null {
    const sk = sketchAtual()
    if (!sk) return null
    const m = d.modos()
    return resolveSnap(sk, p, {
      tol: tol(), osnap: m.osnap, ortho: m.ortho, polar: m.polar, grade: m.snap, passoGrade: 1, polarGraus: 15,
      ultimo: modo?.k === 'ferr' ? modo.f.ultimo : null, shift,
    })
  }
  const pontoSnap = (p: Pt, a: Alvo | null): { p: Pt; ref?: string } =>
    a && a.ref !== undefined && (a.tipo === 'extremidade' || a.tipo === 'centro') ? { p: a.p, ref: a.ref } : { p: a?.p ?? p }

  function selecionaClique(p: Pt, mais: boolean): void {
    const sk = sketchAtual()
    if (!sk) return
    const id = acha(sk, p, tol())
    if (id === null) { if (!mais) sel.clear(); return }
    if (!mais) { sel.clear(); sel.add(id); return }
    if (sel.has(id)) sel.delete(id)
    else sel.add(id)
  }

  // ---- ferramentas ----
  function processaPasso(m: ModoFerr, r: Passo, shift: boolean): void {
    if (r.desfazUltima) projeto.desfaz() // "Desfazer" da polilinha: o último segmento era um comando de undo
    const adicao = r.adicao
    if (adicao && sketchId !== null) {
      const id = sketchId
      const ok = run(editaSketch(m.f.nome, id, sk => {
        aplicaAdicao(sk, { entidades: adicao.entidades, restricoes: [...adicao.restricoes, ...infere(sk, adicao, { suprimir: shift })] }, m.mapa)
      }))
      if (!ok) { modo = null; return }
    }
    if (r.fim) { modo = null; d.escreve(T.sk.feito(m.f.nome), 'info') }
    else { m.passo = r; d.escreve(r.prompt, 'prompt') }
  }
  const ferrEntra = (m: ModoFerr, e: EntradaFerr, shift: boolean): void => processaPasso(m, m.f.entra(e), shift)
  function ferrClique(m: ModoFerr, p: Pt, shift: boolean): void {
    ferrEntra(m, { tipo: 'ponto', ...pontoSnap(p, snapa(p, shift)) }, shift)
  }
  function resolvePonto(e: Entrada, base: Pt | null): Pt | null {
    const r = resolveCoord(e, base, cursorAtual)
    if ('erro' in r) { d.escreve(r.erro, 'erro'); return null }
    return r
  }
  function textoFerr(m: ModoFerr, t: string): void {
    const op = achaOpcao(t, m.passo.opcoes)
    if (op !== null) { ferrEntra(m, { tipo: 'opcao', opcao: op }, false); return }
    const e = parseCoord(t, avaliaNum)
    if (e === null) { d.escreve(T.ferr.invalido, 'erro'); return }
    if (e.tipo === 'dist') {
      // número puro: primeiro como valor (raio, lados...); se a ferramenta ignorou, é distância direta
      const antes = m.passo.prompt
      const r = m.f.entra({ tipo: 'valor', v: e.d })
      if (r.adicao || r.prompt !== antes) { processaPasso(m, r, false); return }
    }
    const p = resolvePonto(e, m.f.ultimo)
    if (p) ferrEntra(m, { tipo: 'ponto', p }, false)
  }

  // ---- editores ----
  function avancaEd(m: ModoEd): void {
    const passos = m.ed.passos
    // seleção já feita ao iniciar: o passo de seleção se resolve sozinho
    while (m.resps.length < passos.length && passos[m.resps.length].k === 'selecao' && sel.size) m.resps.push({ sel: [...sel] })
    if (m.resps.length < passos.length) { d.escreve(passos[m.resps.length].prompt, 'prompt'); return }
    const resps = m.resps
    const id = sketchId
    if (id === null) { modo = null; return }
    if (!run(editaSketch(m.ed.nome, id, sk => m.ed.aplica(sk, resps), { prender: PRENDE.has(m.ed.nome) }))) { modo = null; return }
    if (m.ed.repete) { m.resps = resps.slice(0, -1); d.escreve(passos[m.resps.length].prompt, 'prompt') }
    else { modo = null; d.escreve(T.sk.feito(m.ed.nome), 'info') }
  }
  function edClique(m: ModoEd, p: Pt, opc: { shift?: boolean; mais?: boolean }): void {
    const passo = m.ed.passos[m.resps.length]
    if (!passo) return
    if (passo.k === 'selecao') { selecionaClique(p, !!(opc.shift || opc.mais)); return }
    if (passo.k === 'ponto') { m.resps.push({ p: pontoSnap(p, snapa(p, !!opc.shift)).p }); avancaEd(m); return }
    if (passo.k === 'entidade') {
      const sk = sketchAtual()
      const id = sk ? acha(sk, p, tol()) : null
      if (id) { m.resps.push({ id, p }); avancaEd(m) }
    }
  }
  function textoEd(m: ModoEd, t: string): void {
    const passo = m.ed.passos[m.resps.length]
    if (!passo) return
    if (passo.k === 'opcao') {
      const op = achaOpcao(t, passo.opcoes)
      if (op === null) d.escreve(passo.prompt, 'prompt')
      else { m.resps.push({ opcao: op }); avancaEd(m) }
    } else if (passo.k === 'valor') {
      const v = avaliaNum(t)
      if (v === null) d.escreve(T.ferr.invalido, 'erro')
      else { m.resps.push({ v }); avancaEd(m) }
    } else if (passo.k === 'ponto') {
      const e = parseCoord(t, avaliaNum)
      if (e === null) { d.escreve(T.ferr.invalido, 'erro'); return }
      const ult = [...m.resps].reverse().find(r => r.p)?.p ?? null
      const p = resolvePonto(e, ult)
      if (p) { m.resps.push({ p }); avancaEd(m) }
    } else d.escreve(passo.prompt, 'prompt')
  }

  // ---- DIM (cotas) ----
  function pedeDim(m: ModoDim): void {
    d.escreve(m.base ? T.sk.dimValor(m.base.expr ?? '') : T.sk.dimSelecao, 'prompt')
  }
  function tentaDim(m: ModoDim): void {
    const sk = sketchAtual()
    const b = sk ? dimInteligente(sk, m.ids) : null
    if (b) m.base = b
    else if (m.ids.length >= 2) { d.escreve(T.sk.dimNada, 'erro'); m.ids = [] }
    pedeDim(m)
  }
  function concluiDim(b: DimBase, expr: string, ref = false): void {
    const sk = sketchAtual()
    modo = null
    if (!sk) return
    const texto = ancoraCota(sk, { id: '', tipo: b.tipo, e: b.e, expr, ref })?.texto ?? expr
    if (b.duplicada && b.existenteId) {
      if (run(editaExprCota(sk.id, b.existenteId, expr))) d.escreve(T.sk.dimEditada(texto), 'info')
    } else if (run(adicionaRestricao(sk.id, b.tipo as TipoRestSk, b.e, { expr, ref }))) {
      d.escreve(T.sk.dimCriada(texto), 'info')
    }
  }
  function textoDim(m: ModoDim, t: string): void {
    const b = m.base
    if (!b) return
    const expr = b.expr ?? ''
    const ex = t.trim()
    if (ex === '') { concluiDim(b, expr); return }
    if (achaOpcao(ex, [T.sk.opReferencia]) !== null) { concluiDim(b, expr, true); return }
    const exp = normalizaExpr(ex)
    const r = avalia(exp, projeto.doc.parametros)
    if (!r.ok) { d.escreve(T.sk.dimInvalida(r.erro), 'erro'); d.escreve(T.sk.dimValor(expr), 'prompt'); return }
    concluiDim(b, exp)
  }
  function dimClique(m: ModoDim, p: Pt): void {
    const sk = sketchAtual()
    const id = sk ? acha(sk, p, tol()) : null
    if (id && !m.ids.includes(id)) { m.ids.push(id); tentaDim(m) }
  }

  // ---- transformação modal (G/R/S) ----
  /** Operação atual: nome do comando e a mutação do sketch (a mesma para a prévia e para confirmar). */
  function operacao(t: Transf): { nome: string; aplica(sk: SketchFeature): void } {
    const cur = cursorAtual ?? t.partida
    const num = t.numero.trim() === '' ? null : avaliaNum(t.numero)
    if (t.letra === 'G') {
      let dx = cur.x - t.partida.x, dy = cur.y - t.partida.y
      if (t.eixo === 'X') dy = 0
      if (t.eixo === 'Y') dx = 0
      if (num !== null) { dx = t.eixo === 'Y' ? 0 : num; dy = t.eixo === 'Y' ? num : 0 }
      return { nome: 'MOVER', aplica: sk => mover(sk, t.ids, dx, dy) }
    }
    if (t.letra === 'R') {
      const ang = (p: Pt) => Math.atan2(p.y - t.centro.y, p.x - t.centro.x)
      const graus = num ?? ((ang(cur) - ang(t.partida)) * 180) / Math.PI
      return { nome: 'GIRAR', aplica: sk => girar(sk, t.ids, t.centro, graus) }
    }
    const dist = (p: Pt) => Math.hypot(p.x - t.centro.x, p.y - t.centro.y)
    const d0 = dist(t.partida)
    const fator = num ?? (d0 === 0 ? 1 : dist(cur) / d0)
    return { nome: 'ESCALAR', aplica: sk => escalar(sk, t.ids, t.centro, fator) }
  }
  function iniciaTransformacao(letra: 'G' | 'R' | 'S'): void {
    const sk = sketchAtual()
    if (!sk || sel.size === 0) { d.escreve(T.ed.nadaSelecionado, 'erro'); return }
    const ids = [...sel]
    const centro = centroDe(sk, ids)
    const t: Transf = { letra, eixo: null, plano: false, numero: '', ids, partida: cursorAtual ?? centro, centro }
    transf = t
    d.escreve(T.sk.transformaDica(T.sk.transforma[letra], '', ''), 'prompt')
    avisa()
  }
  function eixoTransformacao(eixo: 'X' | 'Y' | 'Z', plano: boolean): void {
    const t = transf
    if (!t || eixo === 'Z') return
    t.eixo = plano ? null : eixo
    t.plano = plano
    d.escreve(T.sk.transformaDica(T.sk.transforma[t.letra], t.eixo ?? '', t.numero), 'prompt')
    avisa()
  }
  function numeroTransformacao(texto: string): void {
    const t = transf
    if (!t) return
    t.numero = texto
    d.escreve(T.sk.transformaDica(T.sk.transforma[t.letra], t.eixo ?? '', t.numero), 'prompt')
    avisa()
  }
  function confirmaTransformacao(): void {
    const t = transf
    const id = sketchId
    if (!t || id === null) return
    const op = operacao(t)
    if (run(editaSketch(op.nome, id, sk => op.aplica(sk), { prender: true }))) {
      transf = null
      d.escreve(T.sk.feito(T.sk.transforma[t.letra]), 'info')
    }
    avisa()
  }
  function cancelaTransformacao(): void {
    if (!transf) return
    transf = null
    d.escreve(T.linha.cancelado, 'info')
    avisa()
  }

  // ---- estado de sessão ----
  function reseta(): void {
    ativo = false; sketchId = null; modo = null; sel.clear(); transf = null
  }
  const nomeAtivo = (): string | null => {
    const m = modo
    return !m ? null : m.k === 'ferr' ? m.f.nome : m.k === 'ed' ? m.ed.nome : 'DIM'
  }
  const promptAtivo = (): string | null => {
    const m = modo
    if (!m) return null
    if (m.k === 'ferr') return m.passo.prompt
    if (m.k === 'ed') return m.ed.passos[m.resps.length]?.prompt ?? null
    return m.base ? T.sk.dimValor(m.base.expr ?? '') : T.sk.dimSelecao
  }
  const opcoesAtivas = (): string[] => {
    const m = modo
    if (!m) return []
    if (m.k === 'ferr') return m.passo.opcoes
    if (m.k === 'ed') {
      const p = m.ed.passos[m.resps.length]
      return p?.k === 'opcao' ? p.opcoes : []
    }
    return m.base ? [T.sk.opReferencia] : []
  }

  // Sketch que sumiu (desfazer da criação) encerra a sessão; ids apagados saem da seleção.
  projeto.aoMudar(() => {
    const sk = sketchAtual()
    if (ativo && !sk) reseta()
    else if (sk) for (const id of [...sel]) if (!sk.entidades.some(e => e.id === id)) sel.delete(id)
    avisa()
  })

  function entra(base?: 'XY' | 'XZ' | 'YZ'): void {
    const ult = projeto.doc.features.filter(ehSketch).at(-1)
    let id: string
    let plano: 'XY' | 'XZ' | 'YZ'
    if (base || !ult) {
      const c = criarSketch({ base: base ?? 'XY', offset: 0 })
      projeto.executa(c)
      id = c.id
      plano = base ?? 'XY'
    } else {
      id = ult.id
      plano = ult.plano.base
    }
    sketchId = id
    ativo = true
    modo = null
    sel.clear()
    d.escreve(T.sk.entrou(id, T.sk.planos[plano]), 'info')
    avisa()
  }

  const s: SessaoSketch = {
    get ativo() { return ativo },
    get sketchId() { return sketchId },
    get selecao() { return sel },
    get ultimoPonto() { return modo?.k === 'ferr' ? modo.f.ultimo : null },
    get prompt() { return promptAtivo() },
    get opcoes() { return opcoesAtivas() },
    get ferramenta() { return nomeAtivo() },
    get transformacao() { return transfVisivel() },

    entra,
    sai() {
      reseta()
      d.escreve(T.sk.saiu, 'info')
      avisa()
    },
    inicia(nome) {
      if (!ativo) entra()
      modo = null
      transf = null
      if (nome === 'DIM') {
        const m: ModoDim = { k: 'dim', ids: [...sel], base: null }
        modo = m
        tentaDim(m)
      } else if (Object.hasOwn(FERRAMENTAS, nome)) {
        const f = FERRAMENTAS[nome]({ sk: sketchAtual })
        const passo = f.inicio()
        modo = { k: 'ferr', f, passo, mapa: new Map() }
        d.escreve(passo.prompt, 'prompt')
      } else if (Object.hasOwn(EDITORES, nome)) {
        const m: ModoEd = { k: 'ed', ed: EDITORES[nome].fabrica(), resps: [] }
        modo = m
        avancaEd(m)
      } else d.escreve(T.linha.desconhecido(nome), 'erro')
      avisa()
    },
    clique(p, opc = {}) {
      cursorAtual = p
      if (transf) { confirmaTransformacao(); return }
      const m = modo
      if (m?.k === 'ferr') ferrClique(m, p, !!opc.shift)
      else if (m?.k === 'ed') edClique(m, p, opc)
      else if (m?.k === 'dim') { if (!m.base) dimClique(m, p) }
      else selecionaClique(p, !!(opc.shift || opc.mais))
      avisa()
    },
    janela(a, b, opc = {}) {
      const sk = sketchAtual()
      if (!sk) return
      if (!opc.mais) sel.clear()
      for (const id of porRetangulo(sk, a, b).ids) sel.add(id)
      avisa()
    },
    texto(t) {
      const m = modo
      if (!m) return false
      if (m.k === 'ferr') textoFerr(m, t)
      else if (m.k === 'ed') textoEd(m, t)
      else textoDim(m, t)
      avisa()
      return true
    },
    enter() {
      if (transf) { confirmaTransformacao(); return }
      const m = modo
      if (!m) return
      if (m.k === 'ferr') { modo = null; d.escreve(T.sk.feito(m.f.nome), 'info') }
      else if (m.k === 'ed') {
        if (m.ed.passos[m.resps.length]?.k === 'selecao') {
          if (sel.size === 0) d.escreve(T.ed.nadaSelecionado, 'erro')
          else { m.resps.push({ sel: [...sel] }); avancaEd(m) }
        } else if (m.ed.repete) { modo = null; d.escreve(T.sk.feito(m.ed.nome), 'info') }
      } else if (m.base) concluiDim(m.base, m.base.expr ?? '')
      avisa()
    },
    esc() {
      if (transf) { cancelaTransformacao(); return }
      if (modo) { modo = null; d.escreve(T.linha.cancelado, 'info') }
      else sel.clear()
      avisa()
    },
    cursor(p, opc = {}) {
      cursorAtual = p
      const alvo = snapa(p, !!opc.shift)
      const m = modo
      const previa: Forma[] = m?.k === 'ferr' ? [...m.passo.previa, ...m.f.cursor(alvo?.p ?? p)] : []
      return { alvo, previa }
    },
    seleciona(ids) { sel.clear(); ids.forEach(id => sel.add(id)); avisa() },
    limpaSelecao() { sel.clear(); avisa() },
    selecionaTudo() {
      const sk = sketchAtual()
      if (!sk) return
      sel.clear()
      todas(sk).forEach(id => sel.add(id))
      d.escreve(T.sk.tudo, 'info')
      avisa()
    },
    aplicaRestricao(letra) {
      const sk = sketchAtual()
      const regras = sk ? restricoesPara(letra, [...sel], sk) : null
      if (!sk || !regras) { d.escreve(T.sk.restricaoInvalida(letra), 'erro'); return false }
      restrLetra = []
      for (const r of regras) {
        const c = adicionaRestricao(sk.id, r.tipo, r.e)
        if (!run(c)) return false
        restrLetra.push(c)
      }
      d.escreve(T.sk.restricao(T.sk.restricaoNomes[regras[0].tipo]), 'info')
      avisa()
      return true
    },
    apaga(confirmar) {
      const id = sketchId
      if (!ativo || id === null || sel.size === 0) return
      if (confirmar && !d.confirma(T.sk.apagarConfirma(sel.size))) return
      if (run(editaSketch('APAGAR', id, sk => apagar(sk, [...sel])))) sel.clear()
      avisa()
    },
    iniciaTransformacao,
    eixoTransformacao,
    numeroTransformacao,
    confirmaTransformacao,
    cancelaTransformacao,
    acao(a: Acao): boolean {
      if (!ativo && a.tipo !== 'alternaSketch') return false
      switch (a.tipo) {
        case 'iniciaTransformacao': iniciaTransformacao(a.letra); return true
        case 'eixo': eixoTransformacao(a.eixo, a.plano); return true
        case 'numero': numeroTransformacao(a.texto); return true
        case 'confirmaTransformacao': confirmaTransformacao(); return true
        case 'cancelaTransformacao': cancelaTransformacao(); return true
        case 'aplicaRestricao': s.aplicaRestricao(a.letra); return true
        case 'iniciaCota': s.inicia('DIM'); return true
        case 'desfazRestricao': { const cs = restrLetra; restrLetra = []; for (const c of cs.reverse()) projeto.desfazSemRefazer(c); return true }
        case 'cancelaCota': s.esc(); return true
        case 'confirmaRestricao': restrLetra = []; return true
        case 'apaga': s.apaga(false); return true
        case 'apagaConfirma': s.apaga(true); return true
        case 'selecionaTudo': s.selecionaTudo(); return true
        case 'limpaSelecaoTudo': case 'limpaSelecao': s.limpaSelecao(); return true
        case 'cancelaComando': s.esc(); return true
        case 'alternaSketch': if (ativo) s.sai(); else s.entra(); return true
        case 'proximoCampo': return true
        default: return false
      }
    },
    vista: vistaAtual,
    inspeciona() {
      const v = vistaAtual()
      return {
        ativo,
        sketchId,
        entidades: v?.sk.entidades ?? [],
        restricoes: v?.sk.restricoes.map(r => ({ id: r.id, tipo: r.tipo, e: r.e, expr: r.expr, ref: r.ref })) ?? [],
        estado: v && v.sk.entidades.length > 0 ? v.info.estado : 'vazio',
        dof: v?.info.dof ?? 0,
        culpadas: v?.info.culpadas ?? [],
        erros: v?.info.erros ?? [],
        perfis: v?.perfis.perfis.length ?? 0,
        pontasSoltas: v?.perfis.pontasSoltas ?? [],
        autointersecoes: v?.perfis.autointersecoes ?? [],
        selecao: [...sel],
        ferramenta: nomeAtivo(),
        prompt: promptAtivo(),
        opcoes: opcoesAtivas(),
        transformacao: transfVisivel(),
      }
    },
    aoMudar(f) { ouvintes.push(f) },
  }
  return s
}
