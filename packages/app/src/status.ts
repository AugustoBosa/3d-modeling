// Estado das teclas de função (PROJETO_BASE §7.2). Lógica pura; a barra de status (DOM) fica em barra.ts.
export type Modo = 'osnap' | 'grid' | 'ortho' | 'snap' | 'polar' | 'otrack' | 'dyn'

/** Tecla F → modo (AutoCAD). */
export const TECLA_F: Record<string, Modo> = { F3: 'osnap', F7: 'grid', F8: 'ortho', F9: 'snap', F10: 'polar', F11: 'otrack', F12: 'dyn' }
export const ORDEM: Modo[] = ['grid', 'snap', 'ortho', 'osnap', 'polar', 'otrack', 'dyn']

export type EstadoModos = Record<Modo, boolean>
export const estadoInicial = (): EstadoModos => ({ osnap: true, grid: true, ortho: false, snap: false, polar: false, otrack: false, dyn: true })

/** Liga ou desliga um modo. F8 (ORTHO) e F10 (POLAR) são exclusivos: ligar um desliga o outro (como no AutoCAD). */
export function alterna(e: EstadoModos, m: Modo): EstadoModos {
  const n = { ...e, [m]: !e[m] }
  if (n[m] && m === 'ortho') n.polar = false
  if (n[m] && m === 'polar') n.ortho = false
  return n
}
