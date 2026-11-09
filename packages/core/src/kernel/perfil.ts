import type { CrossSection as CS, Manifold as MF, Mat4 } from 'manifold-3d'
import { CrossSection } from './kernel.ts'
import type { Lixo, Perfil, PlanoLocal, Vec3 } from './tipos.ts'

/** Nº de segmentos para a flecha ≤ tol: múltiplo de 4, em [8, 360]. */
export function segmentosCirculo(raio: number, tol: number): number {
  const n = tol >= raio ? 8 : Math.ceil(Math.PI / Math.acos(1 - tol / raio))
  return Math.min(360, Math.max(8, Math.ceil(n / 4) * 4))
}

function normaliza(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2])
  return [v[0] / l, v[1] / l, v[2] / l]
}

function cruz(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

/** Matriz coluna-major: colunas X', Y' = Z' × X', Z' e origem. */
export function matrizPlano(p: PlanoLocal): Mat4 {
  const z = normaliza(p.normal)
  const x = normaliza(p.eixoX)
  const y = cruz(z, x)
  return [...x, 0, ...y, 0, ...z, 0, ...p.origem, 1] as Mat4
}

/** Seção 2D de um perfil (externo + furos, regra EvenOdd), registrada no lixo. */
export function secao(perfil: Perfil, lixo: Lixo): CS {
  return lixo.add(new CrossSection([perfil.externo, ...perfil.furos], 'EvenOdd'))
}

/** União das seções de todos os perfis, registrada no lixo. */
export function secaoDe(perfis: Perfil[], lixo: Lixo): CS {
  if (perfis.length === 0) throw new Error('Nenhum perfil.')
  const secoes = perfis.map((p) => secao(p, lixo))
  return lixo.add(CrossSection.union(secoes))
}

/** Leva um sólido do plano local (x, y, z) para o plano do sketch. Novo objeto, não registra no lixo. */
export function noPlano(m: MF, p: PlanoLocal): MF {
  return m.transform(matrizPlano(p))
}
