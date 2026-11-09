// Orquestrador do export: regenera fino (cancelável), monta os arquivos, calcula o hash e entrega. Sem DOM.
import { exporta as exportaCore, type ArquivoExport, type FormatoExport } from '@3dm/core/export'
import type { Documento } from '@3dm/core/doc'
import type { EntradaMalha } from '@3dm/core/malha'
import type { Achado } from '@3dm/core/imprimir'

export interface DepsExportador {
  doc(): Documento
  /** Regenera com tolerância de export (fina). Resolve null se foi cancelado. */
  corposFinos(): Promise<Map<string, EntradaMalha> | null>
  ocultos(): ReadonlySet<string>
  miniatura(): Promise<Uint8Array | undefined> // PNG; só chamada para 3MF; pode rejeitar → segue sem miniatura e marca miniaturaFalhou
  cancelaGeracao(): void // aborta corposFinos em andamento
  entrega(a: ArquivoExport): void // baixar (download); só chamada se houver arquivos e !semDownload
}
export interface ArquivoInfo { nome: string; bytes: number; hash: string /* sha-256 hex do conteúdo */ }
export interface UltimoExport { formato: FormatoExport; arquivos: ArquivoInfo[]; hashTotal: string; achados: Achado[]; bloqueado: boolean; massaG: number; cancelado: boolean; miniaturaFalhou: boolean; erro?: string }

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', bytes as BufferSource) // o TS nao aceita ArrayBufferLike sem cast
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

export function criaExportador(d: DepsExportador) {
  let seq = 0 // identifica a chamada mais recente: só ela grava o ultimo()
  let pendentes = 0
  let ultimo: UltimoExport | null = null

  function cancela(): void {
    d.cancelaGeracao()
  }

  async function exporta(formato: FormatoExport, opcoes?: { ignoraBloqueio?: boolean; semDownload?: boolean }): Promise<UltimoExport> {
    if (pendentes > 0) cancela() // a chamada anterior é abortada e esta prossegue
    const id = ++seq
    pendentes++
    let resultado: UltimoExport = { formato, arquivos: [], hashTotal: '', achados: [], bloqueado: false, massaG: 0, cancelado: false, miniaturaFalhou: false }
    try {
      const corpos = await d.corposFinos()
      if (corpos === null || id !== seq) { // cancelado, ou substituído por outra chamada
        resultado = { ...resultado, cancelado: true }
      } else {
        let miniaturaPng: Uint8Array | undefined
        let miniaturaFalhou = false
        if (formato === '3mf') {
          try { miniaturaPng = await d.miniatura() } catch { miniaturaFalhou = true }
        }
        const res = exportaCore({ doc: d.doc(), corpos, ocultos: d.ocultos(), miniaturaPng }, formato, { ignoraBloqueio: opcoes?.ignoraBloqueio })
        const arquivos: ArquivoInfo[] = []
        for (const a of res.arquivos) arquivos.push({ nome: a.nome, bytes: a.bytes.byteLength, hash: await sha256Hex(a.bytes) })
        const hashTotal = await sha256Hex(new TextEncoder().encode(arquivos.map((a) => a.hash).join('')))
        resultado = { formato, arquivos, hashTotal, achados: res.achados, bloqueado: res.bloqueado, massaG: res.massaG, cancelado: false, miniaturaFalhou }
        if (arquivos.length > 0 && !opcoes?.semDownload) res.arquivos.forEach((a) => d.entrega(a))
      }
    } catch (e) {
      resultado = { ...resultado, erro: e instanceof Error ? e.message : String(e) }
    } finally {
      pendentes--
    }
    if (id === seq) ultimo = resultado
    return resultado
  }

  return { exporta, cancela, ultimo: () => ultimo, emAndamento: () => pendentes > 0 }
}
