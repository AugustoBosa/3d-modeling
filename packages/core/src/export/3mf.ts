// Escritor minimo de 3MF. Sabores: core | prusa | bambu.
// Fontes dos nomes de arquivo e chaves: spikes/3mf/RESULTADO.md.
import { zipSync, strToU8, type Zippable } from 'fflate'
import { normaliza, type EntradaMalha } from '../malha/tipos.ts'

export type Sabor = 'core' | 'prusa' | 'bambu'

export interface Corpo3mf {
  nome: string
  malha: EntradaMalha
  cor: string // '#RRGGBB'
  slot: number // slot do AMS/extrusora, 1-based
}

export interface Config3mf {
  printer_model?: string
  printer_settings_id?: string
  print_settings_id?: string
  filament_settings_id?: string | string[] // prusa usa string; bambu usa lista
  printer_model_id?: string
  filament_type?: string[]
  filament_colour?: string[] // por slot; quando vem, substitui a cor do corpo no bambu
  camada?: number // altura de camada em mm
}

interface CorpoNorm { nome: string; pos: Float32Array; idx: Uint32Array; cor: string; slot: number }

const NS_CORE = 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02'
const NS_MAT = 'http://schemas.microsoft.com/3dmanufacturing/material/2015/02'
const REL_MODEL = 'http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel'
const REL_THUMB = 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail'
const CABECALHO = '<?xml version="1.0" encoding="UTF-8"?>\n'
// Data fixa: o zip sai igual em qualquer fuso e em qualquer dia.
const MTIME = new Date(2000, 0, 1, 0, 0, 0)

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]!)
// Evita ruido de float32 (ex.: 19.999999) no XML.
const num = (v: number) => String(+v.toFixed(6))
const corRGBA = (cor: string) => `${cor.toUpperCase()}FF`
const lista = (v: string | string[] | undefined): string[] => (v === undefined ? [] : Array.isArray(v) ? v : [v])
const texto = (v: string | string[] | undefined): string => lista(v)[0] ?? ''
// Completa com o ultimo item informado (ou o padrao, se a lista vier vazia).
function completa(itens: string[], n: number, padrao: string): string[] {
  const ultimo = itens.length ? itens[itens.length - 1]! : padrao
  return Array.from({ length: n }, (_, i) => itens[i] ?? ultimo)
}

function modeloXml(corpos: CorpoNorm[], sabor: Sabor): string {
  const bambu = sabor === 'bambu'
  const cabecaMeta = bambu ? '  <metadata name="BambuStudio:3mfVersion">1</metadata>\n'
    : sabor === 'prusa' ? '  <metadata name="slic3rpe:Version3mf">1</metadata>\n' : ''
  const base = corpos.map((c) => `   <base name="${esc(c.nome)}" displaycolor="${corRGBA(c.cor)}"/>`).join('\n')
  const objetos = corpos.map((c, i) => {
    const v: string[] = []
    for (let k = 0; k < c.pos.length; k += 3) {
      v.push(`    <vertex x="${num(c.pos[k]!)}" y="${num(c.pos[k + 1]!)}" z="${num(c.pos[k + 2]!)}"/>`)
    }
    const t: string[] = []
    for (let k = 0; k < c.idx.length; k += 3) {
      t.push(`    <triangle v1="${c.idx[k]}" v2="${c.idx[k + 1]}" v3="${c.idx[k + 2]}"/>`)
    }
    return `  <object id="${i + 2}" name="${esc(c.nome)}" type="model" pid="1" pindex="${i}">\n` +
      `   <mesh>\n    <vertices>\n${v.join('\n')}\n    </vertices>\n    <triangles>\n${t.join('\n')}\n    </triangles>\n   </mesh>\n  </object>`
  }).join('\n')
  const itens = corpos.map((_, i) => `  <item objectid="${i + 2}"/>`).join('\n')
  return CABECALHO +
    `<model unit="millimeter" xml:lang="en-US" xmlns="${NS_CORE}" xmlns:m="${NS_MAT}">\n` +
    cabecaMeta +
    ` <resources>\n  <basematerials id="1">\n${base}\n  </basematerials>\n${objetos}\n </resources>\n` +
    ` <build>\n${itens}\n </build>\n</model>\n`
}

function slic3rPeConfig(c: Config3mf): string {
  const linhas = [
    `; printer_settings_id = ${c.printer_settings_id ?? ''}`,
    `; print_settings_id = ${c.print_settings_id ?? ''}`,
    `; filament_settings_id = ${texto(c.filament_settings_id)}`,
    `; printer_model = ${c.printer_model ?? ''}`,
  ]
  if (c.camada !== undefined) linhas.push(`; layer_height = ${c.camada}`)
  return linhas.join('\n') + '\n'
}

