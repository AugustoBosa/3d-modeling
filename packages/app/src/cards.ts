// Cards sobre a vista: Vista (Home e vistas), Aparência (sombreamento) e Desempenho (HUD e pixels).
import type { Vista } from './viewport/vista.ts'
import { esfera } from './viewport/esferas.ts'
import { T } from './textos.ts'
import { botao, campo, cartao, controle, el, segmentos } from './ui.ts'

export type NivelHud = 'ok' | 'atencao' | 'ruim'

export function criaCards(host: HTMLElement, vista: Vista, pixels: number, aoPixels: (n: 1 | 1.5 | 2) => void) {
  const col = (cls: string, ...cs: HTMLElement[]) => host.append(el('div', { class: `cards ${cls}` }, ...cs))

  // Vista
  const celular = matchMedia('(max-width: 699px)').matches // no celular os cards começam recolhidos: a vista é pequena
  const v = cartao(T.cards.vista, !celular)
  const proj: HTMLButtonElement = botao('', () => proj.textContent = vista.alternaProjecao() ? T.cards.ortografica : T.cards.perspectiva, T.cards.projDica)
  proj.textContent = T.cards.perspectiva
  v.c.append(botao(`${T.ico.home} ${T.cards.home}`, () => vista.enquadra(), T.cards.homeDica),
    botao(T.cards.frente, () => vista.vistaPara([0, -1, 0]), T.cards.frenteDica),
    botao(T.cards.direita, () => vista.vistaPara([1, 0, 0]), T.cards.direitaDica),
    botao(T.cards.topo, () => vista.vistaPara([0, 0, 1]), T.cards.topoDica), proj)
  v.c.classList.add('botoes')

  // Aparência (o sombreamento só tem efeito com sólidos, a partir da F2)
  const a = cartao(T.cards.aparencia, !celular)
  const esf = el('div', { class: 'esfs', title: T.cards.modosDica })
  const mapa = new Map<string, HTMLButtonElement>()
  for (const [k, nome] of Object.entries(T.cards.modos)) {
    const b = botao('', () => mapa.forEach((x, m) => x.classList.toggle('ativo', m === k)), nome)
    b.ariaLabel = nome; b.append(esfera(k)); mapa.set(k, b); esf.append(b)
  }
  mapa.get('solido')!.classList.add('ativo')
  a.c.append(esf)

  // Desempenho
  const d = cartao(T.cards.desempenho)
  let orcamento = 300
  const hud = el('span', { class: 'hud', title: T.cards.hudDica, textContent: T.status.semCursor })
  d.s.append(hud)
  const px = segmentos(Object.entries(T.pixelsRotulos), n => aoPixels(+n as 1 | 1.5 | 2))
  px.marca(String(pixels))
  d.c.append(campo(T.cards.pixels, px.el))
  controle(d.c, T.cards.orcamento, orcamento, 100, 1500, n => { orcamento = n }, 50)

  col('esq', v.d, d.d)
  col('', a.d)

  return {
    /** Mostra um tempo no HUD (card e barra de status): verde até o orçamento, amarelo até 1,5×, vermelho acima. */
    hud(ms: number): { nivel: NivelHud; texto: string } {
      const nivel: NivelHud = ms <= orcamento ? 'ok' : ms <= orcamento * 1.5 ? 'atencao' : 'ruim'
      const texto = `${nivel === 'ruim' ? T.ico.alerta : T.ico.ponto} ${ms < 10 ? ms.toFixed(1) : Math.round(ms)} ms`
      hud.className = `hud ${nivel}`; hud.textContent = texto
      d.d.classList.toggle('alerta', nivel === 'ruim')
      return { nivel, texto }
    },
    marcaPixels: (n: number) => px.marca(String(n)),
    marcaProjecao: (orto: boolean) => { proj.textContent = orto ? T.cards.ortografica : T.cards.perspectiva },
  }
}
