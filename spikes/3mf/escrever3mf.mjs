// Escritor minimo de 3MF (spike). Sabores: core | prusa | bambu.
// Fontes dos nomes de arquivo e chaves: ver spikes/3mf/RESULTADO.md.
import { zipSync, strToU8 } from 'fflate';

const NS_CORE = 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02';
const NS_MAT = 'http://schemas.microsoft.com/3dmanufacturing/material/2015/02';
const REL_MODEL = 'http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel';
const REL_THUMB = 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail';
const CABECALHO = '<?xml version="1.0" encoding="UTF-8"?>\n';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
const corRGBA = (cor) => `${cor.toUpperCase()}FF`;

function modeloXml(corpos, sabor) {
  const bambu = sabor === 'bambu';
  const cabecaMeta = bambu ? '  <metadata name="BambuStudio:3mfVersion">1</metadata>\n'
    : sabor === 'prusa' ? '  <metadata name="slic3rpe:Version3mf">1</metadata>\n' : '';
  const base = corpos.map((c) => `   <base name="${esc(c.nome)}" displaycolor="${corRGBA(c.cor)}"/>`).join('\n');
  const objetos = corpos.map((c, i) => {
    const v = [];
    for (let k = 0; k < c.vertices.length; k += 3) {
      v.push(`    <vertex x="${c.vertices[k]}" y="${c.vertices[k + 1]}" z="${c.vertices[k + 2]}"/>`);
    }
    const t = [];
    for (let k = 0; k < c.indices.length; k += 3) {
      t.push(`    <triangle v1="${c.indices[k]}" v2="${c.indices[k + 1]}" v3="${c.indices[k + 2]}"/>`);
    }
    return `  <object id="${i + 2}" name="${esc(c.nome)}" type="model" pid="1" pindex="${i}">\n` +
      `   <mesh>\n    <vertices>\n${v.join('\n')}\n    </vertices>\n    <triangles>\n${t.join('\n')}\n    </triangles>\n   </mesh>\n  </object>`;
  }).join('\n');
  const itens = corpos.map((_, i) => `  <item objectid="${i + 2}"/>`).join('\n');
  return CABECALHO +
    `<model unit="millimeter" xml:lang="en-US" xmlns="${NS_CORE}" xmlns:m="${NS_MAT}">\n` +
    cabecaMeta +
    ` <resources>\n  <basematerials id="1">\n${base}\n  </basematerials>\n${objetos}\n </resources>\n` +
    ` <build>\n${itens}\n </build>\n</model>\n`;
}

function slic3rPeConfig(imp) {
  const linhas = [
    `; printer_settings_id = ${imp.printer_settings_id ?? ''}`,
    `; print_settings_id = ${imp.print_settings_id ?? ''}`,
    `; filament_settings_id = ${imp.filament_settings_id ?? ''}`,
    `; printer_model = ${imp.printer_model ?? ''}`,
  ];
  return linhas.join('\n') + '\n';
}

// Por objeto: nome e extruder (1-based = slot). Um volume por objeto (firstid 0, lastid n-1).
function slic3rPeModelConfig(corpos) {
  const objs = corpos.map((c, i) => {
    const ntri = c.indices.length / 3;
    return ` <object id="${i + 2}" instances_count="1">\n` +
      `  <metadata type="object" key="name" value="${esc(c.nome)}"/>\n` +
      `  <metadata type="object" key="extruder" value="${c.slot}"/>\n` +
      `  <volume firstid="0" lastid="${ntri - 1}">\n` +
      `   <metadata type="volume" key="name" value="${esc(c.nome)}"/>\n` +
      `   <metadata type="volume" key="extruder" value="${c.slot}"/>\n` +
      `  </volume>\n </object>`;
  }).join('\n');
  return CABECALHO + `<config>\n${objs}\n</config>\n`;
}

