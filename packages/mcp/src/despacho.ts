// Executa uma tool no modo certo: com aba conectada (ponte) o documento da aba é a verdade e a mudança volta para ela
// como UM comando desfazível; sem aba, headless. Em ambos a lógica é a mesma (as tools rodam aqui, no core).
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Ponte } from './ponte.ts'
import type { ArgsAplicar, ArgsCaptura, ResultadoCaptura, ResultadoDesfaz } from './protocolo.ts'
import type { Sessao } from './sessao.ts'
import type { Tool } from './tool.ts'

export function criaDespacho(sessao: Sessao, ponte: () => Ponte | null) {
  return async function executa(t: Tool, args: Record<string, unknown>): Promise<unknown> {
    const p = ponte()
    const estado = p?.conectado ? p.estado : null
    if (!p || !estado) return t.executa(sessao, args)

    sessao.carrega(structuredClone(estado.doc))
    if (t.nome === 'desfazer' || t.nome === 'refazer') {
      const r = (await p.pede(t.nome, {})) as ResultadoDesfaz
      return { ok: r.comando !== null, comando: r.comando, modo: 'ponte' }
    }
    if (t.nome === 'captura') {
      const vistas = (args.vistas as string[] | undefined) ?? ['iso', 'frente', 'topo', 'direita']
      const pasta = (args.pasta as string | undefined) ?? 'capturas'
      const r = (await p.pede('captura', { vistas, mostrarVolume: args.mostrarVolume === true } satisfies ArgsCaptura)) as ResultadoCaptura
      const arquivos: string[] = []
      for (const im of r.imagens) {
        const arq = sessao.caminhoSaida(path.join(pasta, `${im.vista}.png`))
        mkdirSync(path.dirname(arq), { recursive: true })
        writeFileSync(arq, Buffer.from(im.png, 'base64'))
        arquivos.push(arq)
      }
      return { ok: true, modo: 'ponte', arquivos, _anexos: r.imagens.map(im => ({ nome: `${im.vista}.png`, mime: 'image/png', base64: im.png })) }
    }

    const antes = JSON.stringify(sessao.doc)
    const res = await t.executa(sessao, args)
    if (JSON.stringify(sessao.doc) !== antes) await p.pede('aplicar', { doc: sessao.doc, nome: t.nome } satisfies ArgsAplicar)
    return res && typeof res === 'object' ? { ...res, modo: 'ponte' } : res
  }
}
