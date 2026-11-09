// Captura SVG das vistas do modelo: projeção ortográfica + algoritmo do pintor, sem GPU.
import { bbox, normaliza } from '@3dm/core/malha'
import type { EntradaMalha } from '@3dm/core/malha'

export type Vista = 'iso' | 'frente' | 'topo' | 'direita'
export interface CorpoCaptura { nome: string; malha: EntradaMalha; cor?: string } // cor '#RRGGBB'

export const VISTAS: Vista[] = ['iso', 'frente', 'topo', 'direita']

type V3 = [number, number, number]

const R2 = Math.SQRT1_2
const S6 = Math.sqrt(6)
// r = eixo direito da tela, u = eixo para cima da tela; a câmera olha ao longo de f = u × r.
const CAMERAS: Record<Vista, { r: V3; u: V3 }> = {
  frente: { r: [1, 0, 0], u: [0, 0, 1] },
  topo: { r: [1, 0, 0], u: [0, 1, 0] },
  direita: { r: [0, 1, 0], u: [0, 0, 1] },
  iso: { r: [R2, R2, 0], u: [-1 / S6, 1 / S6, 2 / S6] },
}
const TITULOS: Record<Vista, string> = { iso: 'Isométrica', frente: 'Frente', topo: 'Topo', direita: 'Direita' }
const COR_PADRAO = '#d9b36c'
const FUNDO = '#1b1d21'
const TEXTO = '#e3e8ee'
const PAD = 16 // margem lateral
const FAIXA = 24 // faixa acima (título) e abaixo (cotas) do desenho

const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
const num = (n: number) => n.toFixed(1)
const fmtMm = (n: number) => Number(n.toFixed(2)).toString().replace('.', ',')
const hexRgb = (hex: string): V3 => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
const sombreia = (rgb: V3, f: number) => '#' + rgb.map(c => Math.round(c * f).toString(16).padStart(2, '0')).join('')

export function capturaSvg(corpos: CorpoCaptura[], vista: Vista, opc: { largura?: number } = {}): string {
  const validos = corpos.filter(c => normaliza(c.malha).idx.length >= 3)
  if (validos.length === 0) {
    throw new Error('Não há geometria para capturar. Crie uma feature de sólido antes (ex.: primitiva ou extrudar).')
  }
  const largura = opc.largura ?? 400
  const { r, u } = CAMERAS[vista]
  const f = cross(u, r)
  const paraCamera: V3 = [-f[0], -f[1], -f[2]]
  const luz = norm([0, 1, 2].map(k => paraCamera[k] + 0.6 * u[k] + 0.3 * r[k]) as V3)

  // Todos os triângulos entram no enquadramento; só os de frente são desenhados.
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  const faces: { pts: [number, number][]; prof: number; cor: string }[] = []
  for (const c of validos) {
    const { pos, idx } = normaliza(c.malha)
    const rgb = hexRgb(c.cor ?? COR_PADRAO)
    const P = (v: number): V3 => [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]]
    for (let t = 0; t < idx.length; t += 3) {
      const abc = [P(idx[t]), P(idx[t + 1]), P(idx[t + 2])] as const
      const [a, b, d] = abc
      const pts = abc.map(p => [dot(p, r), dot(p, u)] as [number, number])
      for (const [px, py] of pts) {
        x0 = Math.min(x0, px); x1 = Math.max(x1, px)
        y0 = Math.min(y0, py); y1 = Math.max(y1, py)
      }
      const n = cross(sub(b, a), sub(d, a))
      const len = Math.hypot(n[0], n[1], n[2])
      if (len === 0) continue
      const nn: V3 = [n[0] / len, n[1] / len, n[2] / len]
      if (dot(nn, paraCamera) <= 0) continue // de costas
      const fator = 0.35 + 0.65 * Math.max(0, dot(nn, luz))
      faces.push({ pts, prof: (dot(a, f) + dot(b, f) + dot(d, f)) / 3, cor: sombreia(rgb, fator) })
    }
  }

  // Algoritmo do pintor: o mais longe (maior profundidade em f) primeiro.
  faces.sort((p, q) => q.prof - p.prof)

  const S = largura - 2 * PAD
  const w = x1 - x0, h = y1 - y0
  const s = S / (Math.max(w, h) || 1)
  const H = S + 2 * FAIXA
  const ox = PAD + (S - w * s) / 2
  const oy = FAIXA + (S - h * s) / 2
  const tela = ([px, py]: [number, number]): string => `${num(ox + (px - x0) * s)},${num(oy + (y1 - py) * s)}`

  const caixas = validos.map(c => bbox(c.malha))
  const dims = [0, 1, 2].map(k => Math.max(...caixas.map(b => b.max[k])) - Math.min(...caixas.map(b => b.min[k])))
  const cotas = `${dims.map(fmtMm).join(' × ')} mm`

  const L = num(largura), A = num(H)
  const texto = `font-family="system-ui, sans-serif" font-size="11" fill="${TEXTO}"`
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${A}" viewBox="0 0 ${L} ${A}">`,
    `<rect width="${L}" height="${A}" fill="${FUNDO}"/>`,
    ...faces.map(fc => `<polygon points="${fc.pts.map(tela).join(' ')}" fill="${fc.cor}" stroke="${fc.cor}" stroke-width="0.3"/>`),
    `<text x="${num(PAD)}" y="16" ${texto}>${TITULOS[vista]}</text>`,
    `<text x="${num(PAD)}" y="${num(H - 8)}" ${texto}>${cotas}</text>`,
    '</svg>',
  ].join('\n')
}
