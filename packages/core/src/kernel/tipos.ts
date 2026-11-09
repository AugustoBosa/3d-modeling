// Tipos do kernel e do contrato com o sketch (rodada 1 da F2). Tudo em mm e graus.
// Perfil e PlanoLocal são o que o sketch entrega (polígonos simples, no plano local do sketch).
export type Vec2 = [number, number]
export type Vec3 = [number, number, number]

/** Polígono externo + furos, no plano local (x, y). Sem autointerseção; furos dentro do externo. */
export interface Perfil { externo: Vec2[]; furos: Vec2[][] }

/** Plano do sketch no mundo: o local (x, y, z) vira origem + x·eixoX + y·(normal × eixoX) + z·normal.
 *  `eixoX` e `normal` perpendiculares; não precisam vir normalizados. */
export interface PlanoLocal { origem: Vec3; normal: Vec3; eixoX: Vec3 }

/** Tolerâncias cordais (§5.3): prévia 0,05 mm, export 0,01 mm. */
export const TOL_PREVIA = 0.05
export const TOL_EXPORT = 0.01

/** Lista de sólidos intermediários a liberar (§4.3 item 5). `add` devolve o próprio objeto; `limpa` chama delete() em todos. */
export interface Lixo {
  add<T extends { delete(): void }>(x: T): T
  limpa(): void
  readonly tamanho: number
}
