// Autosave no IndexedDB (debounce de 1 s) e arquivo .3dm.json (PROJETO_BASE §5.6).
import { lerDocumento, textoDocumento, valida } from '@3dm/core/doc'
import type { Documento } from '@3dm/core/doc'
import type { Projeto } from './projeto.ts'
import { T } from './textos.ts'

const BANCO = '3dm', LOJA = 'projetos', CHAVE = 'atual'

function abre(): Promise<IDBDatabase> {
  return new Promise((ok, falha) => {
    const r = indexedDB.open(BANCO, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(LOJA)
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

export const salvaAtual = (doc: Documento) => transacao('readwrite', l => l.put({ doc, em: Date.now() }, CHAVE))

/** Documento salvo no navegador; null se não há. Lança se o que está salvo é inválido. */
export async function carregaAtual(): Promise<Documento | null> {
  const r = await transacao<{ doc: unknown } | undefined>('readonly', l => l.get(CHAVE))
  if (!r) return null
  const erros = valida(r.doc)
  if (erros.length) throw new Error(erros.join('; '))
  return r.doc as Documento
}

/** Salva 1 s depois da última mudança (e na hora ao esconder a aba). `falhou` recebe o aviso de erro. */
export function autosave(p: Projeto, falhou: (msg: string) => void, espera = 1000) {
  let t = 0
  const salva = () => { clearTimeout(t); t = 0; salvaAtual(p.doc).catch(() => falhou(T.arquivo.autosaveFalhou)) }
  p.aoMudar(() => { clearTimeout(t); t = window.setTimeout(salva, espera) })
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && t) salva() })
  addEventListener('pagehide', () => { if (t) salva() })
}

/** Baixa o documento como `<nome>.3dm.json`; devolve o nome do arquivo. */
export function baixaDocumento(doc: Documento): string {
  const nome = `${doc.nome || T.arquivo.padrao}.3dm.json`
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([textoDocumento(doc)], { type: 'application/json' })), download: nome })
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  return nome
}

/** Abre o seletor de arquivo e devolve o documento validado. Lança Error com a causa se o arquivo não serve; null se o usuário cancelou. */
export function abreArquivo(): Promise<{ doc: Documento; nome: string } | null> {
  return new Promise((ok, falha) => {
    const i = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,.3dm.json,application/json' })
    i.onchange = async () => {
      const f = i.files?.[0]
      if (!f) return ok(null)
      try { ok({ doc: lerDocumento(await f.text()), nome: f.name }) } catch (e) { falha(e) }
    }
    i.addEventListener('cancel', () => ok(null))
    i.click()
  })
}
