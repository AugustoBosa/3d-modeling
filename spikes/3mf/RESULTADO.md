# Spike SPK-2: 3MF com fflate (R2)

## Decisão

**GO condicional.** O writer gera 3MF válido (zip, XML balanceado, malhas fechadas) com os sabores core, Prusa e Bambu/Orca. Nada disso prova que o Prusa ou o Bambu Studio pré-selecionam a impressora ao abrir o arquivo. Isso só sai no teste manual H2 (seção abaixo). Se não pré-selecionar, usar o fallback: 3MF core + instrução de perfil.

## Chaves conferidas nas fontes

| Chave / item | Valor usado | Fonte |
|---|---|---|
| Miniatura Prusa | `Metadata/thumbnail.png` | [3mf_legacy.cpp](https://github.com/prusa3d/PrusaSlicer/blob/master/src/slic3r-shared/src/Slic3r/Biz/Config/Legacy/3mf_legacy.cpp) (linha 132) |
| Config de impressão Prusa | `Metadata/Slic3r_PE.config` | mesma fonte (linha 133) |
| Config de modelo Prusa | `Metadata/Slic3r_PE_model.config` | mesma fonte (linha 134) |
| Linha do Slic3r_PE.config | `; chave = valor` | mesma fonte (linhas 4123-4126: `"; " + ...` com `\n; `) |
| Estrutura do model config | `<config><object id instances_count><metadata type="object" key="name" value/>` e `<volume firstid lastid>` | mesma fonte (linhas 4176-4190, constantes 150-191) |
| Extruder no Prusa | `key="extruder"` nos metadados de objeto/volume | mesma fonte (linhas 4186-4190 e 4250: chaves de config escritas por objeto e por volume). Nível objeto escolhido por inferência, ver NAO CONFIRMADO |
| `printer_settings_id`, `print_settings_id`, `filament_settings_id`, `printer_model` | nomes de chave | [ConfigLegacy.cpp](https://github.com/prusa3d/PrusaSlicer/blob/master/src/slic3r-shared/src/Slic3r/Biz/Config/ConfigLegacy.cpp) (leitura via `get_string`) e [PresetMetadataLegacyLoader.cpp](https://github.com/prusa3d/PrusaSlicer/blob/master/src/slic3r-shared/src/Slic3r/Biz/Preset/IO/PresetMetadataLegacyLoader.cpp) |
| Relação do modelo | tipo `http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel` | [Relations.cpp](https://github.com/prusa3d/PrusaSlicer/blob/master/src/slic3r-shared/src/Slic3r/Biz/Format/3mf/Relations.cpp) |
| Relação de miniatura | tipo `http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail` | mesma fonte |
| Versão Prusa no .model | `<metadata name="slic3rpe:Version3mf">1</metadata>` | [3mf_legacy.cpp](https://github.com/prusa3d/PrusaSlicer/blob/master/src/slic3r-shared/src/Slic3r/Biz/Config/Legacy/3mf_legacy.cpp) (linhas 108, 111, 3493) |
| Versão Bambu no .model | `<metadata name="BambuStudio:3mfVersion">1</metadata>` | [bbs_3mf.cpp](https://github.com/SoftFever/OrcaSlicer/blob/main/src/libslic3r/Format/bbs_3mf.cpp) (linhas 169, 173) |
| Projeto Bambu/Orca | `Metadata/project_settings.config`, JSON (`save_to_json`) | bbs_3mf.cpp (linhas 230, 8215) |
| Modelo Bambu/Orca | `Metadata/model_settings.config`, XML com `<object>`, `<part subtype>`, `<plate>`, `<model_instance>` | bbs_3mf.cpp (linhas 231, 295-297, 374, 8324-8363, 8794) |
| Miniatura Bambu | `Metadata/plate_1.png` | bbs_3mf.cpp (linha 222) |
| Chaves de projeto Bambu | `printer_model` (coString), `printer_settings_id` (coString), `filament_colour` (coStrings), `filament_type` (coStrings), `extruder` (coInt) | [PrintConfig.cpp](https://github.com/SoftFever/OrcaSlicer/blob/main/src/libslic3r/PrintConfig.cpp) (linhas 2798, 3061, 3507, 6023, 6049) |
| `printer_model_id` na plate | chave `printer_model_id` em `<plate>` | bbs_3mf.cpp (linha 8794) |
| Extruder por objeto, 1-based | padrão `extruder = 1` quando ausente | bbs_3mf.cpp (linhas 2389-2409) |
| Cores no .model Bambu | `m:colorgroup` / `m:color` | bbs_3mf.cpp (linhas 258-259). O writer usa `basematerials` (core), não colorgroup |
| Perfil P2S | nome `Bambu Lab P2S`, `model_id` `N7`, `default_materials` com `Bambu PLA Basic @BBL P2S` | [Bambu Lab P2S.json](https://github.com/SoftFever/OrcaSlicer/blob/main/resources/profiles/BBL/machine/Bambu%20Lab%20P2S.json) e [BBL.json](https://github.com/SoftFever/OrcaSlicer/blob/main/resources/profiles/BBL.json) (linha 45) |

## NAO CONFIRMADO

- **Mega S**: não existe perfil "Mega S" no repositório do PrusaSlicer (busca na árvore e em `resources/presets/prusa-research-fff/PrusaResearch/`). O `printer_settings_id` = `Prusa Mega S` é placeholder. Confirmar o nome real do perfil antes de H2.
- **`printer_model` do P2S**: o JSON da máquina não traz essa chave. O valor `Bambu Lab P2S` no 3MF é placeholder. O valor exato deve ser lido de um 3MF exportado pelo Bambu Studio.
- **`printer_model_id` = `N7`**: vem do `model_id` do perfil. Não confirmei que a plate do Bambu usa esse mesmo valor.
- **Nível de `extruder` no Prusa**: escrevi no objeto e no volume. A fonte mostra os dois usos, mas não confirmei qual o PrusaSlicer lê para pré-selecionar.
- **Elementos `<part>` do Bambu**: o writer só põe `id`, `subtype="normal_part"`, `name` e `extruder`. Não confirmei que o Bambu Studio aceita isso sem `mesh_stat` e outros metadados.
- **Content types de `.config`**: o Orca não declara Default para `.config` (confirmado). O writer segue o mesmo padrão.
- **Artigo dev.to "What's actually inside a Bambu/Orca 3MF"**: só consegui trechos pela busca. Não li o texto completo, então nada dele entrou como chave confirmada.
- **Caminho do PrusaSlicer `3mf.cpp`**: `src/libslic3r/Format/3mf.cpp` retorna 404. O código agora está em `src/slic3r-shared/src/Slic3r/Biz/Format/3mf.cpp` e em `.../Config/Legacy/3mf_legacy.cpp`. Os números de linha acima são desses arquivos.

## URLs consultadas

- https://github.com/prusa3d/PrusaSlicer/blob/master/src/slic3r-shared/src/Slic3r/Biz/Config/Legacy/3mf_legacy.cpp
- https://github.com/prusa3d/PrusaSlicer/blob/master/src/slic3r-shared/src/Slic3r/Biz/Format/3mf/Relations.cpp
- https://github.com/prusa3d/PrusaSlicer/blob/master/src/slic3r-shared/src/Slic3r/Biz/Config/ConfigLegacy.cpp
- https://github.com/prusa3d/PrusaSlicer/blob/master/src/slic3r-shared/src/Slic3r/Biz/Preset/IO/PresetMetadataLegacyLoader.cpp
- https://github.com/SoftFever/OrcaSlicer/blob/main/src/libslic3r/Format/bbs_3mf.cpp
- https://github.com/SoftFever/OrcaSlicer/blob/main/src/libslic3r/PrintConfig.cpp
- https://github.com/SoftFever/OrcaSlicer/blob/main/resources/profiles/BBL.json
- https://github.com/SoftFever/OrcaSlicer/blob/main/resources/profiles/BBL/machine/Bambu%20Lab%20P2S.json
- https://dev.to/joyfunc/whats-actually-inside-a-bambuorca-3mf-24p0 (apenas trechos)
- Busca web "What's actually inside a Bambu Orca 3MF dev.to" e "OrcaSlicer resources profiles BBL machine P2S" (resultados em lista, sem texto aproveitado)

## Teste manual (H2)

1. Abrir `spikes/3mf/out/mega-s.3mf` no PrusaSlicer. Verificar se a impressora e o perfil já vêm selecionados.
2. Abrir `spikes/3mf/out/p2s-2cores.3mf` no Bambu Studio. Verificar se aparecem P2S e 2 objetos, com cores/slots 1 (vermelho) e 2 (azul).
3. Se não pré-selecionar: usar 3MF core (só geometria e cores) e mostrar ao usuário um passo para escolher a impressora e o perfil. Não prometer seleção automática.

## Chaves de UI novas

Nenhuma. O spike não tem texto de UI.
