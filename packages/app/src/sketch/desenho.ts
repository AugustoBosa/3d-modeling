// Desenho do sketch na vista 3D: geometria THREE (linhas, pontos, perfis, prévia, cotas temporárias) e rótulos DOM
// sobre a vista (cotas, símbolos de restrição, marcador de snap). Só `criaDesenho` toca DOM; o resto é puro.
import * as THREE from 'three'
import { ancoraCota, discretizaArco, discretizaCirculo, ehDimensao, planoParaMundo } from '@3dm/core/sketch'
import type { Alvo, CotaTemp, EntSk, InfoSketch, Pt, ResultadoPerfis, RestSk, SketchFeature, TipoRestSk } from '@3dm/core/sketch'
import type { Vista } from '../viewport/vista.ts'
import type { Forma } from './ferramenta.ts'
import { el } from '../ui.ts'
import { T } from '../textos.ts'

export interface EstadoDesenho {
  vista: { sk: SketchFeature; info: InfoSketch; perfis: ResultadoPerfis } | undefined   // sketch ativo resolvido
  selecao: ReadonlySet<string>
  hover: string | null
  previa: Forma[]            // prévia elástica da ferramenta (em coordenadas do plano)
  alvo: Alvo | null          // marcador de snap
  temporarias: CotaTemp[]    // cotas temporárias da entidade selecionada
}
export interface Desenho {
  atualiza(e: EstadoDesenho): void           // reconstrói a geometria THREE e os rótulos; chama vista.pedeRender()
  reposiciona(): void                         // só reprojeta os rótulos DOM (chamar a cada quadro renderizado pela vista)
  onCota(f: (restricaoId: string) => void): void   // clique no número de uma cota
  onTemp(f: (c: CotaTemp, acao: 'editar' | 'fixar') => void): void  // clique no número / cadeado de cota temporária
  limpa(): void                               // remove tudo (ao sair do sketch)
}

export type CorEntidade = 'selecao' | 'hover' | 'conflito' | 'definido' | 'livre'

const VAR_DA_COR: Record<CorEntidade, string> = {
  selecao: '--selecao', hover: '--destaque', conflito: '--restricao-conflito', definido: '--restricao-ok', livre: '--restricao-sub',
}
const PASSO_SIMBOLO = 12 // px entre símbolos repetidos no mesmo local

/** Cor de uma entidade (prioridade: seleção > hover > conflito > definido > livre). Pura. */
export function corDaEntidade(
  sk: SketchFeature, id: string, info: InfoSketch, selecao: ReadonlySet<string>, hover: string | null,
): CorEntidade {
  if (selecao.has(id)) return 'selecao'
  if (hover === id) return 'hover'
  if (sk.restricoes.some(r => info.culpadas.includes(r.id) && r.e.includes(id))) return 'conflito'
  return info.estado === 'definido' ? 'definido' : 'livre'
}

const pontoDe = (sk: SketchFeature, id: string): Pt | null => {
  const p = sk.entidades.find(x => x.id === id)
  return p?.tipo === 'ponto' ? { x: p.x, y: p.y } : null
}

/** Polilinha de uma entidade no plano (linha: 2 pontos; círculo fechado; arco discretizado; ponto: 1). Pura. */
export function polilinhaDe(sk: SketchFeature, e: EntSk): Pt[] {
  if (e.tipo === 'ponto') return [{ x: e.x, y: e.y }]
  if (e.tipo === 'linha') {
    const a = pontoDe(sk, e.a), b = pontoDe(sk, e.b)
    return a && b ? [a, b] : []
  }
  const c = pontoDe(sk, e.c)
  if (!c) return []
  if (e.tipo === 'circulo') {
    const pts = discretizaCirculo(c, e.r)
    return [...pts, pts[0]]
  }
  const a = pontoDe(sk, e.a), b = pontoDe(sk, e.b)
  return a && b ? discretizaArco(c, a, b) : []
}

function polilinhaDeForma(f: Forma): Pt[] {
  if (f.k === 'linha') return [f.a, f.b]
  if (f.k === 'circulo') {
    const pts = discretizaCirculo(f.c, f.r)
    return [...pts, pts[0]]
  }
  if (f.k === 'arco') return discretizaArco(f.c, f.a, f.b)
  return []
}

