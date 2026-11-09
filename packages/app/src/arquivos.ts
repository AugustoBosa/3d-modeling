// Salvar/abrir pelo seletor do sistema (File System Access API) e lista de recentes (IndexedDB 3dm-recentes).
// Sem a API, usa o download e o input de persistencia.ts. Nenhum texto de UI aqui: tudo vem de textos.ts.
import { lerDocumento, textoDocumento } from '@3dm/core/doc'
import type { Documento } from '@3dm/core/doc'
import { abreArquivo, baixaDocumento } from './persistencia.ts'
import type { Projeto } from './projeto.ts'
import { T } from './textos.ts'

/** Mínimo da File System Access API (o TypeScript não declara tudo). */
interface ArquivoFsa {
  readonly name: string
  getFile(): Promise<{ name: string; text(): Promise<string> }>
  createWritable(): Promise<{ write(dado: string): Promise<void>; close(): Promise<void> }>
  queryPermission(o: { mode: 'read' | 'readwrite' }): Promise<string>
  requestPermission(o: { mode: 'read' | 'readwrite' }): Promise<string>
}

interface JanelaFsa {
  showSaveFilePicker?(o: { suggestedName: string; types: Tipo[] }): Promise<ArquivoFsa>
  showOpenFilePicker?(o: { types: Tipo[]; multiple: false }): Promise<ArquivoFsa[]>
}

interface Tipo { description: string; accept: Record<string, string[]> }

interface Registro { id: number; nome: string; em: number; doc: Documento; handle?: ArquivoFsa }

export interface Recente { id: string; nome: string }

const TIPOS: Tipo[] = [{ description: T.titulo, accept: { 'application/json': ['.json'] } }]
const BANCO = '3dm-recentes', LOJA = 'recentes'

/** Um item por nome (o mais novo), do mais recente para o mais antigo, cortado em `max`. */
export function ordenaRecentes<T extends { id: string; nome: string; em: number }>(itens: T[], max = 8): T[] {
  const porNome = new Map<string, T>()
  for (const it of itens) {
    const antigo = porNome.get(it.nome)
    if (!antigo || it.em > antigo.em) porNome.set(it.nome, it)
  }
  return [...porNome.values()].sort((a, b) => b.em - a.em).slice(0, max)
}

const fsa = () => window as unknown as JanelaFsa
const msg = (e: unknown) => e instanceof Error ? e.message : String(e)
const cancelado = (e: unknown) => (e as { name?: string } | null)?.name === 'AbortError'

async function temPermissao(h: ArquivoFsa, mode: 'read' | 'readwrite'): Promise<boolean> {
  if (await h.queryPermission({ mode }) === 'granted') return true
  return await h.requestPermission({ mode }) === 'granted'
}

