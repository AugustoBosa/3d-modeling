// Editores do sketch (M CO RO SC MI E Q TR EX O F CHA AR ARP): cada um é uma lista estática de passos e um `aplica`
// que chama a função geométrica de @3dm/core/sketch. Os textos vêm de T.ed / T.ferr.
import type { Pt, SketchFeature } from '@3dm/core/sketch'
import { alternaConstrucao, apagar, aparar, arrayPolar, arrayRetangular, chanfro, copiar, escalar, espelhar, estender, fillet, girar, mover, offset } from '@3dm/core/sketch'
import type { FabricaEditor, PassoEd, Resp } from './editor.ts'
import { T } from '../textos.ts'

// Respostas faltando (passo não respondido): seleção vazia usa a mensagem de "nada selecionado"; o resto, "valor inválido".
const selecao = (r: Resp | undefined): string[] => {
  if (!r?.sel?.length) throw new Error(T.ed.nadaSelecionado)
  return r.sel
}
const entidade = (r: Resp | undefined): string => {
  if (!r?.id) throw new Error(T.ed.nadaSelecionado)
  return r.id
}
const ponto = (r: Resp | undefined): Pt => {
  if (!r?.p) throw new Error(T.ferr.invalido)
  return r.p
}
const valor = (r: Resp | undefined): number => {
  if (r?.v === undefined) throw new Error(T.ferr.invalido)
  return r.v
}
const opcao = (r: Resp | undefined): string => {
  if (r?.opcao === undefined) throw new Error(T.ferr.invalido)
  return r.opcao
}
const inteiro = (v: number) => Math.max(1, Math.round(v))

const passoSel = (prompt: string): PassoEd => ({ k: 'selecao', prompt })
const passoPonto = (prompt: string): PassoEd => ({ k: 'ponto', prompt })
const passoValor = (prompt: string): PassoEd => ({ k: 'valor', prompt })
const passoEnt = (prompt: string): PassoEd => ({ k: 'entidade', prompt })

const MOVER: FabricaEditor = () => ({
  nome: 'MOVER',
  passos: [passoSel(T.ed.selecionar), passoPonto(T.ed.base), passoPonto(T.ed.destino)],
  aplica(sk: SketchFeature, r: Resp[]) {
    const a = ponto(r[1]), b = ponto(r[2])
    mover(sk, selecao(r[0]), b.x - a.x, b.y - a.y)
  },
})

const COPIAR: FabricaEditor = () => ({
  nome: 'COPIAR',
  passos: [passoSel(T.ed.selecionar), passoPonto(T.ed.base), passoPonto(T.ed.destino)],
  aplica(sk: SketchFeature, r: Resp[]) {
    const a = ponto(r[1]), b = ponto(r[2])
    copiar(sk, selecao(r[0]), b.x - a.x, b.y - a.y)
  },
})

const GIRAR: FabricaEditor = () => ({
  nome: 'GIRAR',
  passos: [passoSel(T.ed.selecionar), passoPonto(T.ed.base), passoValor(T.ed.angulo)],
  aplica(sk: SketchFeature, r: Resp[]) {
    girar(sk, selecao(r[0]), ponto(r[1]), valor(r[2]))
  },
})

const ESCALAR: FabricaEditor = () => ({
  nome: 'ESCALAR',
  passos: [passoSel(T.ed.selecionar), passoPonto(T.ed.base), passoValor(T.ed.fator)],
  aplica(sk: SketchFeature, r: Resp[]) {
    escalar(sk, selecao(r[0]), ponto(r[1]), valor(r[2]))
  },
})

const ESPELHAR: FabricaEditor = () => ({
  nome: 'ESPELHAR',
  passos: [
    passoSel(T.ed.selecionar), passoPonto(T.ed.espelho1), passoPonto(T.ed.espelho2),
    { k: 'opcao', prompt: T.ed.apagarOrigem, opcoes: [T.ed.op.sim, T.ed.op.nao] },
  ],
  aplica(sk: SketchFeature, r: Resp[]) {
    espelhar(sk, selecao(r[0]), ponto(r[1]), ponto(r[2]), opcao(r[3]) === T.ed.op.nao)
  },
})

const APAGAR: FabricaEditor = () => ({
  nome: 'APAGAR',
  passos: [passoSel(T.ed.selecionar)],
  aplica(sk: SketchFeature, r: Resp[]) {
    apagar(sk, selecao(r[0]))
  },
})

