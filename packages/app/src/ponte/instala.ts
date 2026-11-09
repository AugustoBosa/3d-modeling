// Liga a ponte MCP ao app: indicador na barra de status, comando PONTE e conexão automática com o token do #token=.
import type { Registro } from '../linha/registro.ts'
import type { Projeto } from '../projeto.ts'
import { T } from '../textos.ts'
import { el } from '../ui.ts'
import type { Vista } from '../viewport/vista.ts'
import { criaCapturador } from './captura.ts'
import { criaClientePonte, tokenDoHash } from './cliente.ts'

const CHAVE = '3dm.ponte.token'
const guarda = (t: string | null) => { try { if (t) sessionStorage.setItem(CHAVE, t); else sessionStorage.removeItem(CHAVE) } catch { /* armazenamento bloqueado: segue sem lembrar */ } }
const lembrado = () => { try { return sessionStorage.getItem(CHAVE) } catch { return null } }

export function instalaPonte(o: { projeto: Projeto; vista: Vista; status: HTMLElement; reg: Registro; aviso(t: string, erro?: boolean): void; aguarda(): Promise<void> }) {
  const ind = el('span', { class: 'ponte', textContent: `${T.ponte.rotulo} ○`, title: T.ponte.dica })
  o.status.insertBefore(ind, o.status.querySelector('.espaco'))
  const renderiza = criaCapturador(o.vista)
  // Espera a regeneração em curso: sem isso a imagem sai com a malha de antes da última tool.
  const capturar: typeof renderiza = async (vistas, opc) => { await o.aguarda(); return renderiza(vistas, opc) }
  Object.assign(window, { __3dmCapturar: capturar }) // conferência manual no navegador
  const cliente = criaClientePonte({
    projeto: o.projeto,
    capturar,
    textos: T.ponte,
    aoEstado(e, texto) {
      ind.textContent = `${T.ponte.rotulo} ${e === 'conectado' ? '●' : e === 'desconectado' ? '○' : '◐'}`
      ind.title = texto
      ind.dataset.estado = e
      if (e === 'conectado' || e === 'reconectando' || texto.length > 60) o.aviso(texto, e !== 'conectado')
    },
  })
  const conecta = (t: string) => { guarda(t); cliente.conecta(t) }
  o.reg.registra({
    nome: 'PONTE', aliases: [], descricao: T.ponte.comando,
    async executa(c) {
      const t = (await c.pergunta(T.ponte.perguntaToken))?.trim()
      if (t === undefined) return
      if (t) conecta(t)
      else { guarda(null); cliente.desconecta(); c.escreve(T.ponte.desconectou) }
    },
  })
  const doHash = tokenDoHash(location.hash)
  if (doHash) history.replaceState(null, '', location.pathname + location.search) // tira o token da barra de endereço
  const token = doHash ?? lembrado()
  if (token) conecta(token)
  return cliente
}