function abre(): Promise<IDBDatabase> {
  return new Promise((ok, falha) => {
    const r = indexedDB.open(BANCO, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(LOJA, { keyPath: 'id', autoIncrement: true })
    r.onsuccess = () => ok(r.result)
    r.onerror = () => falha(r.error)
  })
}

async function transacao<R>(modo: IDBTransactionMode, f: (l: IDBObjectStore) => IDBRequest<R>): Promise<R> {
  const db = await abre()
  try {
    return await new Promise<R>((ok, falha) => {
      const t = db.transaction(LOJA, modo), r = f(t.objectStore(LOJA))
      t.oncomplete = () => ok(r.result)
      t.onerror = t.onabort = () => falha(t.error)
    })
  } finally { db.close() }
}

/** Registra o arquivo nos recentes (substitui a entrada de mesmo nome). Falha calada: o arquivo já foi salvo ou aberto. */
async function lembra(nome: string, doc: Documento, handle?: ArquivoFsa): Promise<void> {
  try {
    const db = await abre()
    try {
      await new Promise<void>((ok, falha) => {
        const t = db.transaction(LOJA, 'readwrite'), l = t.objectStore(LOJA)
        const todos = l.getAll()
        todos.onsuccess = () => {
          for (const r of todos.result as Registro[]) if (r.nome === nome) l.delete(r.id)
          l.add({ nome, em: Date.now(), doc, handle })
        }
        t.oncomplete = () => ok()
        t.onerror = t.onabort = () => falha(t.error)
      })
    } finally { db.close() }
  } catch { /* armazenamento bloqueado: sem lista de recentes */ }
}

export function criaArquivos(d: { projeto: Projeto; aviso(t: string, erro?: boolean): void }): {
  salvar(): Promise<void>
  salvarComo(): Promise<void>
  abrir(): Promise<void>
  recentes(): Promise<Recente[]>
  abreRecente(id: string): Promise<void>
  limpaRecentes(): Promise<void>
} {
  const { projeto, aviso } = d
  let atual: ArquivoFsa | null = null

  async function escreve(h: ArquivoFsa, doc: Documento): Promise<void> {
    const w = await h.createWritable()
    await w.write(textoDocumento(doc))
    await w.close()
  }

  async function salvarComo(): Promise<void> {
    const doc = projeto.doc
    try {
      const j = fsa()
      if (!j.showSaveFilePicker) {
        const nome = baixaDocumento(doc)
        await lembra(nome, doc)
        aviso(T.arquivo.salvo(nome))
        return
      }
      const h = await j.showSaveFilePicker({ suggestedName: `${doc.nome || T.arquivo.padrao}.3dm.json`, types: TIPOS })
      await escreve(h, doc)
      atual = h
      await lembra(h.name, doc, h)
      aviso(T.recentes.salvoEm(h.name))
    } catch (e) {
      if (!cancelado(e)) aviso(T.arquivo.salvarFalhou(msg(e)), true)
    }
  }

  async function salvar(): Promise<void> {
    if (!atual) return salvarComo()
    const h = atual, doc = projeto.doc
    try {
      if (!(await temPermissao(h, 'readwrite'))) return salvarComo()
      await escreve(h, doc)
      await lembra(h.name, doc, h)
      aviso(T.recentes.salvoEm(h.name))
    } catch (e) {
      aviso(T.arquivo.salvarFalhou(msg(e)), true)
    }
  }

  async function abrir(): Promise<void> {
    try {
      const j = fsa()
      if (!j.showOpenFilePicker) {
        const r = await abreArquivo()
        if (!r) return
        projeto.substitui(r.doc)
        atual = null
        await lembra(r.nome, r.doc)
        aviso(T.arquivo.aberto(r.nome))
        return
      }
      const [h] = await j.showOpenFilePicker({ types: TIPOS, multiple: false })
      const f = await h.getFile()
      const doc = lerDocumento(await f.text())
      projeto.substitui(doc)
      atual = h
      await lembra(f.name, doc, h)
      aviso(T.arquivo.aberto(f.name))
    } catch (e) {
      if (!cancelado(e)) aviso(T.arquivo.abrirFalhou(msg(e)), true)
    }
  }

  async function recentes(): Promise<Recente[]> {
    try {
      const itens = await transacao<Registro[]>('readonly', l => l.getAll())
      return ordenaRecentes(itens.map(r => ({ id: String(r.id), nome: r.nome, em: r.em }))).map(({ id, nome }) => ({ id, nome }))
    } catch (e) {
      aviso(msg(e), true)
      return []
    }
  }

  async function abreRecente(id: string): Promise<void> {
    try {
      const r = await transacao<Registro | undefined>('readonly', l => l.get(Number(id)))
      if (!r) return
      let doc: Documento | undefined = r.doc
      if (r.handle && await temPermissao(r.handle, 'read')) {
        try { doc = lerDocumento(await (await r.handle.getFile()).text()) } catch { /* arquivo mudou ou sumiu: usa o snapshot */ }
      }
      if (!doc) return aviso(T.recentes.semPermissao(r.nome), true)
      projeto.substitui(doc)
      atual = r.handle ?? null
      await lembra(r.nome, doc, r.handle)
      aviso(T.arquivo.aberto(r.nome))
    } catch (e) {
      aviso(msg(e), true)
    }
  }

  async function limpaRecentes(): Promise<void> {
    try {
      await transacao('readwrite', l => l.clear())
    } catch (e) {
      aviso(msg(e), true)
    }
  }

  return { salvar, salvarComo, abrir, recentes, abreRecente, limpaRecentes }
}
