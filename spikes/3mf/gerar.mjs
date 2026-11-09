// Gera os dois .3mf do spike em spikes/3mf/out/.
// Ids de perfil: ver RESULTADO.md. "NAO CONFIRMADO" = nao achado em fonte primaria.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { escrever3mf } from './escrever3mf.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const OUT = join(DIR, 'out');

// Cubo 8 vertices, 12 triangulos, anti-horario visto de fora (malha fechada).
function cubo(lado, dx = 0) {
  const s = lado;
  const vertices = new Float32Array([
    dx, 0, 0,  dx + s, 0, 0,  dx + s, s, 0,  dx, s, 0,
    dx, 0, s,  dx + s, 0, s,  dx + s, s, s,  dx, s, s,
  ]);
  const indices = new Uint32Array([
    0, 2, 1,  0, 3, 2,   // base (-z)
    4, 5, 6,  4, 6, 7,   // topo (+z)
    0, 1, 5,  0, 5, 4,   // frente (-y)
    2, 3, 7,  2, 7, 6,   // fundo (+y)
    0, 4, 7,  0, 7, 3,   // esquerda (-x)
    1, 2, 6,  1, 6, 5,   // direita (+x)
  ]);
  return { vertices, indices };
}

export function gerar() {
  mkdirSync(OUT, { recursive: true });

  // Prusa Mega S: "Mega S" NAO CONFIRMADO no PrusaSlicer (sem perfil no repo). Placeholder marcado.
  const mega = escrever3mf({
    sabor: 'prusa',
    corpos: [{ nome: 'Cubo 20mm', ...cubo(20), cor: '#FF0000', slot: 1 }],
    impressora: {
      printer_model: 'NAO CONFIRMADO',
      printer_settings_id: 'Prusa Mega S', // NAO CONFIRMADO
      print_settings_id: '',
      filament_settings_id: '',
    },
  });
  const megaPath = join(OUT, 'mega-s.3mf');
  writeFileSync(megaPath, mega);

  // P2S: 2 cubos lado a lado, slot 1 vermelho, slot 2 azul. model_id N7 do perfil "Bambu Lab P2S".
  const p2s = escrever3mf({
    sabor: 'bambu',
    corpos: [
      { nome: 'Cubo A', ...cubo(20, 0), cor: '#FF0000', slot: 1 },
      { nome: 'Cubo B', ...cubo(20, 40), cor: '#0000FF', slot: 2 },
    ],
    impressora: {
      printer_model: 'Bambu Lab P2S', // NAO CONFIRMADO: valor exato da chave printer_model
      printer_settings_id: 'Bambu Lab P2S', // nome do perfil de maquina (confirmado em BBL.json)
      printer_model_id: 'N7', // model_id do perfil (confirmado)
      filament_type: ['PLA', 'PLA'],
      filament_settings_id: ['Bambu PLA Basic @BBL P2S'], // default_materials do perfil P2S (confirmado)
    },
  });
  const p2sPath = join(OUT, 'p2s-2cores.3mf');
  writeFileSync(p2sPath, p2s);
  return [megaPath, p2sPath];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const p of gerar()) console.log(p);
}