// Por objeto: nome e extruder (1-based = slot). Um volume por objeto (firstid 0, lastid n-1).
function slic3rPeModelConfig(corpos: CorpoNorm[]): string {
  const objs = corpos.map((c, i) => {
    const ntri = c.idx.length / 3
    return ` <object id="${i + 2}" instances_count="1">\n` +
      `  <metadata type="object" key="name" value="${esc(c.nome)}"/>\n` +
      `  <metadata type="object" key="extruder" value="${c.slot}"/>\n` +
      `  <volume firstid="0" lastid="${ntri - 1}">\n` +
      `   <metadata type="volume" key="name" value="${esc(c.nome)}"/>\n` +
      `   <metadata type="volume" key="extruder" value="${c.slot}"/>\n` +
      `  </volume>\n </object>`
  }).join('\n')
  return CABECALHO + `<config>\n${objs}\n</config>\n`
}

function bambuProjectJson(corpos: CorpoNorm[], c: Config3mf): string {
  const nSlots = Math.max(...corpos.map((x) => x.slot), c.filament_colour?.length ?? 0)
  const cores = Array.from({ length: nSlots }, () => '#FFFFFF')
  if (c.filament_colour) c.filament_colour.forEach((k, i) => (cores[i] = k.toUpperCase()))
  else for (const x of corpos) cores[x.slot - 1] = x.cor.toUpperCase()
  const proj: Record<string, unknown> = {
    printer_model: c.printer_model ?? '',
    printer_settings_id: c.printer_settings_id ?? '',
    print_settings_id: c.print_settings_id ?? '',
    filament_settings_id: completa(lista(c.filament_settings_id), nSlots, ''),
    filament_colour: cores,
    filament_type: completa(c.filament_type ?? [], nSlots, 'PLA'),
  }
  if (c.camada !== undefined) proj.layer_height = String(c.camada)
  return JSON.stringify(proj, null, 2) + '\n'
}

// Uma entrada por objeto; plate com instancia de cada objeto.
function bambuModelSettings(corpos: CorpoNorm[], c: Config3mf, temMiniatura: boolean): string {
  const objs = corpos.map((x, i) => {
    const id = i + 2
    return ` <object id="${id}">\n` +
      `  <metadata key="name" value="${esc(x.nome)}"/>\n` +
      `  <metadata key="extruder" value="${x.slot}"/>\n` +
      `  <part id="${id}" subtype="normal_part">\n` +
      `   <metadata key="name" value="${esc(x.nome)}"/>\n` +
      `   <metadata key="extruder" value="${x.slot}"/>\n` +
      `  </part>\n </object>`
  }).join('\n')
  const inst = corpos.map((_, i) =>
    `  <model_instance>\n   <metadata key="object_id" value="${i + 2}"/>\n   <metadata key="instance_id" value="0"/>\n  </model_instance>`
  ).join('\n')
  const thumb = temMiniatura ? '  <metadata key="thumbnail_file" value="Metadata/plate_1.png"/>\n' : ''
  return CABECALHO + `<config>\n${objs}\n <plate>\n  <metadata key="plater_id" value="1"/>\n` +
    `  <metadata key="printer_model_id" value="${esc(c.printer_model_id ?? '')}"/>\n${thumb}${inst}\n </plate>\n</config>\n`
}

export function escrever3mf(p: { corpos: Corpo3mf[]; sabor: Sabor; config?: Config3mf; miniaturaPng?: Uint8Array }): Uint8Array {
  const corpos: CorpoNorm[] = p.corpos.map((c) => {
    const { pos, idx } = normaliza(c.malha)
    if (idx.length === 0) throw new Error(`corpo sem triângulos: ${c.nome}`)
    return { nome: c.nome, pos, idx, cor: c.cor, slot: c.slot }
  })
  const config = p.config ?? {}
  const temMini = p.miniaturaPng !== undefined
  const rels = [
    `<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="${REL_MODEL}"/>`,
    temMini && p.sabor !== 'bambu' ? `<Relationship Target="/Metadata/thumbnail.png" Id="rel1" Type="${REL_THUMB}"/>` : '',
  ].filter(Boolean).join('')
  const contentTypes = CABECALHO +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n' +
    ' <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n' +
    ' <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>\n' +
    ' <Default Extension="png" ContentType="image/png"/>\n' +
    ' <Default Extension="json" ContentType="application/json"/>\n' +
    '</Types>\n'

  // Ordem: [Content_Types].xml primeiro e sem compressao.
  const arquivos: Zippable = {
    '[Content_Types].xml': [strToU8(contentTypes), { level: 0 }],
    '_rels/.rels': strToU8(CABECALHO + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>\n`),
    '3D/3dmodel.model': strToU8(modeloXml(corpos, p.sabor)),
  }
  if (p.miniaturaPng) arquivos[p.sabor === 'bambu' ? 'Metadata/plate_1.png' : 'Metadata/thumbnail.png'] = p.miniaturaPng
  if (p.sabor === 'prusa') {
    arquivos['Metadata/Slic3r_PE.config'] = strToU8(slic3rPeConfig(config))
    arquivos['Metadata/Slic3r_PE_model.config'] = strToU8(slic3rPeModelConfig(corpos))
  }
  if (p.sabor === 'bambu') {
    arquivos['Metadata/project_settings.config'] = strToU8(bambuProjectJson(corpos, config))
    arquivos['Metadata/model_settings.config'] = strToU8(bambuModelSettings(corpos, config, temMini))
  }
  return zipSync(arquivos, { mtime: MTIME })
}
