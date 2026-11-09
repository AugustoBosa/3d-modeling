// Features de sólido: primitivas, booleana, shell (prismático), padrão, espelho, corte e transformação.
import type { Manifold as MF, Mat4 } from 'manifold-3d'
import { Manifold, secao, segmentosCirculo } from '../kernel/index.ts'
import type { Lixo, Vec2, Vec3 } from '../kernel/tipos.ts'
import { aplicaOperacao, idAlvo } from './operacao.ts'
import { ErroFeature } from './tipos.ts'
import type { Ctx, Delta, FBooleana, FCorte, FEspelho, FPadrao, FPrimitiva, FShell, FTransformacao } from './tipos.ts'

const unitario = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2])
  if (!(l > 0)) throw new ErroFeature('Vetor nulo.', 'Use uma direção ou normal não nula.')
  return [v[0] / l, v[1] / l, v[2] / l]
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

function toro(R: number, r: number, ctx: Ctx): MF {
  if (!(R > r)) throw new ErroFeature('O raio maior do toro deve ser maior que o raio do tubo.', 'Use R > r.')
  const n = segmentosCirculo(r, ctx.tol)
  const circulo: Vec2[] = Array.from({ length: n }, (_, k) => {
    const t = (2 * Math.PI * k) / n
    return [R + r * Math.cos(t), r * Math.sin(t)]
  })
  return secao({ externo: circulo, furos: [] }, ctx.lixo).revolve(segmentosCirculo(R + r, ctx.tol))
}

function primitiva(f: FPrimitiva, ctx: Ctx): MF {
  const d = f.dim
  if (f.tipo === 'caixa') return Manifold.cube([d[0], d[1], d[2]])
  if (f.tipo === 'cilindro') return Manifold.cylinder(d[1], d[0], d[0], segmentosCirculo(d[0], ctx.tol))
  if (f.tipo === 'esfera') return Manifold.sphere(d[0], segmentosCirculo(d[0], ctx.tol))
  if (f.tipo === 'cone') return Manifold.cylinder(d[2], d[0], d[1], segmentosCirculo(Math.max(d[0], d[1]), ctx.tol))
  return toro(d[0], d[1], ctx)
}

export function executaPrimitiva(f: FPrimitiva, ctx: Ctx): Delta {
  const d = f.dim
  // Cone aceita rTopo = 0 (ponta); os demais exigem tudo > 0.
  const ok = f.tipo === 'cone' ? d[0] > 0 && d[1] >= 0 && d[2] > 0 : d.every((v) => v > 0)
  if (!ok) throw new ErroFeature('Dimensão inválida.', 'Use valores maiores que zero.')
  const m = ctx.lixo.add(primitiva(f, ctx))
  const [x, y, z] = f.pos
  const ferr = ctx.lixo.add(m.translate(x, y, z))
  return aplicaOperacao(ctx, f.id, ferr, f.operacao, f.alvo)
}

const OPERACOES: Record<FBooleana['op'], (a: MF, b: MF) => MF> = {
  unir: (a, b) => a.add(b),
  subtrair: (a, b) => a.subtract(b),
  interseccao: (a, b) => a.intersect(b),
}

export function executaBooleana(f: FBooleana, ctx: Ctx): Delta {
  if (f.alvo === undefined) throw new ErroFeature('A booleana não tem corpo-alvo.', 'Escolha o corpo que será modificado.')
  const a = idAlvo(ctx, f.alvo)
  for (const id of f.ferramentas)
    if (!ctx.corpos.has(id)) throw new ErroFeature(`A ferramenta "${id}" não existe neste ponto do histórico.`, 'Escolha outros corpos-ferramenta.')
  let acc: MF = ctx.corpos.get(a)!
  for (const id of f.ferramentas) acc = ctx.lixo.add(OPERACOES[f.op](acc, ctx.corpos.get(id)!))
  if (acc.isEmpty()) throw new ErroFeature('A booleana deixou o corpo vazio.', 'Ajuste as ferramentas: a peça inteira foi removida.')
  const delta: Delta = {}
  if (!f.manter) for (const id of f.ferramentas) delta[id] = null
  delta[a] = acc.translate(0, 0, 0)
  return delta
}

export function executaShell(f: FShell, ctx: Ctx): Delta {
  if (!(f.espessura > 0)) throw new ErroFeature('Espessura inválida.', 'Use uma espessura maior que zero.')
  const a = idAlvo(ctx, f.alvo)
  const corpo = ctx.corpos.get(a)!
  const proj = ctx.lixo.add(corpo.project())
  const { min, max } = corpo.boundingBox()
  const vol = corpo.volume()
  if (Math.abs(vol - proj.area() * (max[2] - min[2])) > 0.005 * vol)
    throw new ErroFeature('Shell só funciona em peças prismáticas (extrudadas em Z).', 'Use outra feature ou faça a casca no sketch.')

  const topo = f.abrir.includes('topo')
  const base = f.abrir.includes('base')
  const zb = base ? min[2] - 1 : min[2] + f.espessura
  const zt = topo ? max[2] + 1 : max[2] - f.espessura
  if (!(zt > zb)) throw new ErroFeature('A espessura é maior que a peça.', 'Use uma espessura menor.')

  const cavidadeXY = ctx.lixo.add(proj.offset(-f.espessura, 'Round', 2, segmentosCirculo(f.espessura, ctx.tol)))
  if (cavidadeXY.isEmpty()) throw new ErroFeature('A espessura consome toda a seção: não sobra cavidade.', 'Use uma espessura menor.')
  const cavidade = ctx.lixo.add(ctx.lixo.add(Manifold.extrude(cavidadeXY, zt - zb)).translate(0, 0, zb))

  const r = corpo.subtract(cavidade)
  if (r.isEmpty()) {
    r.delete()
    throw new ErroFeature('O shell deixou o corpo vazio.', 'Use uma espessura menor.')
  }
  return { [a]: r }
}

