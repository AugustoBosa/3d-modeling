import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { unzipSync, strFromU8 } from 'fflate'
import { escrever3mf, type Corpo3mf } from '../src/export/3mf.ts'
import { saborDe, config3mfDe } from '../src/export/perfis3mf.ts'
import { impressoraPorId } from '../printers/index.ts'
import { filamentoPorId } from '../filaments/index.ts'
import { cubo, doisCorpos } from './malha-fixtures.ts'

const mega = impressoraPorId('anycubic-i3-mega-s')!
const p2s = impressoraPorId('bambu-p2s')!
const pla = filamentoPorId('pla')!
const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

const abre = (bytes: Uint8Array) => unzipSync(bytes)
const lerArq = (z: Record<string, Uint8Array>, nome: string) => {
  const b = z[nome]
  assert.ok(b, `arquivo ausente: ${nome}`)
  return strFromU8(b)
}

test('core: estrutura, 2 objetos, 24 triangulos, sem Metadata de config', () => {
  const z = abre(escrever3mf({ corpos: doisCorpos(), sabor: 'core' }))
  const nomes = Object.keys(z)
  for (const n of ['[Content_Types].xml', '_rels/.rels', '3D/3dmodel.model']) assert.ok(nomes.includes(n), n)
  assert.equal(nomes.filter((n) => n.startsWith('Metadata/') && n.endsWith('.config')).length, 0)
  const modelo = lerArq(z, '3D/3dmodel.model')
  assert.equal(modelo.match(/<object /g)?.length, 2)
  assert.equal(modelo.match(/<triangle /g)?.length, 24)
  assert.ok(modelo.includes('#FF0000FF'))
  assert.ok(modelo.includes('#0000FFFF'))
  for (const n of nomes.filter((n) => /\.(xml|model|rels|config)$/.test(n))) {
    const s = lerArq(z, n)
    assert.equal(s.split('<').length, s.split('>').length, `XML desbalanceado: ${n}`)
  }
})

test('prusa: Slic3r_PE.config e extruder do 2o corpo no model config', () => {
  const z = abre(escrever3mf({ corpos: doisCorpos(), sabor: 'prusa', config: config3mfDe(mega, pla) }))
  assert.ok(lerArq(z, 'Metadata/Slic3r_PE.config').includes('printer_settings_id'))
  const mc = lerArq(z, 'Metadata/Slic3r_PE_model.config')
  const obj2 = mc.slice(mc.indexOf('<object id="3"'))
  assert.ok(obj2.includes('key="extruder" value="2"'))
})

test('bambu: project_settings JSON com cores, tipo e layer_height; extruder no model_settings', () => {
  const z = abre(escrever3mf({ corpos: doisCorpos(), sabor: 'bambu', config: config3mfDe(p2s, pla) }))
  const proj = JSON.parse(lerArq(z, 'Metadata/project_settings.config'))
  assert.equal(typeof proj.printer_model, 'string')
  assert.deepEqual(proj.filament_colour, ['#FF0000', '#0000FF'])
  assert.equal(typeof proj.layer_height, 'string')
  assert.match(lerArq(z, 'Metadata/model_settings.config'), /key="extruder" value="2"/)
})

test('miniatura: so em thumbnail.png (prusa) ou plate_1.png (bambu)', () => {
  const pr = abre(escrever3mf({ corpos: doisCorpos(), sabor: 'prusa', config: config3mfDe(mega, pla), miniaturaPng: PNG }))
  assert.deepEqual(pr['Metadata/thumbnail.png'], PNG)
  assert.deepEqual(Object.keys(pr).filter((n) => n.endsWith('.png')), ['Metadata/thumbnail.png'])
  assert.ok(lerArq(pr, '_rels/.rels').includes('thumbnail'))

  const bb = abre(escrever3mf({ corpos: doisCorpos(), sabor: 'bambu', config: config3mfDe(p2s, pla), miniaturaPng: PNG }))
  assert.deepEqual(bb['Metadata/plate_1.png'], PNG)
  assert.deepEqual(Object.keys(bb).filter((n) => n.endsWith('.png')), ['Metadata/plate_1.png'])

  const sem = abre(escrever3mf({ corpos: doisCorpos(), sabor: 'prusa' }))
  assert.equal(sem['Metadata/thumbnail.png'], undefined)
})

test('determinismo: mesma entrada, mesmos bytes', () => {
  const entrada = () => escrever3mf({ corpos: doisCorpos(), sabor: 'bambu', config: config3mfDe(p2s, pla), miniaturaPng: PNG })
  assert.equal(Buffer.compare(Buffer.from(entrada()), Buffer.from(entrada())), 0)
})

test('perfis: sabor e config da Mega S e da P2S', () => {
  assert.equal(saborDe(mega), 'prusa')
  assert.equal(saborDe(p2s), 'bambu')
  assert.deepEqual(config3mfDe(p2s, pla), {
    printer_model: 'Bambu Lab P2S',
    printer_settings_id: 'Bambu Lab P2S',
    printer_model_id: 'N7',
    filament_settings_id: ['Bambu PLA Basic @BBL P2S'],
    filament_type: ['PLA'],
    camada: 0.2,
  })
  assert.deepEqual(config3mfDe(p2s, filamentoPorId('petg')!).filament_settings_id, [])
  assert.deepEqual(config3mfDe(mega, pla), {
    printer_settings_id: 'Anycubic i3 Mega S',
    printer_model: '',
    print_settings_id: '',
    filament_settings_id: 'PLA',
    camada: 0.2,
  })
})

test('corpo sem triangulos lanca erro', () => {
  const vazio: Corpo3mf = {
    nome: 'vazio',
    malha: { vertProps: new Float32Array(0), triVerts: new Uint32Array(0) },
    cor: '#FFFFFF',
    slot: 1,
  }
  assert.throws(() => escrever3mf({ corpos: [vazio], sabor: 'core' }), /corpo sem triângulos/)
})

test('gera arquivos de exemplo em test/saida/', () => {
  const pasta = new URL('./saida/', import.meta.url)
  mkdirSync(pasta, { recursive: true })
  writeFileSync(
    new URL('mega-s-prusa.3mf', pasta),
    escrever3mf({
      corpos: [{ nome: 'Cubo 20mm', malha: cubo(20), cor: '#FF0000', slot: 1 }],
      sabor: saborDe(mega),
      config: config3mfDe(mega, pla),
    }),
  )
  writeFileSync(
    new URL('p2s-bambu-2cores.3mf', pasta),
    escrever3mf({ corpos: doisCorpos(), sabor: saborDe(p2s), config: config3mfDe(p2s, pla) }),
  )
  writeFileSync(new URL('core-2corpos.3mf', pasta), escrever3mf({ corpos: doisCorpos(), sabor: 'core' }))
})