function bambuProjectJson(corpos, imp) {
  const nSlots = Math.max(...corpos.map((c) => c.slot));
  const cores = Array.from({ length: nSlots }, () => '#FFFFFF');
  const tipos = Array.from({ length: nSlots }, (_, i) => imp.filament_type?.[i] ?? 'PLA');
  for (const c of corpos) cores[c.slot - 1] = c.cor.toUpperCase();
  return JSON.stringify({
    printer_model: imp.printer_model ?? '',
    printer_settings_id: imp.printer_settings_id ?? '',
    print_settings_id: imp.print_settings_id ?? '',
    filament_settings_id: imp.filament_settings_id ?? [],
    filament_colour: cores,
    filament_type: tipos,
  }, null, 2) + '\n';
}

// Uma linha de model_settings por objeto; plate com instancia de cada objeto.
function bambuModelSettings(corpos, imp, temMiniatura) {
  const objs = corpos.map((c, i) => {
    const id = i + 2;
    return ` <object id="${id}">\n` +
      `  <metadata key="name" value="${esc(c.nome)}"/>\n` +
      `  <metadata key="extruder" value="${c.slot}"/>\n` +
      `  <part id="${id}" subtype="normal_part">\n` +
      `   <metadata key="name" value="${esc(c.nome)}"/>\n` +
      `   <metadata key="extruder" value="${c.slot}"/>\n` +
      `  </part>\n </object>`;
  }).join('\n');
  const inst = corpos.map((_, i) =>
    `  <model_instance>\n   <metadata key="object_id" value="${i + 2}"/>\n   <metadata key="instance_id" value="0"/>\n  </model_instance>`
  ).join('\n');
  const thumb = temMiniatura ? '  <metadata key="thumbnail_file" value="Metadata/plate_1.png"/>\n' : '';
  return CABECALHO + `<config>\n${objs}\n <plate>\n  <metadata key="plater_id" value="1"/>\n` +
    `  <metadata key="printer_model_id" value="${esc(imp.printer_model_id ?? '')}"/>\n${thumb}${inst}\n </plate>\n</config>\n`;
}

/**
 * @param {{corpos: Array<{nome:string, vertices:Float32Array, indices:Uint32Array, cor:string, slot:number}>,
 *   sabor: 'core'|'prusa'|'bambu', impressora?: object, miniatura?: Uint8Array}} p
 * @returns {Uint8Array}
 */
export function escrever3mf({ corpos, sabor, impressora = {}, miniatura }) {
  const temMini = miniatura instanceof Uint8Array;
  const rels = [
    `<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="${REL_MODEL}"/>`,
    temMini && sabor !== 'bambu' ? `<Relationship Target="/Metadata/thumbnail.png" Id="rel1" Type="${REL_THUMB}"/>` : '',
  ].filter(Boolean).join('');
  const contentTypes = CABECALHO +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n' +
    ' <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n' +
    ' <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>\n' +
    ' <Default Extension="png" ContentType="image/png"/>\n' +
    ' <Default Extension="json" ContentType="application/json"/>\n' +
    '</Types>\n';

  // Ordem: [Content_Types].xml primeiro e sem compressao.
  const arquivos = {
    '[Content_Types].xml': [strToU8(contentTypes), { level: 0 }],
    '_rels/.rels': strToU8(CABECALHO + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>\n`),
    '3D/3dmodel.model': strToU8(modeloXml(corpos, sabor)),
  };
  if (temMini) arquivos[sabor === 'bambu' ? 'Metadata/plate_1.png' : 'Metadata/thumbnail.png'] = miniatura;
  if (sabor === 'prusa') {
    arquivos['Metadata/Slic3r_PE.config'] = strToU8(slic3rPeConfig(impressora));
    arquivos['Metadata/Slic3r_PE_model.config'] = strToU8(slic3rPeModelConfig(corpos));
  }
  if (sabor === 'bambu') {
    arquivos['Metadata/project_settings.config'] = strToU8(bambuProjectJson(corpos, impressora));
    arquivos['Metadata/model_settings.config'] = strToU8(bambuModelSettings(corpos, impressora, temMini));
  }
  return zipSync(arquivos);
}
