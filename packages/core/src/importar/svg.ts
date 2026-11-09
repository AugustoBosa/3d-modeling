// Leitor de SVG mínimo, sem DOM (regex e varredura de caracteres). Devolve contornos em mm com Y invertido.
// ponytail: sem `transform`, `<use>`, estilos, `<defs>` nem raio de retângulo (rx/ry): ignorados.
// ponytail: curvas, arcos e círculos viram polilinha com N = comprimento / tol (mínimo 8); sem refinamento adaptativo.

type P = [number, number]

export interface ResultadoSvg { contornos: [number, number][][]; largura: number; altura: number }

const ATR = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
const ELEM = /<(path|rect|circle|ellipse|polygon|polyline)\b([^>]*)>/g
const NUM = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/y
const NUM_ATR = /[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi
const FATOR: Record<string, number> = { '': 1, mm: 1, px: 1, cm: 10, in: 25.4 }
const TAM: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 }

/** Comprimento com unidade ("10mm", "1in"): valor e fator para mm. */
const comp = (v?: string): { v: number; f: number } | undefined => {
  const m = v === undefined ? null : /^\s*([-+]?[\d.]+(?:e[-+]?\d+)?)\s*([a-z%]*)\s*$/i.exec(v)
  return m ? { v: parseFloat(m[1] ?? '0'), f: FATOR[(m[2] ?? '').toLowerCase()] ?? 1 } : undefined
}

const atributos = (s: string): Record<string, string> => {
  const o: Record<string, string> = {}
  for (const m of s.matchAll(ATR)) o[m[1] ?? ''] = m[2] ?? m[3] ?? ''
  return o
}

const comprimento = (ps: P[]): number =>
  ps.reduce((acc, p, i) => (i === 0 ? 0 : acc + Math.hypot(p[0] - ps[i - 1]![0], p[1] - ps[i - 1]![1])), 0)
const nCurva = (ps: P[], tol: number): number => Math.max(8, Math.ceil(comprimento(ps) / tol))

/** Cúbica p0..p3 → pontos após p0, até p3 (quadrática entra convertida). */
function cubica(p0: P, p1: P, p2: P, p3: P, tol: number): P[] {
  const n = nCurva([p0, p1, p2, p3], tol)
  const out: P[] = []
  for (let k = 1; k <= n; k++) {
    const t = k / n, u = 1 - t
    const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t
    out.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]])
  }
  return out
}

/** Arco SVG (parametrização por centro, especificação F.6.5) → pontos após p0, até p1. */
function arco(p0: P, rx0: number, ry0: number, phi: number, fa: number, fs: number, p1: P, tol: number): P[] {
  let rx = Math.abs(rx0), ry = Math.abs(ry0)
  if (p0[0] === p1[0] && p0[1] === p1[1]) return []
  if (rx === 0 || ry === 0) return [p1]
  const cf = Math.cos((phi * Math.PI) / 180), sf = Math.sin((phi * Math.PI) / 180)
  const dx = (p0[0] - p1[0]) / 2, dy = (p0[1] - p1[1]) / 2
  const x1 = cf * dx + sf * dy, y1 = -sf * dx + cf * dy
  const lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry)
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam) }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1
  let co = Math.sqrt(Math.max(0, num / den))
  if (fa === fs) co = -co
  const cxp = (co * rx * y1) / ry, cyp = (-co * ry * x1) / rx
  const cx = cf * cxp - sf * cyp + (p0[0] + p1[0]) / 2
  const cy = sf * cxp + cf * cyp + (p0[1] + p1[1]) / 2
  const ang = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
  const t1 = ang(1, 0, (x1 - cxp) / rx, (y1 - cyp) / ry)
  let dt = ang((x1 - cxp) / rx, (y1 - cyp) / ry, (-x1 - cxp) / rx, (-y1 - cyp) / ry)
  if (!fs && dt > 0) dt -= 2 * Math.PI
  if (fs && dt < 0) dt += 2 * Math.PI
  const n = Math.max(8, Math.ceil((Math.abs(dt) * Math.max(rx, ry)) / tol))
  const out: P[] = []
  for (let k = 1; k <= n; k++) {
    const t = t1 + (dt * k) / n
    out.push([cx + rx * Math.cos(t) * cf - ry * Math.sin(t) * sf, cy + rx * Math.cos(t) * sf + ry * Math.sin(t) * cf])
  }
  out[n - 1] = p1
  return out
}

