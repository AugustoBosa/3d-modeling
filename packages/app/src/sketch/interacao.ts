// Ponte DOM do sketch: ponteiro na vista → sessão (clique, janela, cursor) e sessão → desenho (THREE + rótulos).
import { acha, adquire, aplicaOtrack, candidatosOsnap, cotasTemporarias } from '@3dm/core/sketch'
import type { Pt } from '@3dm/core/sketch'
import type { EstadoModos } from '../status.ts'
import type { Vista } from '../viewport/vista.ts'
import type { Desenho } from './desenho.ts'
import type { Forma } from './ferramenta.ts'
import { criaDyn } from './dyn.ts'
import type { SessaoSketch } from './sessao.ts'

export function ligaInteracao(o: { vista: Vista; sessao: SessaoSketch; desenho: Desenho; host: HTMLElement; modos(): EstadoModos; aoCursor(p: Pt | null): void }) {
  const { vista, sessao, desenho } = o
  const dyn = criaDyn(o.host)
  dyn.aoEnviar(t => { sessao.texto(t) })
  let adquiridos: { p: Pt; ref: string }[] = [], guias: Forma[] = []
  let previa: Forma[] = [], alvo: ReturnType<SessaoSketch['cursor']>['alvo'] = null, hover: string | null = null
  let ultimoCursor: Pt | null = null

  function redesenha() {
    const v = sessao.vista()
    if (!v || !sessao.ativo) { desenho.limpa(); return }
    const unico = sessao.selecao.size === 1 && !sessao.ferramenta ? [...sessao.selecao][0] : null
    desenho.atualiza({ vista: v, selecao: sessao.selecao, hover, previa, alvo, temporarias: unico ? cotasTemporarias(v.sk, unico) : [] })
  }
  sessao.aoMudar(redesenha)

  const plano = () => sessao.vista()?.sk.plano
  const ponto = (e: PointerEvent): Pt | null => {
    const pl = plano()
    const p = pl ? vista.noPlano(e.clientX, e.clientY, pl.base, pl.offset) : null
    return p ? otrack(p) : null
  }
  /** OTRACK (F11): guias H/V a partir de pontos de snap adquiridos. Só vale onde o OSNAP não tem candidato (extremidade etc. vencem). */
  function otrack(p: Pt): Pt {
    guias = []
    const sk = sessao.vista()?.sk
    if (!sk || !o.modos().otrack || !sessao.ferramenta) { adquiridos = []; return p }
    const tol = 8 * vista.mmPorPixel()
    adquiridos = adquire(sk, p, tol, adquiridos)
    if (o.modos().osnap && candidatosOsnap(sk, p, { tol, osnap: true, ortho: false, polar: false, grade: false, passoGrade: 1, polarGraus: 15 }).length) return p
    const r = aplicaOtrack(p, adquiridos, tol)
    if (!r) return p
    guias = r.guias.map(g => g.dir === 'H' ? { k: 'linha', a: { x: g.de.x - 2000, y: g.de.y }, b: { x: g.de.x + 2000, y: g.de.y } } as Forma : { k: 'linha', a: { x: g.de.x, y: g.de.y - 2000 }, b: { x: g.de.x, y: g.de.y + 2000 } } as Forma)
    return r.p
  }

  let inicio: { x: number; y: number; p: Pt } | null = null
  const c = vista.canvas
  c.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !sessao.ativo) return
    const p = ponto(e)
    inicio = p ? { x: e.clientX, y: e.clientY, p } : null
  })
  c.addEventListener('pointermove', e => {
    if (!sessao.ativo) return
    const p = ponto(e)
    if (!p) return
    ultimoCursor = p
    const r = sessao.cursor(p, { shift: e.shiftKey })
    previa = [...r.previa, ...guias]; alvo = r.alvo
    const box = o.host.getBoundingClientRect()
    dyn.atualiza({ ativo: o.modos().dyn && sessao.ferramenta !== null && sessao.ultimoPonto !== null, base: sessao.ultimoPonto, cursor: r.alvo?.p ?? p, pixel: { x: e.clientX - box.left, y: e.clientY - box.top } })
    o.aoCursor(r.alvo?.p ?? p)
    const v = sessao.vista()
    hover = v && !sessao.ferramenta ? acha(v.sk, p, 8 * vista.mmPorPixel()) : null
    redesenha()
  })
  c.addEventListener('pointerup', e => {
    if (e.button !== 0 || !inicio || !sessao.ativo) { inicio = null; return }
    const ini = inicio; inicio = null
    const p = ponto(e)
    if (!p) return
    const arrastou = Math.hypot(e.clientX - ini.x, e.clientY - ini.y) > 4
    if (arrastou && !sessao.ferramenta) sessao.janela(ini.p, p, { mais: e.shiftKey })
    else if (!arrastou) sessao.clique(p, { shift: e.shiftKey })
  })
  c.addEventListener('pointerleave', () => { alvo = null; previa = []; redesenha() })
  const paraDyn = () => dyn.proximoCampo()

  // clique no número de uma cota / cota temporária: abre o DIM já com a seleção certa (Enter aceita o valor medido)
  desenho.onCota(id => {
    const r = sessao.vista()?.sk.restricoes.find(x => x.id === id)
    if (!r) return
    sessao.seleciona(r.e); sessao.inicia('DIM')
  })
  desenho.onTemp((t, acao) => {
    sessao.seleciona(t.e); sessao.inicia('DIM')
    if (acao === 'fixar') sessao.enter()
  })
  return { redesenha, proximoCampo: paraDyn, get cursor() { return ultimoCursor } }
}
