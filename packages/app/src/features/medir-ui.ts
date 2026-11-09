// Medidas 3D na vista: linhas âmbar na cena, marcas nos pontos e rótulos HTML (div.medida) por paraTela.
// Tudo com depthTest false e renderOrder alto, para aparecer por cima da malha. Texto dos rótulos vem de ResultadoMedida.texto.
import * as THREE from 'three'
import type { Vista } from '../viewport/vista.ts'
import type { V3 } from './contrato.ts'
import type { ResultadoMedida } from './medir-modelo.ts'

const COR = 0xffb000

/** Segmentos da medida na cena: distância (a-b), ângulo (a-v e v-b), raio (centro-primeiro ponto). Área e volume: nenhum. */
function segmentos(r: ResultadoMedida): [V3, V3][] {
  const p = r.pontos
  if (r.modo === 'distancia' && p.length === 2) return [[p[0], p[1]]]
  if (r.modo === 'angulo' && p.length === 3) return [[p[0], p[1]], [p[1], p[2]]]
  if (r.modo === 'raio' && r.extra?.centro && p.length > 0) return [[r.extra.centro, p[0]]]
  return []
}

/** Ponto do rótulo: meio da distância, vértice do ângulo, centro do raio. Área e volume não trazem coordenada: null. */
function ancora(r: ResultadoMedida): V3 | null {
  const p = r.pontos
  if (r.modo === 'raio') return r.extra?.centro ?? p[0] ?? null
  if (r.modo === 'angulo') return p[1] ?? null
  if (r.modo === 'distancia' && p.length === 2) {
    return [(p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2, (p[0][2] + p[1][2]) / 2]
  }
  return null
}

export function criaMedirUI(vista: Pick<Vista, 'cena' | 'pedeRender' | 'paraTela'>, host: HTMLElement): {
  mostra(resultados: readonly ResultadoMedida[], pendentes: V3[]): void
  reposiciona(): void
  limpa(): void
  dispose(): void
} {
  const grupo = new THREE.Group()
  grupo.name = 'medidas'
  vista.cena.add(grupo)
  const camada = document.createElement('div')
  camada.className = 'medir-camada'
  host.append(camada)
  const matLinha = new THREE.LineBasicMaterial({ color: COR, depthTest: false })
  const matMarca = new THREE.PointsMaterial({ color: COR, size: 7, sizeAttenuation: false, depthTest: false })
  let rotulos: { el: HTMLElement; p: V3 }[] = []

  const geo = (pos: number[]): THREE.BufferGeometry =>
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))

  function esvazia(): void {
    for (const o of grupo.children) (o as THREE.LineSegments | THREE.Points).geometry.dispose()
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
    mostra(resultados, pendentes) {
      esvazia()
      const linhas: number[] = [], marcas: number[] = []
      for (const r of resultados) {
        for (const [p, q] of segmentos(r)) linhas.push(...p, ...q)
        marcas.push(...r.pontos.flat())
        if (r.modo === 'raio' && r.extra?.centro) marcas.push(...r.extra.centro)
        const p = ancora(r)
        if (p) {
          const el = document.createElement('div')
          el.className = 'medida'
          el.textContent = r.texto
          camada.append(el)
          rotulos.push({ el, p })
        }
      }
      marcas.push(...pendentes.flat())
      if (linhas.length) {
        const l = new THREE.LineSegments(geo(linhas), matLinha)
        l.renderOrder = 20
        grupo.add(l)
      }
      if (marcas.length) {
        const m = new THREE.Points(geo(marcas), matMarca)
        m.renderOrder = 21
        grupo.add(m)
      }
      reposiciona()
      vista.pedeRender()
    },
    reposiciona,
    limpa() {
      esvazia()
      vista.pedeRender()
    },
    dispose() {
      esvazia()
      matLinha.dispose()
      matMarca.dispose()
      camada.remove()
      vista.cena.remove(grupo)
    },
  }
}