/** Subcaminhos de um atributo `d`. Para ao primeiro token que não entende (devolve o que já leu). */
function caminho(d: string, tol: number): P[][] {
  const subs: P[][] = []
  let i = 0
  let K = ''
  let cur: P = [0, 0], inicio: P = [0, 0]
  let sub: P[] | null = null
  let ctrl: P | null = null, ctrlTipo = ''

  const pula = () => { while (i < d.length && /[\s,]/.test(d.charAt(i))) i++ }
  const nums = (n: number): number[] | null => {
    const r: number[] = []
    for (let k = 0; k < n; k++) {
      pula()
      NUM.lastIndex = i
      const m = NUM.exec(d)
      if (!m) return null
      r.push(parseFloat(m[0])); i += m[0].length
    }
    return r
  }
  const flag = (): number | null => {
    pula()
    const c = d.charAt(i)
    if (c !== '0' && c !== '1') return null
    i++
    return +c
  }
  const arcArgs = (): number[] | null => {
    const r = nums(3), f1 = flag(), f2 = flag(), e = nums(2)
    return r && f1 !== null && f2 !== null && e ? [...r, f1, f2, ...e] : null
  }
  const add = (p: P) => { if (!sub) { sub = [cur]; subs.push(sub) } sub.push(p); cur = p }
  const reflexo = (tipo: string): P => (ctrlTipo === tipo && ctrl ? [2 * cur[0] - ctrl[0], 2 * cur[1] - ctrl[1]] : cur)

  for (;;) {
    pula()
    if (i >= d.length || !/[A-Za-z]/.test(d.charAt(i))) break
    K = d.charAt(i++)
    let up = K.toUpperCase()
    const rel = K !== up
    const n = TAM[up]
    if (n === undefined) break
    if (up === 'Z') { sub = null; cur = inicio; ctrlTipo = ''; continue }
    const ab = (x: number, y: number): P => (rel ? [cur[0] + x, cur[1] + y] : [x, y])
    for (;;) {
      const a = up === 'A' ? arcArgs() : nums(n)
      if (!a) return subs
      if (up === 'M') {
        const p = ab(a[0]!, a[1]!)
        cur = p; inicio = p; sub = [p]; subs.push(sub)
        up = 'L' // pares seguintes de M são L
      } else if (up === 'L') add(ab(a[0]!, a[1]!))
      else if (up === 'H') add(rel ? [cur[0] + a[0]!, cur[1]] : [a[0]!, cur[1]])
      else if (up === 'V') add(rel ? [cur[0], cur[1] + a[0]!] : [cur[0], a[0]!])
      else if (up === 'A') for (const p of arco(cur, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, ab(a[5]!, a[6]!), tol)) add(p)
      else if (up === 'C' || up === 'S') {
        const c1 = up === 'C' ? ab(a[0]!, a[1]!) : reflexo('C')
        const c2 = ab(a[up === 'C' ? 2 : 0]!, a[up === 'C' ? 3 : 1]!), e = ab(a[up === 'C' ? 4 : 2]!, a[up === 'C' ? 5 : 3]!)
        for (const p of cubica(cur, c1, c2, e, tol)) add(p)
        ctrl = c2; ctrlTipo = 'C'
      } else if (up === 'Q' || up === 'T') {
        const q = up === 'Q' ? ab(a[0]!, a[1]!) : reflexo('Q')
        const e = ab(a[up === 'Q' ? 2 : 0]!, a[up === 'Q' ? 3 : 1]!)
        const c0 = cur
        const c1: P = [c0[0] + (2 / 3) * (q[0] - c0[0]), c0[1] + (2 / 3) * (q[1] - c0[1])]
        const c2: P = [e[0] + (2 / 3) * (q[0] - e[0]), e[1] + (2 / 3) * (q[1] - e[1])]
        for (const p of cubica(c0, c1, c2, e, tol)) add(p)
        ctrl = q; ctrlTipo = 'Q'
      }
      if (up !== 'C' && up !== 'S' && up !== 'Q' && up !== 'T') ctrlTipo = ''
      pula()
      if (i >= d.length || !/[-+.\d]/.test(d.charAt(i))) break
    }
  }
  return subs
}

