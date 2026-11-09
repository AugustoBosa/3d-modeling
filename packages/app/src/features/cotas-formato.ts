// Formatação das cotas 3D (os textos moram em textos.ts, T.medirUi).
import { arredonda } from '@3dm/core/medir'
import { T } from '../textos.ts'

/** Número com 2 casas e vírgula decimal (pt-BR). */
export function numeroPtBr(x: number): string {
  return arredonda(x, 2).toFixed(2).replace('.', ',')
}

/** Rótulo de uma cota da caixa: "L 80,00 mm". */
export const rotuloCota = (letra: keyof typeof T.medirUi.cota, valor: number): string =>
  `${T.medirUi.cota[letra]} ${numeroPtBr(valor)} ${T.medirUi.sufixo}`
