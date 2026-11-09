// Features de perfil: extrusão (normal, simétrica, duas distâncias, ângulo de saída) e revolução de um perfil do sketch.
import { extrudeComBorda } from './borda.ts'
import type { Manifold as MF, Mat4 } from 'manifold-3d'
import { Manifold, noPlano, secaoDe, segmentosCirculo } from '../kernel/index.ts'
import type { Perfil, PlanoLocal, Vec2, Vec3 } from '../kernel/tipos.ts'
import { aplicaOperacao } from './operacao.ts'
import { ErroFeature } from './tipos.ts'
import type { Ctx, Delta, FExtrude, FRevolve } from './tipos.ts'

const EPS = 1e-9

/** Perfis escolhidos pela feature (índices em f.perfis; omitido = todos). */
function perfisDe(f: FExtrude | FRevolve, ctx: Ctx): Perfil[] {
  const todos = ctx.perfis(f.sketch)
  const escolhidos = f.perfis ? f.perfis.filter((i) => i >= 0 && i < todos.length).map((i) => todos[i]) : todos
  if (escolhidos.length === 0) throw new ErroFeature('O sketch não tem perfil fechado.', 'Feche o contorno do sketch.')
  return escolhidos
}

/** Distância ao longo da normal do sketch até o plano `ate` (interseção da reta da extrusão com o plano de destino). */
function distanciaAte(f: FExtrude, plano: PlanoLocal): number {
  if (!f.ate) throw new ErroFeature('O plano de destino não foi definido.', 'Escolha um plano para extrudar até.')
  const n = normaliza(f.ate.normal)
  const nS = normaliza(plano.normal)
  const den = nS[0] * n[0] + nS[1] * n[1] + nS[2] * n[2]
  if (Math.abs(den) < EPS) throw new ErroFeature('O plano de destino é paralelo à extrusão.', 'Escolha um plano que cruze a direção da extrusão.')
  const dv = [f.ate.origem[0] - plano.origem[0], f.ate.origem[1] - plano.origem[1], f.ate.origem[2] - plano.origem[2]]
  const d = (dv[0] * n[0] + dv[1] * n[1] + dv[2] * n[2]) / den
  if (d <= 0) throw new ErroFeature('O plano de destino está atrás do sketch.', 'Escolha um plano à frente do sketch.')
  return d
}

const normaliza = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2])
  return [v[0] / l, v[1] / l, v[2] / l]
}

export function executaExtrude(f: FExtrude, ctx: Ctx, plano: PlanoLocal): Delta {
  const modo = f.modo ?? 'normal'
  const d = modo === 'ate' ? distanciaAte(f, plano) : f.distancia
  const d2 = f.distancia2 ?? 0
  if (!(d > 0) || (modo === 'duas' && d2 < 0)) throw new ErroFeature('Distância inválida.', 'Use uma distância maior que zero.')
  const cs = secaoDe(perfisDe(f, ctx), ctx.lixo)
  let solido: MF
  if (modo === 'simetrica') {
    // Taper ignorado: só se aplica ao modo normal.
    solido = ctx.lixo.add(ctx.lixo.add(Manifold.extrude(cs, d)).translate(0, 0, -d / 2))
  } else if (modo === 'duas') {
    // Taper ignorado: só se aplica ao modo normal.
    solido = ctx.lixo.add(ctx.lixo.add(Manifold.extrude(cs, d + d2)).translate(0, 0, -d2))
  } else if (f.borda) {
    // Chanfro/fillet por camadas (borda.ts); no modo normal, sem taper.
    solido = extrudeComBorda(perfisDe(f, ctx), d, f.borda, ctx)
  } else if (f.taper) {
    // Aproximação: escala uniforme em torno do centro da bbox; o ângulo vale para a menor semi-dimensão do perfil.
    const b = cs.bounds()
    const cx = (b.min[0] + b.max[0]) / 2, cy = (b.min[1] + b.max[1]) / 2
    const meia = Math.min(b.max[0] - b.min[0], b.max[1] - b.min[1]) / 2
    const escala = Math.max(0.01, 1 - (d * Math.tan((f.taper * Math.PI) / 180)) / meia)
    const centrada = ctx.lixo.add(cs.translate(-cx, -cy))
    solido = ctx.lixo.add(ctx.lixo.add(Manifold.extrude(centrada, d, 0, 0, [escala, escala])).translate(cx, cy, 0))
  } else {
    solido = ctx.lixo.add(Manifold.extrude(cs, d))
  }
  const ferr = ctx.lixo.add(noPlano(solido, plano))
  return aplicaOperacao(ctx, f.id, ferr, f.operacao, f.alvo)
}

export function executaRevolve(f: FRevolve, ctx: Ctx, plano: PlanoLocal): Delta {
  if (!(f.graus > 0 && f.graus <= 360)) throw new ErroFeature('Ângulo de revolução inválido.', 'Use um ângulo entre 0 e 360 graus.')
  const perfis = perfisDe(f, ctx)
  const [p0, dir] = [f.eixo.ponto, f.eixo.dir]
  const len = Math.hypot(dir[0], dir[1])
  if (!(len > 0)) throw new ErroFeature('O eixo de revolução não tem direção.', 'Escolha um eixo com dois pontos distintos.')
  const d: Vec2 = [dir[0] / len, dir[1] / len]

  // perp = (p - p0) × d (distância com sinal ao eixo); along = (p - p0)·d (posição ao longo do eixo).
  const perp = (p: Vec2) => (p[0] - p0[0]) * d[1] - (p[1] - p0[1]) * d[0]
  const along = (p: Vec2) => (p[0] - p0[0]) * d[0] + (p[1] - p0[1]) * d[1]
  const pts = perfis.flatMap((p) => [...p.externo, ...p.furos.flat()])
  const temPos = pts.some((p) => perp(p) > EPS)
  const temNeg = pts.some((p) => perp(p) < -EPS)
  if (temPos && temNeg) throw new ErroFeature('O perfil cruza o eixo de revolução.', 'Mova o perfil para um lado do eixo.')
  const sinal = temNeg ? -1 : 1

  // Seção no referencial da revolução: x' = raio (≥ 0), y' = altura ao longo do eixo.
  const g = (p: Vec2): Vec2 => [sinal * perp(p), along(p)]
  const transf: Perfil[] = perfis.map((p) => ({ externo: p.externo.map(g), furos: p.furos.map((furo) => furo.map(g)) }))
  const cs = secaoDe(transf, ctx.lixo)
  const raioMax = Math.max(...pts.map((p) => sinal * perp(p)))

  let sol = ctx.lixo.add(Manifold.revolve(cs, segmentosCirculo(raioMax, ctx.tol), f.graus))
  if (f.simetrico) sol = ctx.lixo.add(sol.rotate([0, 0, -f.graus / 2]))

  // Referencial do sólido no plano local: X' = radial, Z' = eixo, Y' = Z' × X' (normal do plano).
  const X3: Vec3 = [sinal * d[1], -sinal * d[0], 0]
  const Z3: Vec3 = [d[0], d[1], 0]
  const Y3: Vec3 = [0, 0, -sinal] // Z' × X' de vetores no plano local: sempre ao longo de z
  const mat = [...X3, 0, ...Y3, 0, ...Z3, 0, p0[0], p0[1], 0, 1] as Mat4
  const local = ctx.lixo.add(sol.transform(mat))
  const ferr = ctx.lixo.add(noPlano(local, plano))
  return aplicaOperacao(ctx, f.id, ferr, f.operacao, f.alvo)
}
