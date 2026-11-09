// Chanfro e fillet de borda (topo e/ou base) por camadas: cada camada é a seção recuada e extrudada na espessura da fatia.
// Aproximação discreta: N degraus com recuo medido no meio de cada camada (regra do ponto médio).
import type { Manifold as MF } from 'manifold-3d'
import { Manifold, secaoDe } from '../kernel/index.ts'
import type { Perfil } from '../kernel/tipos.ts'
import { ErroFeature } from './tipos.ts'
import type { BordaExtrude, Ctx } from './tipos.ts'

/** Recuo da superfície a `t` mm da face (t = 0 na face, t = r no fundo da borda). Fillet = quarto de círculo de raio r. */
function recuo(modo: BordaExtrude['modo'], r: number, t: number): number {
  if (modo === 'chanfro') return r - t
  return r - Math.sqrt(r * r - (r - t) * (r - t))
}

/** Sólido de perfil extrudado com borda(s) de chanfro ou fillet em `onde`, no referencial local (z de 0 a altura). */
export function extrudeComBorda(perfis: Perfil[], altura: number, borda: BordaExtrude, ctx: Ctx): MF {
  const { modo, tamanho: r, onde } = borda
  if (!(r > 0)) throw new ErroFeature('Tamanho de borda inválido.', 'Use um valor maior que zero.')
  const S = secaoDe(perfis, ctx.lixo)
  const b = S.bounds()
  const menor = Math.min(b.max[0] - b.min[0], b.max[1] - b.min[1])
  if (r >= altura / 2 || r >= menor / 2) throw new ErroFeature('Borda grande demais.', 'Use um valor menor que metade da altura.')

  const N = Math.min(40, Math.max(4, Math.ceil(r / 0.2)))
  const h = r / N
  const fatias = (face: 'topo' | 'base'): MF[] => {
    const out: MF[] = []
    for (let k = 0; k < N; k++) {
      const recuado = ctx.lixo.add(S.offset(-recuo(modo, r, (k + 0.5) * h), 'Miter'))
      if (recuado.isEmpty()) throw new ErroFeature('A borda consome toda a seção.', 'Use um valor menor para a borda.')
      const z0 = face === 'topo' ? altura - (k + 1) * h : k * h
      out.push(ctx.lixo.add(ctx.lixo.add(Manifold.extrude(recuado, h)).translate(0, 0, z0)))
    }
    return out
  }

  // Corpo central: a seção inteira entre as cotas em que a borda não atua.
  const comTopo = onde !== 'base'
  const comBase = onde !== 'topo'
  const z0 = comBase ? r : 0
  const z1 = comTopo ? altura - r : altura
  const partes: MF[] = [ctx.lixo.add(ctx.lixo.add(Manifold.extrude(S, z1 - z0)).translate(0, 0, z0))]
  if (comTopo) partes.push(...fatias('topo'))
  if (comBase) partes.push(...fatias('base'))
  return ctx.lixo.add(Manifold.union(partes))
}
