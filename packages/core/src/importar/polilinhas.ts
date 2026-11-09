// Sketch a partir de polilinhas fechadas (ex.: contornos vindos do SVG). Um comando só: cria o sketch e grava pontos e linhas em anel.
// Sem restrições e sem solver: o perfil sai da detecção de perfis (sketch/perfis.ts), que já trata furos.
import type { Comando, Documento } from '../doc/index.ts'
import { aplicaAdicao, criarSketch, editaSketch } from '../sketch/comandos.ts'
import type { EntSk, Plano } from '../sketch/tipos.ts'

export function sketchDePolilinhas(contornos: [number, number][][], plano: Plano, escala = 1): Comando<Documento> & { readonly id: string } {
  // ids locais ('@'): aplicaAdicao troca por ids reais (p1, l1…) e liga as linhas pelo mapa
  const ents: EntSk[] = []
  contornos.forEach((c, ci) => {
    c.forEach(([x, y], i) => ents.push({ id: `@p${ci}_${i}`, tipo: 'ponto', x: x * escala, y: y * escala }))
    c.forEach((_, i) => ents.push({ id: `@l${ci}_${i}`, tipo: 'linha', a: `@p${ci}_${i}`, b: `@p${ci}_${(i + 1) % c.length}` }))
  })
  const criar = criarSketch(plano)
  let edita: Comando<Documento> | undefined
  return {
    nome: `SKETCH POLILINHAS ${plano.base}`,
    get id() { return criar.id },
    fazer(doc) {
      criar.fazer(doc)
      edita = editaSketch(`POLILINHAS ${plano.base}`, criar.id, (sk) => { aplicaAdicao(sk, { entidades: ents, restricoes: [] }) })
      edita.fazer(doc)
    },
    desfazer(doc) {
      edita?.desfazer(doc)
      criar.desfazer(doc)
    },
  }
}
