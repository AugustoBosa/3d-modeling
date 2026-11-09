// Mapeia impressora (e filamento) para o sabor do 3MF e para as chaves do slicer.
// Valores do spike: spikes/3mf/gerar.mjs e spikes/3mf/RESULTADO.md.
import type { Impressora } from '../../printers/index.ts'
import type { Filamento } from '../../filaments/index.ts'
import type { Config3mf, Sabor } from './3mf.ts'

const TIPO_FILAMENTO: Record<string, string> = { pla: 'PLA', petg: 'PETG', tpu: 'TPU', 'abs-asa': 'ABS' }

export function saborDe(imp: Impressora): Sabor {
  if (imp.slicer === 'prusaslicer') return 'prusa'
  if (imp.slicer === 'bambustudio') return 'bambu'
  return 'core'
}

export function config3mfDe(imp: Impressora, fil?: Filamento): Config3mf {
  if (imp.id === 'bambu-p2s') {
    const pla = !fil || fil.id === 'pla'
    return {
      // NAO CONFIRMADO (H2): 'Bambu Lab P2S' e placeholder; o valor exato de printer_model deve vir de um 3MF do Bambu Studio.
      printer_model: 'Bambu Lab P2S',
      printer_settings_id: 'Bambu Lab P2S', // confirmado (BBL.json)
      // NAO CONFIRMADO (H2): model_id N7 confirmado no perfil, mas nao se a plate usa o mesmo valor.
      printer_model_id: 'N7',
      filament_settings_id: pla ? ['Bambu PLA Basic @BBL P2S'] : [], // confirmado (default_materials do perfil)
      filament_type: [fil ? (TIPO_FILAMENTO[fil.id] ?? fil.id.toUpperCase()) : 'PLA'],
      camada: imp.camada.padrao,
    }
  }
  if (imp.id === 'anycubic-i3-mega-s') {
    return {
      // NAO CONFIRMADO (H2): nao existe perfil "Mega S" no repo do PrusaSlicer; o nome real do perfil precisa ser confirmado.
      printer_settings_id: imp.nome,
      printer_model: '',
      print_settings_id: '',
      filament_settings_id: fil?.nome ?? '',
      camada: imp.camada.padrao,
    }
  }
  return { camada: imp.camada.padrao }
}
