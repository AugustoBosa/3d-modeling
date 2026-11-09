// Painéis laterais: navegador do projeto (esquerda: parâmetros e features) e propriedades (direita: painel de feature, seleção, projeto).
// Os conteúdos de parâmetros, árvore, painel e seleção são montados pelos módulos de features/ nos `hosts`.
import { impressoraPorId } from '@3dm/core/printers'
import type { Projeto } from './projeto.ts'
import { T } from './textos.ts'
import { el, secao } from './ui.ts'

export function criaPaineis(esq: HTMLElement, dir: HTMLElement) {
  esq.append(el('h2', { textContent: T.esq.titulo }))
  const parametros = secao(esq, T.esq.parametros), features = secao(esq, T.esq.features), slots = secao(esq, T.imprimir.slotsTitulo, false)
  dir.append(el('h2', { textContent: T.dir.titulo }))
  const painel = el('div', { id: 'painel-feature' }), propriedades = el('div', { id: 'propriedades' })
  dir.append(painel, propriedades)
  const proj = secao(dir, T.dir.projeto)
  const orientacao = secao(dir, T.orient.titulo, false), imprimir = secao(dir, T.imprimir.titulo, false)
  const importar = secao(dir, T.importar.titulo, false), expor = secao(dir, T.customizar.titulo, false)
  const customizar = el('div', { id: 'customizar-form' })
  dir.prepend(customizar)

  return {
    hosts: { parametros, features, painel, propriedades, slots, orientacao, imprimir, importar, expor, customizar },
    atualiza(p: Projeto) {
      const imp = impressoraPorId(p.doc.impressora)
      proj.replaceChildren(el('dl', { id: 'info-projeto' },
        el('dt', { textContent: T.dir.impressora }), el('dd', { textContent: imp?.nome ?? p.doc.impressora }),
        ...(imp ? [el('dt', { textContent: T.dir.volume }), el('dd', { textContent: T.volume(imp.volume.x, imp.volume.y, imp.volume.z) })] : [])))
    },
  }
}
