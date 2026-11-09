// Cotas 3D persistentes da caixa envolvente (L x W x H): linhas âmbar na cena + rótulos HTML por paraTela.
// geometriaCotas é pura (o teste valida); criaCotas3d toca cena e DOM. Texto dos rótulos vem de medir-ui-textos.ts.
import * as THREE from 'three'
import type { Vista } from '../viewport/vista.ts'
import type { V3 } from './contrato.ts'
import { rotuloCota } from './cotas-formato.ts'

export interface CotaCaixa {
  rotulo: 'L' | 'W' | 'H'
  a: V3
  b: V3
  valor: number
  /** Linha de cota, duas extensões e os dois tracinhos de 45 graus nas pontas. */
  linhas: [V3, V3][]
}

const EXT = 1 // mm: a linha de extensão passa 1 mm da linha de cota
const TICK = 1.2 // mm: tracinho de 45 graus nas pontas (cresce com a peça)
const RAIZ2 = Math.SQRT2

const soma = (p: V3, v: V3, k: number): V3 => [p[0] + v[0] * k, p[1] + v[1] * k, p[2] + v[2] * k]
const sub = (p: V3, q: V3): V3 => [p[0] - q[0], p[1] - q[1], p[2] - q[2]]
const comp = (v: V3): number => Math.hypot(v[0], v[1], v[2])
const unit = (v: V3): V3 => {
  const l = comp(v)
  return l > 1e-12 ? [v[0] / l, v[1] / l, v[2] / l] : [0, 0, 0]
}

/** Cotas L (X), W (Y) e H (Z) da caixa. `v` é o lado para fora da peça onde a linha de cota fica. Afastamento = max(4, 6% da maior dimensão). */
export function geometriaCotas(bbox: { min: V3; max: V3 }): CotaCaixa[] {
  const [x0, y0, z0] = bbox.min
  const [x1, y1, z1] = bbox.max
  const maior = Math.max(x1 - x0, y1 - y0, z1 - z0)
  const afast = Math.max(4, 0.06 * maior)
  const tick = Math.max(TICK, 0.02 * maior)

  const cota = (c1: V3, c2: V3, v: V3, rotulo: CotaCaixa['rotulo']): CotaCaixa => {
    const a = soma(c1, v, afast), b = soma(c2, v, afast)
    const u = unit(sub(b, a))
    const d = soma([0, 0, 0], unit([u[0] + v[0], u[1] + v[1], u[2] + v[2]]), 1) // direção de 45 graus, unitária
    const tk = (p: V3): [V3, V3] => [soma(p, d, -tick / 2), soma(p, d, tick / 2)]
    return {
      rotulo,
      a,
      b,
      valor: comp(sub(c2, c1)),
      linhas: [[c1, soma(a, v, EXT)], [c2, soma(b, v, EXT)], [a, b], tk(a), tk(b)],
    }
  }

  return [
    cota([x0, y0, z0], [x1, y0, z0], [0, -1, 0], 'L'),
    cota([x1, y0, z0], [x1, y1, z0], [1, 0, 0], 'W'),
    cota([x0, y0, z0], [x0, y0, z1], [-1 / RAIZ2, -1 / RAIZ2, 0], 'H'),
  ]
}

/** Cotas da caixa envolvente: `atualiza` com o bbox (null ou desligado = some). */
export function criaCotas3d(vista: Pick<Vista, 'cena' | 'pedeRender' | 'paraTela'>, host: HTMLElement): {
  atualiza(bbox: { min: V3; max: V3 } | null, ligado: boolean): void
  reposiciona(): void
  dispose(): void
} {
  const grupo = new THREE.Group()
  grupo.name = 'cotas3d'
  vista.cena.add(grupo)
  const camada = document.createElement('div')
  camada.className = 'medir-camada'
  host.append(camada)
  const mat = new THREE.LineBasicMaterial({ color: 0xffb000, depthTest: false })
  let rotulos: { el: HTMLElement; p: V3 }[] = []

  function esvazia(): void {
    for (const o of grupo.children) (o as THREE.LineSegments).geometry.dispose()
    grupo.clear()
    camada.replaceChildren()
    rotulos = []
  }

  function reposiciona(): void {
    for (const r of rotulos) {
      const s = vista.paraTela(r.p[0], r.p[1], r.p[2])
      r.el.style.display = s ? '' : 'none'
      if (s) { r.el.style.left = `${s.x}px`; r.el.style.top = `${s.y}px` }
    }
  }

  return {
    atualiza(bbox, ligado) {
      esvazia()
      if (ligado && bbox) {
        const cotas = geometriaCotas(bbox)
        const pos: number[] = []
        for (const c of cotas) for (const [p, q] of c.linhas) pos.push(...p, ...q)
        const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
        const malha = new THREE.LineSegments(g, mat)
        malha.renderOrder = 20
        grupo.add(malha)
        for (const c of cotas) {
          const el = document.createElement('div')
          el.className = 'cota3d'
          el.textContent = rotuloCota(c.rotulo, c.valor)
          camada.append(el)
          rotulos.push({ el, p: [(c.a[0] + c.b[0]) / 2, (c.a[1] + c.b[1]) / 2, (c.a[2] + c.b[2]) / 2] })
        }
        reposiciona()
      }
      vista.pedeRender()
    },
    reposiciona,
    dispose() {
      esvazia()
      mat.dispose()
      camada.remove()
      vista.cena.remove(grupo)
    },
  }
}
