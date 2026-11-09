// Feature de furo: simples, rebaixado (cabeça cilíndrica) ou escareado (cone 90°), com presets M2..M8 e insertos de latão.
import type { Manifold as MF } from 'manifold-3d'
import { Manifold, noPlano, segmentosCirculo } from '../kernel/index.ts'
import { idAlvo } from './operacao.ts'
import { ErroFeature } from './tipos.ts'
import type { Ctx, Delta, FFuro } from './tipos.ts'

export interface DadosPreset {
  /** Furo livre (passagem). */
  passagem: number
  /** Cabeça cilíndrica (DIN 912): diâmetro e altura do rebaixe. */
  rebaixe: { d: number; h: number }
  /** Diâmetro do cone na face (cone de 90°). */
  escareado: { d: number }
  /** Inserto roscado de latão: diâmetro e profundidade do furo. Valores típicos: conferir com o inserto comprado. */
  inserto: { d: number; h: number }
}

export const PRESETS: Record<NonNullable<FFuro['preset']>, DadosPreset> = {
  M2: { passagem: 2.4, rebaixe: { d: 4.4, h: 2.2 }, escareado: { d: 4.6 }, inserto: { d: 3.2, h: 3.5 } },
  M3: { passagem: 3.4, rebaixe: { d: 6.5, h: 3.0 }, escareado: { d: 6.3 }, inserto: { d: 4.0, h: 5.0 } },
  M4: { passagem: 4.5, rebaixe: { d: 8.0, h: 4.0 }, escareado: { d: 8.4 }, inserto: { d: 5.6, h: 6.0 } },
  M5: { passagem: 5.5, rebaixe: { d: 10.0, h: 5.0 }, escareado: { d: 10.4 }, inserto: { d: 6.4, h: 7.5 } },
  M6: { passagem: 6.6, rebaixe: { d: 11.0, h: 6.0 }, escareado: { d: 12.6 }, inserto: { d: 8.0, h: 9.0 } },
  M8: { passagem: 9.0, rebaixe: { d: 15.0, h: 8.0 }, escareado: { d: 16.8 }, inserto: { d: 9.7, h: 11.0 } },
}

/** Cilindro (ou tronco) de z=z0 a z0+h, registrado no lixo. */
function cilindro(ctx: Ctx, r0: number, r1: number, z0: number, h: number): MF {
  const c = ctx.lixo.add(Manifold.cylinder(h, r0, r1, segmentosCirculo(Math.max(r0, r1), ctx.tol)))
  return ctx.lixo.add(c.translate(0, 0, z0))
}

export function executaFuro(f: FFuro, ctx: Ctx): Delta {
  const a = idAlvo(ctx, f.alvo)
  const alvo = ctx.corpos.get(a)!
  if (f.posicoes.length === 0) throw new ErroFeature('Nenhuma posição de furo.', 'Informe ao menos uma posição (x, y) no plano do furo.')

  const P = f.preset ? PRESETS[f.preset] : undefined
  const dBase = f.inserto && P ? P.inserto.d : P ? P.passagem : (f.diametro ?? 0)
  if (!(dBase > 0)) throw new ErroFeature('Diâmetro do furo ausente.', 'Informe o diâmetro ou um preset M2–M8.')
  const comp = f.compensacao ?? 0
  const d = dBase + comp

  const { min, max } = alvo.boundingBox()
  const diagonal = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2])
  const prof = f.profundidade ?? (f.inserto && P ? P.inserto.h : diagonal + 2)
  if (!(prof > 0)) throw new ErroFeature('Profundidade do furo inválida.', 'Use um valor maior que zero.')

  // Um furo em coordenadas locais: face em z=0, furo para z<0 (margem de 1 mm acima da face para cortar limpo).
  const furo = cilindro(ctx, d / 2, d / 2, -prof, prof + 1)
  let umFuro = furo
  if (f.tipoFuro === 'rebaixado') {
    const D = (P ? P.rebaixe.d : 1.8 * dBase) + comp
    const h = P ? P.rebaixe.h : 0.9 * dBase
    umFuro = ctx.lixo.add(Manifold.union([cilindro(ctx, D / 2, D / 2, -h, h + 1), furo]))
  } else if (f.tipoFuro === 'escareado') {
    const D = (P ? P.escareado.d : 2 * dBase) + comp
    if (!(D > d)) throw new ErroFeature('O escareado não é maior que o furo.', 'Aumente o diâmetro do escareado ou reduza a compensação.')
    const hCone = (D - d) / 2
    umFuro = ctx.lixo.add(Manifold.union([cilindro(ctx, d / 2, D / 2, -hCone, hCone), cilindro(ctx, D / 2, D / 2, 0, 1), furo]))
  }

  const copias = f.posicoes.map(([x, y]) => ctx.lixo.add(umFuro.translate(x, y, 0)))
  const ferr = ctx.lixo.add(noPlano(ctx.lixo.add(Manifold.union(copias)), f.plano))

  const resultado = alvo.subtract(ferr)
  if (resultado.isEmpty() || Math.abs(resultado.volume() - alvo.volume()) <= 1e-6) {
    resultado.delete()
    throw new ErroFeature('O furo não toca o corpo.', 'Confira a posição e o plano do furo.')
  }
  return { [a]: resultado }
}
