// Registro alias → comando e sessão da linha de comando (PROJETO_BASE §6.4, §7.1). Lógica pura, sem DOM.
// Enter/Espaço executa · vazio repete o último · Esc cancela · "última definição vale" (modelo do acad.pgp, §7.6).
import { T } from '../textos.ts'

export interface Contexto {
  /** Argumentos digitados na mesma linha (colados); as perguntas consomem antes de perguntar de verdade. */
  args: string[]
  /** Pergunta ao usuário. `resto`: se a resposta veio nos args, junta todos. Devolve null se o usuário apertou Esc. */
  pergunta(texto: string, resto?: boolean): Promise<string | null>
  escreve(texto: string, tipo?: TipoLinha): void
}
export type TipoLinha = 'entrada' | 'prompt' | 'info' | 'erro'

export interface Comando {
  nome: string
  aliases: string[]
  descricao: string
  executa(c: Contexto): void | Promise<void>
}

export interface Registro {
  registra(c: Comando): void
  /** Alias ou nome → comando (sem diferenciar maiúsculas). */
  resolve(alias: string): Comando | undefined
  /** Aliases e nomes que começam com `prefixo`, em ordem alfabética, sem repetir. */
  sugere(prefixo: string): string[]
  /** Novo alias para um comando (nome ou alias existente). Última definição vale. False se o comando não existe. */
  defineAlias(alias: string, nomeComando: string): boolean
  /** Comandos únicos, na ordem de registro. */
  lista(): Comando[]
}

export function criaRegistro(): Registro {
  const mapa = new Map<string, Comando>()
  const comandos = new Map<string, Comando>()
  const resolve = (a: string) => mapa.get(a.toUpperCase())
  return {
    registra(c) { comandos.set(c.nome, c); for (const a of [c.nome, ...c.aliases]) mapa.set(a.toUpperCase(), c) },
    resolve,
    sugere(p) {
      const u = p.toUpperCase()
      return u ? [...mapa.keys()].filter(k => k.startsWith(u)).sort() : []
    },
    defineAlias(alias, nomeComando) {
      const c = resolve(nomeComando)
      if (c) mapa.set(alias.toUpperCase(), c)
      return !!c
    },
    lista: () => [...comandos.values()],
  }
}

export interface Sessao {
  /** Uma linha digitada (Enter/Espaço). Devolve uma promessa que termina quando o comando termina. */
  envia(texto: string): Promise<void>
  /** Esc: cancela a pergunta em andamento. */
  cancela(): void
  /** Texto da pergunta que espera resposta, ou null. */
  readonly pendente: string | null
  readonly entradas: readonly string[]
}

/** Ferramenta de desenho ativa (sketch): enquanto `ativo()`, todo texto digitado vai para ela em vez de virar comando. */
export interface Desvio { ativo(): boolean; prompt(): string | null; texto(t: string): void; vazio(): void; esc(): void }

/** `escreve` recebe cada linha do histórico; `aoMudar` avisa quando `pendente` muda; `desvio` (opcional) captura a entrada. */
export function criaSessao(reg: Registro, escreve: (t: string, tipo: TipoLinha) => void, aoMudar: () => void = () => {}, desvio?: Desvio): Sessao {
  let pendente: { texto: string; resolve: (r: string | null) => void } | null = null
  let ultimo = ''
  const entradas: string[] = []

  async function roda(alias: string, args: string[]) {
    const cmd = reg.resolve(alias)
    escreve(`${T.linha.prompt} ${[alias, ...args].join(' ')}`, 'entrada')
    if (!cmd) return void escreve(T.linha.desconhecido(alias), 'erro')
    ultimo = alias
    const c: Contexto = {
      args,
      escreve,
      pergunta(texto, resto = false) {
        if (args.length) return Promise.resolve(resto ? args.splice(0).join(' ') : args.shift()!)
        escreve(texto, 'prompt')
        return new Promise(resolve => { pendente = { texto, resolve }; aoMudar() })
      },
    }
    try { await cmd.executa(c) } catch (e) { escreve(T.linha.falhou(cmd.nome, (e as Error).message), 'erro') }
  }

  return {
    async envia(texto) {
      const t = texto.trim()
      if (!pendente && desvio?.ativo()) {
        if (t) { escreve(`${T.linha.prompt} ${t}`, 'entrada'); desvio.texto(t) } else desvio.vazio()
        return
      }
      if (pendente) {
        const p = pendente
        pendente = null; aoMudar()
        escreve(`${T.linha.prompt} ${t}`, 'entrada')
        return void p.resolve(t)
      }
      if (!t) return ultimo ? roda(ultimo, []) : undefined // Enter/Espaço vazio repete o último
      entradas.push(t)
      const [alias, ...args] = t.split(/\s+/)
      return roda(alias, args)
    },
    cancela() {
      if (!pendente && desvio?.ativo()) return desvio.esc()
      if (!pendente) return
      const p = pendente
      pendente = null; aoMudar()
      escreve(T.linha.cancelado, 'info')
      p.resolve(null)
    },
    get pendente() { return pendente?.texto ?? (desvio?.ativo() ? desvio.prompt() ?? T.linha.prompt : null) },
    entradas,
  }
}