/** Matriz coluna-major de rotação de `ang` radianos em torno do eixo (p, k unitário), Rodrigues + translação. */
function rotacaoEm(p: Vec3, k: Vec3, ang: number): Mat4 {
  const c = Math.cos(ang), s = Math.sin(ang), t = 1 - c
  const [x, y, z] = k
  const R = [
    [c + t * x * x, t * x * y - s * z, t * x * z + s * y],
    [t * x * y + s * z, c + t * y * y, t * y * z - s * x],
    [t * x * z - s * y, t * y * z + s * x, c + t * z * z],
  ]
  const tr = [0, 1, 2].map((i) => p[i] - (R[i][0] * p[0] + R[i][1] * p[1] + R[i][2] * p[2]))
  return [R[0][0], R[1][0], R[2][0], 0, R[0][1], R[1][1], R[2][1], 0, R[0][2], R[1][2], R[2][2], 0, tr[0], tr[1], tr[2], 1] as Mat4
}

function copias(f: FPadrao, corpo: MF, ctx: Ctx): MF[] {
  if (f.modo === 'linear') {
    if (!f.dir || f.passo === undefined) throw new ErroFeature('Padrão linear sem direção ou passo.', 'Informe a direção e o passo.')
    const u = unitario(f.dir)
    return Array.from({ length: f.n }, (_, i) => {
      const k = f.passo! * i
      return ctx.lixo.add(corpo.translate(u[0] * k, u[1] * k, u[2] * k))
    })
  }
  if (!f.eixo) throw new ErroFeature('Padrão circular sem eixo.', 'Escolha o eixo de rotação.')
  const u = unitario(f.eixo.dir)
  const graus = f.graus ?? 360
  const passo = graus >= 360 ? 360 / f.n : f.n > 1 ? graus / (f.n - 1) : 0
  return Array.from({ length: f.n }, (_, i) => ctx.lixo.add(corpo.transform(rotacaoEm(f.eixo!.ponto, u, (i * passo * Math.PI) / 180))))
}

export function executaPadrao(f: FPadrao, ctx: Ctx): Delta {
  if (!Number.isInteger(f.n) || f.n < 1) throw new ErroFeature('Número de cópias inválido.', 'Use um inteiro maior ou igual a 1.')
  const a = idAlvo(ctx, f.alvo)
  return { [a]: Manifold.union(copias(f, ctx.corpos.get(a)!, ctx)) }
}

export function executaEspelho(f: FEspelho, ctx: Ctx): Delta {
  const a = idAlvo(ctx, f.alvo)
  const corpo = ctx.corpos.get(a)!
  const o = f.plano.origem
  const n = unitario(f.plano.normal)
  const emOrigem = ctx.lixo.add(corpo.translate(-o[0], -o[1], -o[2]))
  const espelhado = ctx.lixo.add(ctx.lixo.add(emOrigem.mirror(n)).translate(o[0], o[1], o[2]))
  if (f.manter === false) return { [a]: espelhado.translate(0, 0, 0) }
  return { [a]: Manifold.union([corpo, espelhado]) }
}

export function executaCorte(f: FCorte, ctx: Ctx): Delta {
  const a = idAlvo(ctx, f.alvo)
  const corpo = ctx.corpos.get(a)!
  const n = unitario(f.plano.normal)
  const off = dot(f.plano.origem, n)
  if (f.manter === 'ambos') {
    const [acima, abaixo] = corpo.splitByPlane(n, off)
    if (acima.isEmpty() || abaixo.isEmpty()) {
      acima.delete(); abaixo.delete()
      throw new ErroFeature('O corte deixou uma das partes vazia.', 'Mova o plano para dentro do corpo.')
    }
    return { [a]: acima, [`${a}_b`]: abaixo }
  }
  // trimByPlane mantém o lado para onde aponta a normal; 'abaixo' é o mesmo corte com a normal invertida.
  const r = f.manter === 'acima' ? corpo.trimByPlane(n, off) : corpo.trimByPlane([-n[0], -n[1], -n[2]], -off)
  if (r.isEmpty()) {
    r.delete()
    throw new ErroFeature('O corte deixou o corpo vazio.', 'Mova o plano para dentro do corpo.')
  }
  return { [a]: r }
}

/** Aplica `fn` em torno do pivô: leva o pivô à origem, opera, devolve. Intermediários no lixo. */
function emTorno(m: MF, p: Vec3, fn: (x: MF) => MF, lixo: Lixo): MF {
  const a = lixo.add(m.translate(-p[0], -p[1], -p[2]))
  const b = lixo.add(fn(a))
  return lixo.add(b.translate(p[0], p[1], p[2]))
}

export function executaTransformacao(f: FTransformacao, ctx: Ctx): Delta {
  const a = idAlvo(ctx, f.alvo)
  const p: Vec3 = f.pivo ?? [0, 0, 0]
  let m = ctx.corpos.get(a)!
  if (f.escala !== undefined) m = emTorno(m, p, (x) => x.scale(f.escala!), ctx.lixo)
  if (f.girar) m = emTorno(m, p, (x) => x.rotate(f.girar!), ctx.lixo)
  if (f.mover) m = ctx.lixo.add(m.translate(f.mover[0], f.mover[1], f.mover[2]))
  return { [f.copiaId ?? a]: m.translate(0, 0, 0) }
}
