// Registra no registro de comandos (linha de comando) as ferramentas e edições do sketch. Aliases: PROJETO_BASE §7.1.
import { adicionaRestricao } from '@3dm/core/sketch'
import type { Projeto } from '../projeto.ts'
import type { Registro } from '../linha/registro.ts'
import { EDITORES } from '../sketch/editores.ts'
import type { SessaoSketch } from '../sketch/sessao.ts'
import { T } from '../textos.ts'

/** Ferramentas de desenho e cota (os editores vêm de EDITORES). */
export const FERRAMENTAS: { nome: string; aliases: string[] }[] = [
  { nome: 'LINHA', aliases: ['L'] }, { nome: 'POLILINHA', aliases: ['PL'] }, { nome: 'RETANGULO', aliases: ['REC'] },
  { nome: 'CIRCULO', aliases: ['C'] }, { nome: 'ARCO', aliases: ['A'] }, { nome: 'POLIGONO', aliases: ['POL'] },
  { nome: 'SLOT', aliases: ['SLOT'] }, { nome: 'PONTO', aliases: ['PO'] }, { nome: 'CONSTRUCAO', aliases: ['XL'] },
  { nome: 'DIM', aliases: ['DIM'] },
]

export const TODOS_COMANDOS_SKETCH = [...FERRAMENTAS, ...Object.entries(EDITORES).map(([nome, e]) => ({ nome, aliases: e.aliases }))]

export function registraSketch(reg: Registro, s: SessaoSketch, projeto: Projeto) {
  for (const { nome, aliases } of TODOS_COMANDOS_SKETCH) {
    reg.registra({
      nome, aliases, descricao: T.sk.ferr[nome] ?? nome,
      executa(c) { s.inicia(nome); for (const a of c.args.splice(0)) s.texto(a) }, // argumentos colados ("REC 0,0 @80,50") entram como respostas
    })
  }
  reg.registra({
    nome: 'SKETCH', aliases: ['SK'], descricao: T.sk.comandoSketch,
    executa(c) {
      const p = (c.args[0] ?? '').toUpperCase()
      if (p && p !== 'XY' && p !== 'XZ' && p !== 'YZ') return c.escreve(T.sk.planoInvalido(p), 'erro')
      s.entra((p || undefined) as 'XY' | 'XZ' | 'YZ' | undefined)
    },
  })
  reg.registra({ nome: 'SAIR', aliases: ['FIMSK'], descricao: T.sk.comandoSair, executa: () => s.sai() })
  reg.registra({ nome: 'TUDO', aliases: ['SELALL'], descricao: T.sk.comandoTudo, executa: () => s.selecionaTudo() })
  reg.registra({
    nome: 'FIXAR', aliases: ['FIX'], descricao: T.sk.comandoFixar,
    executa(c) {
      const v = s.vista()
      const pts = v ? v.sk.entidades.filter(e => e.tipo === 'ponto' && s.selecao.has(e.id)) : []
      if (!v || !pts.length) return c.escreve(T.sk.fixarNada, 'erro')
      for (const p of pts) if (p.tipo === 'ponto') projeto.executa(adicionaRestricao(v.sk.id, 'fixa', [p.id], { xy: [p.x, p.y] }))
      c.escreve(T.sk.restricao(T.sk.restricaoNomes.fixa), 'info')
    },
  })
}