const CONSTRUCAO_ALT: FabricaEditor = () => ({
  nome: 'CONSTRUCAO_ALT',
  passos: [passoSel(T.ed.selecionar)],
  aplica(sk: SketchFeature, r: Resp[]) {
    alternaConstrucao(sk, selecao(r[0]))
  },
})

const APARAR: FabricaEditor = () => ({
  nome: 'APARAR',
  passos: [passoEnt(T.ed.apara)],
  repete: true,
  aplica(sk: SketchFeature, r: Resp[]) {
    aparar(sk, entidade(r[0]), ponto(r[0]))
  },
})

const ESTENDER: FabricaEditor = () => ({
  nome: 'ESTENDER',
  passos: [passoEnt(T.ed.estende)],
  repete: true,
  aplica(sk: SketchFeature, r: Resp[]) {
    estender(sk, entidade(r[0]), ponto(r[0]))
  },
})

const OFFSET: FabricaEditor = () => ({
  nome: 'OFFSET',
  passos: [passoValor(T.ed.offDist), passoEnt(T.ed.offObj), passoPonto(T.ed.offLado)],
  aplica(sk: SketchFeature, r: Resp[]) {
    offset(sk, entidade(r[1]), valor(r[0]), ponto(r[2]))
  },
})

const FILLET: FabricaEditor = () => ({
  nome: 'FILLET',
  passos: [passoValor(T.ed.filRaio), passoEnt(T.ed.filObj1), passoEnt(T.ed.filObj2)],
  aplica(sk: SketchFeature, r: Resp[]) {
    fillet(sk, entidade(r[1]), entidade(r[2]), valor(r[0]))
  },
})

const CHANFRO: FabricaEditor = () => ({
  nome: 'CHANFRO',
  passos: [passoValor(T.ed.chaD1), passoValor(T.ed.chaD2), passoEnt(T.ed.filObj1), passoEnt(T.ed.filObj2)],
  aplica(sk: SketchFeature, r: Resp[]) {
    chanfro(sk, entidade(r[2]), entidade(r[3]), valor(r[0]), valor(r[1]))
  },
})

const ARRAY: FabricaEditor = () => ({
  nome: 'ARRAY',
  passos: [passoSel(T.ed.selecionar), passoValor(T.ed.arNx), passoValor(T.ed.arNy), passoValor(T.ed.arDx), passoValor(T.ed.arDy)],
  aplica(sk: SketchFeature, r: Resp[]) {
    arrayRetangular(sk, selecao(r[0]), inteiro(valor(r[1])), inteiro(valor(r[2])), valor(r[3]), valor(r[4]))
  },
})

const ARRAYPOLAR: FabricaEditor = () => ({
  nome: 'ARRAYPOLAR',
  passos: [passoSel(T.ed.selecionar), passoPonto(T.ed.arCentro), passoValor(T.ed.arN), passoValor(T.ed.arAng)],
  aplica(sk: SketchFeature, r: Resp[]) {
    arrayPolar(sk, selecao(r[0]), ponto(r[1]), valor(r[2]), valor(r[3]))
  },
})

export const EDITORES: Record<string, { aliases: string[]; fabrica: FabricaEditor }> = {
  MOVER: { aliases: ['M'], fabrica: MOVER },
  COPIAR: { aliases: ['CO', 'CP'], fabrica: COPIAR },
  GIRAR: { aliases: ['RO'], fabrica: GIRAR },
  ESCALAR: { aliases: ['SC'], fabrica: ESCALAR },
  ESPELHAR: { aliases: ['MI'], fabrica: ESPELHAR },
  APAGAR: { aliases: ['E', 'ERASE'], fabrica: APAGAR },
  CONSTRUCAO_ALT: { aliases: ['Q'], fabrica: CONSTRUCAO_ALT },
  APARAR: { aliases: ['TR'], fabrica: APARAR },
  ESTENDER: { aliases: ['EX'], fabrica: ESTENDER },
  OFFSET: { aliases: ['O'], fabrica: OFFSET },
  FILLET: { aliases: ['F'], fabrica: FILLET },
  CHANFRO: { aliases: ['CHA'], fabrica: CHANFRO },
  ARRAY: { aliases: ['AR'], fabrica: ARRAY },
  ARRAYPOLAR: { aliases: ['ARP'], fabrica: ARRAYPOLAR },
}
