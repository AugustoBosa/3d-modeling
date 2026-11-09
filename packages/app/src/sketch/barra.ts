// Barra de ferramentas do sketch (só aparece no modo sketch). Tooltip: nome + alias AutoCAD + atalho (PROJETO_BASE §6.17).
import { FERRAMENTAS } from '../comandos/sketch.ts'
import { T } from '../textos.ts'
import { botao, el } from '../ui.ts'
import type { LetraRestricao } from '../teclado/despachante.ts'
import type { SessaoSketch } from './sessao.ts'

const DESENHO = ['LINHA', 'POLILINHA', 'RETANGULO', 'CIRCULO', 'ARCO', 'POLIGONO', 'SLOT', 'PONTO', 'CONSTRUCAO', 'DIM']
const RESTRICOES: LetraRestricao[] = ['H', 'V', 'I', 'T', 'E', 'B']

export function criaBarraSketch(host: HTMLElement, s: SessaoSketch) {
  const barra = el('div', { class: 'sk-barra', role: 'toolbar', ariaLabel: T.sk.barra, hidden: true })
  for (const n of DESENHO) {
    const f = FERRAMENTAS.find(x => x.nome === n)!
    barra.append(botao(f.aliases[0], () => s.inicia(n), T.sk.dica(T.sk.ferr[n], f.aliases[0])))
  }
  barra.append(el('span', { class: 'sep' }))
  for (const l of RESTRICOES) barra.append(botao(T.sk.simbolo[{ H: 'horizontal', V: 'vertical', I: 'coincidente', T: 'tangente', E: 'igual', B: 'paralela' }[l] as 'horizontal']
    , () => void s.aplicaRestricao(l), T.sk.dica(T.sk.restr[l], l, 'sketch')))
  host.append(barra)
  return { atualiza() { barra.hidden = !s.ativo } }
}