/** Ponto de ancoragem do símbolo: ponto = ele mesmo; linha = ponto médio; círculo/arco = centro. */
function localSimbolo(sk: SketchFeature, r: RestSk): Pt | null {
  const en = sk.entidades.find(x => x.id === r.e[0])
  if (!en) return null
  if (en.tipo === 'ponto') return { x: en.x, y: en.y }
  if (en.tipo === 'linha') {
    const a = pontoDe(sk, en.a), b = pontoDe(sk, en.b)
    return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : null
  }
  return pontoDe(sk, en.c)
}

function criaPontos(pos: number[], cor: string, tam: number, ordem: number): THREE.Points {
  const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: cor, size: tam, sizeAttenuation: false, depthTest: false }))
  p.renderOrder = ordem
  return p
}

interface Lote { cor: string; traco: boolean; seg: number[]; pts: number[] }

export function criaDesenho(vista: Vista, host: HTMLElement): Desenho {
  const css = (nome: string) => getComputedStyle(document.documentElement).getPropertyValue(nome).trim()
  const grupo = new THREE.Group()
  grupo.name = 'sketch'
  vista.cena.add(grupo)
  const camada = el('div', { class: 'sk-camada' })
  host.append(camada)

  let aoCota: (id: string) => void = () => {}
  let aoTemp: (c: CotaTemp, acao: 'editar' | 'fixar') => void = () => {}
  interface Ancora { el: HTMLElement; m: [number, number, number]; dx: number; dy: number }
  let ancoras: Ancora[] = []
  const ancora = (elemento: HTMLElement, m: [number, number, number], dx = 0, dy = 0) => {
    camada.append(elemento)
    ancoras.push({ el: elemento, m, dx, dy })
  }

  function descarta(): void {
    for (const o of grupo.children) {
      const k = o as THREE.Mesh
      k.geometry.dispose()
      ;(k.material as THREE.Material).dispose()
    }
    grupo.clear()
  }

  function atualiza(e: EstadoDesenho): void {
    descarta()
    camada.replaceChildren()
    ancoras = []
    const v = e.vista
    if (!v) { vista.pedeRender(); return }
    const { sk, info, perfis } = v
    const mundo = (p: Pt): [number, number, number] => planoParaMundo(sk.plano, p.x, p.y)

    // lotes: uma LineSegments/Points por (cor, tracejado) em vez de um objeto por entidade
    const lotes = new Map<string, Lote>()
    const lote = (nome: string, traco: boolean): Lote => {
      const k = nome + (traco ? '|t' : '')
      let l = lotes.get(k)
      if (!l) { l = { cor: css(nome), traco, seg: [], pts: [] }; lotes.set(k, l) }
      return l
    }
    const addPolilinha = (l: Lote, pts: Pt[]) => {
      for (let i = 0; i + 1 < pts.length; i++) l.seg.push(...mundo(pts[i]), ...mundo(pts[i + 1]))
    }

    const erros = new Set(perfis.autointersecoes.flat())
    for (const en of sk.entidades) {
      const pts = polilinhaDe(sk, en)
      if (pts.length === 0) continue
      const nome = erros.has(en.id) ? '--erro' : VAR_DA_COR[corDaEntidade(sk, en.id, info, e.selecao, e.hover)]
      const l = lote(nome, !!en.construcao)
      if (en.tipo === 'ponto') l.pts.push(...mundo(pts[0]))
      else addPolilinha(l, pts)
    }

    for (const f of e.previa) {
      if (f.k === 'ponto') lote('--destaque', false).pts.push(...mundo(f.p))
      else addPolilinha(lote('--destaque', true), polilinhaDeForma(f))
    }

    for (const c of e.temporarias) addPolilinha(lote('--simetria', false), [c.de, c.para])

    for (const l of lotes.values()) {
      if (l.seg.length) {
        const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(l.seg, 3))
        const m = l.traco
          ? new THREE.LineDashedMaterial({ color: l.cor, dashSize: 3, gapSize: 2, depthTest: false })
          : new THREE.LineBasicMaterial({ color: l.cor, depthTest: false })
        const linhas = new THREE.LineSegments(g, m)
        if (l.traco) linhas.computeLineDistances()
        linhas.renderOrder = 10
        grupo.add(linhas)
      }
      if (l.pts.length) grupo.add(criaPontos(l.pts, l.cor, 6, 11))
    }

    // perfis: triangulação com furos, translúcida
    for (const p of perfis.perfis) {
      const contorno = p.poligono.map(q => new THREE.Vector2(q.x, q.y))
      const furos = p.furos.map(f => f.map(q => new THREE.Vector2(q.x, q.y)))
      const faces = THREE.ShapeUtils.triangulateShape(contorno, furos) // muta os arrays (tira ponto final repetido): usar depois
      const todos = [...contorno, ...furos.flat()]
      const pos: number[] = []
      for (const f of faces) for (const i of f) pos.push(...mundo(todos[i]))
      const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      const m = new THREE.MeshBasicMaterial({ color: css('--selecao'), transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide })
      const malha = new THREE.Mesh(g, m)
      malha.renderOrder = 5
      grupo.add(malha)
    }

    // pontas soltas: pontos vermelhos maiores
    const pontas: number[] = []
    for (const id of perfis.pontasSoltas) {
      const p = pontoDe(sk, id)
      if (p) pontas.push(...mundo(p))
    }
    if (pontas.length) grupo.add(criaPontos(pontas, css('--erro'), 10, 12))

    // marcador de snap (DOM)
    if (e.alvo) {
      const m = mundo(e.alvo.p)
      ancora(el('div', { class: `sk-marcador ${e.alvo.tipo}` }), m)
      ancora(el('div', { class: 'sk-dica', textContent: T.sk.snap[e.alvo.tipo] }), m)
    }

    // cotas (dimensões) e símbolos de restrição (DOM)
    const simbolo = T.sk.simbolo as Partial<Record<TipoRestSk, string>>
    const usos = new Map<string, number>()
    for (const r of sk.restricoes) {
      if (ehDimensao(r.tipo)) {
        const a = ancoraCota(sk, r)
        if (!a) continue
        const cls = `sk-cota${r.ref ? ' ref' : ''}${info.culpadas.includes(r.id) ? ' conflito' : ''}`
        ancora(el('div', { class: cls, textContent: a.texto, onclick: () => aoCota(r.id) }), mundo(a.p))
        continue
      }
      const p = localSimbolo(sk, r)
      const txt = simbolo[r.tipo]
      if (!p || !txt) continue
      const chave = `${p.x.toFixed(3)},${p.y.toFixed(3)}`
      const k = (usos.get(chave) ?? 0) + 1
      usos.set(chave, k)
      ancora(el('div', { class: 'sk-simbolo', textContent: txt }), mundo(p), PASSO_SIMBOLO * k, -PASSO_SIMBOLO * k)
    }

    // cotas temporárias: valor na metade do segmento, cadeado ao lado
    for (const c of e.temporarias) {
      const meio = { x: (c.de.x + c.para.x) / 2, y: (c.de.y + c.para.y) / 2 }
      const valor = el('span', { textContent: c.valor.toFixed(1), onclick: () => aoTemp(c, 'editar') })
      const cadeado = el('button', { type: 'button', class: 'sk-cadeado', textContent: T.sk.cadeado, title: T.sk.cotaTemp, onclick: () => aoTemp(c, 'fixar') })
      ancora(el('div', { class: 'sk-cota temp' }, valor, cadeado), mundo(meio))
    }

    vista.pedeRender()
  }

  return {
    atualiza,
    reposiciona() {
      for (const a of ancoras) {
        const s = vista.paraTela(a.m[0], a.m[1], a.m[2])
        a.el.style.display = s ? '' : 'none'
        if (s) { a.el.style.left = `${s.x + a.dx}px`; a.el.style.top = `${s.y + a.dy}px` }
      }
    },
    onCota(f) { aoCota = f },
    onTemp(f) { aoTemp = f },
    limpa() {
      descarta()
      camada.replaceChildren()
      ancoras = []
      vista.pedeRender()
    },
  }
}
