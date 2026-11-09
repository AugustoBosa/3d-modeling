// Formatação das medidas (os textos moram em textos.ts, T.medir).
import { arredonda } from '@3dm/core/medir'
import { T } from '../textos.ts'

/** Número com 2 casas e vírgula decimal. */
export function numero(x: number): string {
  return arredonda(x, 2).toFixed(2).replace('.', ',')
}

export const textoDistancia = (v: number, dx: number, dy: number, dz: number): string =>
  `${T.medir.modos.distancia} ${numero(v)} mm (ΔX ${numero(dx)} ΔY ${numero(dy)} ΔZ ${numero(dz)})`
export const textoAngulo = (v: number): string => `${T.medir.modos.angulo} ${numero(v)}°`
export const textoRaio = (v: number): string => `${T.medir.modos.raio} ${numero(v)} mm`
export const textoArea = (v: number): string => `${T.medir.modos.area} ${numero(v)} mm²`
export const textoVolume = (v: number): string => `${T.medir.modos.volume} ${numero(v)} mm³`
