// Tema: escuro é o padrão; sem preferência salva, segue prefers-color-scheme (D24, D27).
export type PrefTema = 'auto' | 'claro' | 'escuro'
export type Tema = 'claro' | 'escuro'

export const temaEfetivo = (pref: PrefTema, sistemaClaro: boolean): Tema =>
  pref === 'auto' ? (sistemaClaro ? 'claro' : 'escuro') : pref

export const atributoTema = (t: Tema): 'light' | 'dark' => (t === 'claro' ? 'light' : 'dark')

const mq = () => matchMedia('(prefers-color-scheme: light)')

let prefAtual: PrefTema = 'auto'
let ouvindo = false

/** Põe data-theme em <html> e avisa quem desenha em canvas (vista 3D). Devolve o tema aplicado. */
export function aplicaTema(pref: PrefTema): Tema {
  prefAtual = pref
  const m = mq()
  const t = temaEfetivo(pref, m.matches)
  document.documentElement.dataset.theme = atributoTema(t)
  if (!ouvindo) {
    // Instala uma vez: com 'auto', acompanha a troca do sistema sem depender de quem chama.
    ouvindo = true
    m.addEventListener('change', () => { if (prefAtual === 'auto') aplicaTema(prefAtual) })
  }
  return t
}

/** Chama `f` quando o sistema troca de claro/escuro. */
export const aoMudarSistema = (f: () => void) => mq().addEventListener('change', f)