function elipse(cx: number, cy: number, rx: number, ry: number, tol: number): P[] {
  const n = Math.max(8, Math.ceil((2 * Math.PI * Math.max(rx, ry)) / tol))
  return Array.from({ length: n }, (_, k) => {
    const t = (2 * Math.PI * k) / n
    return [cx + rx * Math.cos(t), cy + ry * Math.sin(t)] as P
  })
}

function forma(tag: string, a: Record<string, string>, tol: number): P[][] {
  const n = (k: string) => parseFloat(a[k] ?? '0') || 0
  if (tag === 'path') return caminho(a.d ?? '', tol)
  if (tag === 'rect') {
    const x = n('x'), y = n('y'), w = n('width'), h = n('height')
    return [[[x, y], [x + w, y], [x + w, y + h], [x, y + h]]]
  }
  if (tag === 'circle') return [elipse(n('cx'), n('cy'), n('r'), n('r'), tol)]
  if (tag === 'ellipse') return [elipse(n('cx'), n('cy'), n('rx'), n('ry'), tol)]
  // polygon e polyline: sempre fechadas
  const v = (a.points ?? '').match(NUM_ATR)?.map(Number) ?? []
  const pts: P[] = []
  for (let k = 0; k + 1 < v.length; k += 2) pts.push([v[k]!, v[k + 1]!])
  return [pts]
}

/** Remove pontos repetidos seguidos e o ponto final igual ao inicial. */
function limpa(c: P[]): P[] {
  const r: P[] = []
  for (const p of c) {
    const q = r[r.length - 1]
    if (!q || Math.abs(q[0] - p[0]) > 1e-9 || Math.abs(q[1] - p[1]) > 1e-9) r.push(p)
  }
  const a = r[0], b = r[r.length - 1]
  if (r.length > 1 && a && b && Math.abs(a[0] - b[0]) <= 1e-9 && Math.abs(a[1] - b[1]) <= 1e-9) r.pop()
  return r
}

const maxDe = (v: number[]): number => v.reduce((m, x) => Math.max(m, x), 0)

export function lerSvg(texto: string, opcoes: { tol?: number } = {}): ResultadoSvg {
  const tol = opcoes.tol ?? 0.1
  const raiz = /<svg\b([^>]*)>/.exec(texto)
  const ra = atributos(raiz?.[1] ?? '')
  const vb = ra.viewBox?.trim().split(/[\s,]+/).map(Number)
  const vbOk = vb && vb.length === 4 && vb.every(Number.isFinite) ? (vb as [number, number, number, number]) : null
  const w = comp(ra.width), h = comp(ra.height)
  // mm por unidade do desenho: com viewBox, largura física dividida pela largura do viewBox
  const s = vbOk && w ? (w.v * w.f) / vbOk[2] : (w?.f ?? 1)

  const brutos = [...texto.matchAll(ELEM)].flatMap((m) => forma(m[1] ?? '', atributos(m[2] ?? ''), tol))
  const todos = brutos.flat()
  const larguraU = vbOk?.[2] ?? w?.v ?? maxDe(todos.map((p) => p[0]))
  const alturaU = vbOk?.[3] ?? h?.v ?? maxDe(todos.map((p) => p[1]))
  const minX = vbOk?.[0] ?? 0, minY = vbOk?.[1] ?? 0

  const contornos = brutos
    .map(limpa)
    .filter((c) => c.length >= 3)
    .map((c) => c.map(([x, y]): [number, number] => [(x - minX) * s, (alturaU - (y - minY)) * s]))
  return { contornos, largura: larguraU * s, altura: alturaU * s }
}
