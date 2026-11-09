// Máquina de estados pura da transformação G/R/S no modo Sólido (sem DOM, sem three).
// O controlador entrega o mouse já projetado (delta mundial em mm, ângulo, razão); aqui só se calculam as features.
import type { Feature } from '@3dm/core/doc'
import type { V3 } from './contrato.ts'
import { T } from '../textos.ts'

export type Letra = 'G' | 'R' | 'S'
export type Eixo = 'X' | 'Y' | 'Z'
export interface AlvoT { id: string; centro: V3 }
export interface MouseT { delta: V3; angulo: number; razao: number }

export interface TransformacaoSolido {
  inicia(letra: Letra, alvos: AlvoT[], opc?: { duplicar?: boolean }): void
  eixo(e: Eixo, plano: boolean): void
  numero(texto: string): void
  mouse(m: MouseT, snap: boolean): void
  previa(): Feature[] | null
  confirma(novoId: (prefixo: string) => string): Feature[]
  cancela(): void
  readonly ativa: boolean
  readonly rotulo: string
}

const IDX: Record<Eixo, number> = { X: 0, Y: 1, Z: 2 }
const r6 = (x: number): number => Math.round(x * 1e6) / 1e6 + 0
const r6v = (v: V3): V3 => [r6(v[0]), r6(v[1]), r6(v[2])]
/** Vetor arredondado; null se tem NaN/infinito ou é zero (efeito nulo). */
const util = (v: V3): V3 | null => (v.every(Number.isFinite) && v.some(c => c !== 0) ? r6v(v) : null)

interface Efeito { mover?: V3; girar?: V3; escala?: number | V3 }

export function criaTransformacaoSolido(): TransformacaoSolido {
  let ativa = false
  let letra: Letra = 'G'
  let eixoT: Eixo | null = null
  let planoT = false
  let texto = ''
  let alvos: AlvoT[] = []
  let dup = false
  let mouseT: MouseT | null = null
  let snap = false

  const num = (): number | null => {
    const s = texto.trim().replace(',', '.')
    return s === '' ? null : Number(s)
  }
  const sn = (c: number, passo: number): number => (snap ? Math.round(c / passo) * passo : c)

  function efeito(): Efeito | null {
    if (letra === 'G') {
      const n = num()
      let v: V3 = [0, 0, 0]
      if (n !== null) v[eixoT ? IDX[eixoT] : 0] = n
      else if (mouseT) {
        const d: V3 = [sn(mouseT.delta[0], 1), sn(mouseT.delta[1], 1), sn(mouseT.delta[2], 1)]
        const i = eixoT ? IDX[eixoT] : -1
        // com eixo: sem plano só o eixo; com plano: tudo menos o eixo
        v = eixoT ? (d.map((c, j) => ((j === i) !== planoT ? c : 0)) as V3) : d
      }
      const r = util(v)
      return r ? { mover: r } : null
    }
    if (letra === 'R') {
      const n = num()
      let g = 0
      if (n !== null) g = n
      else if (mouseT) g = snap ? sn(mouseT.angulo, 15) : mouseT.angulo
      const v: V3 = [0, 0, 0]
      v[IDX[eixoT ?? 'Z']] = g // plano é ignorado em R
      const r = util(v)
      return r ? { girar: r } : null
    }
    // S
    const n = num()
    let f = 1
    if (n !== null) f = n
    else if (mouseT) f = snap ? sn(mouseT.razao, 0.1) : mouseT.razao
    f = r6(f)
    if (!(f > 0) || f === 1) return null // fator <= 0, NaN ou identidade
    if (!eixoT) return { escala: f }
    const i = IDX[eixoT]
    const v: V3 = planoT ? [f, f, f] : [1, 1, 1]
    v[i] = planoT ? 1 : f
    return { escala: v }
  }

  function gera(ids: (i: number) => { id: string; copiaId?: string }): Feature[] | null {
    const e = ativa && alvos.length > 0 ? efeito() : null
    if (!e) return null
    return alvos.map((a, i) => {
      const { id, copiaId } = ids(i)
      const f: Feature = { id, tipo: 'transformacao', alvo: a.id }
      if (e.mover) f.mover = e.mover
      if (e.girar) f.girar = e.girar
      if (letra !== 'G') f.pivo = r6v(a.centro)
      if (e.escala !== undefined) f.escala = e.escala
      if (copiaId !== undefined) f.copiaId = copiaId
      return f
    })
  }

  function reseta(): void {
    ativa = false
    alvos = []
    eixoT = null
    planoT = false
    texto = ''
    mouseT = null
    snap = false
  }

  return {
    inicia(l, a, opc) {
      letra = l
      alvos = a
      dup = opc?.duplicar === true
      eixoT = null
      planoT = false
      texto = ''
      mouseT = null
      snap = false
      ativa = true
    },
    eixo(e, p) {
      if (!ativa) return
      if (eixoT === e) { eixoT = null; planoT = false } // mesmo eixo de novo destrava
      else { eixoT = e; planoT = p }
    },
    numero(t) { if (ativa) texto = t },
    mouse(m, s) { if (ativa) { mouseT = m; snap = s } },
    previa() { return gera(i => ({ id: 'prev' + (i + 1) })) },
    confirma(novoId) {
      if (!ativa) return []
      const r = gera(() => ({ id: novoId('tr'), copiaId: dup ? novoId('cp') : undefined }))
      reseta()
      return r ?? []
    },
    cancela() { reseta() },
    get ativa() { return ativa },
    get rotulo() {
      if (!ativa) return ''
      const t = texto.trim()
      const eixoTxt = eixoT ? (planoT ? T.transformar.plano(eixoT) : eixoT) : letra === 'G' && t !== '' ? 'X' : ''
      return [T.transformar.letra[letra], eixoTxt, t].filter(s => s !== '').join(' ')
    },
  }
}
