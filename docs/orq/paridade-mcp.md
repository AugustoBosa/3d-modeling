# Paridade UI ↔ MCP (F1 — sketch)

Regra G7: toda ação da UI tem tool MCP prevista (§5.7) ou pendência. As tools são implementadas na F4b. Hoje toda edição do sketch já passa por `projeto.executa(comando)` (`@3dm/core/sketch`: `criarSketch`, `editaSketch`, `aplicaAdicao`, `adicionaRestricao`…), então as tools só precisam chamar os mesmos comandos.

| Ação da UI (alias) | Comando do core | Tool MCP prevista |
|---|---|---|
| Criar/entrar sketch (Tab, `SK [plano]`) | `criarSketch(plano)` | `sketch_criar(plano, offset)` |
| Linha / polilinha / construção (`L` `PL` `XL`) | `aplicaAdicao` (linhas + pontos) | `sketch_adicionar(sketch, entidades[])` |
| Retângulo (`REC`) | `aplicaAdicao` (4 pontos, 4 linhas, H/V) | `sketch_adicionar` (tipo retângulo) |
| Círculo / arco / polígono / oblongo / ponto (`C` `A` `POL` `SLOT` `PO`) | `aplicaAdicao` | `sketch_adicionar` |
| Restrições por letra e barra (H V I T E B) | `adicionaRestricao` | `sketch_restringir(sketch, restricoes[])` |
| Fixar ponto (`FIX`) | `adicionaRestricao('fixa')` | `sketch_restringir` (tipo fixa) |
| Cota (`DIM`, `=L`, editar no número) | `adicionaRestricao` / `editaExprCota` | `sketch_restringir` (cota com `expr`) |
| Cota de referência ↔ acionadora | `alternaRefCota` | `sketch_restringir` (campo `ref`) |
| Remover restrição/cota | `removeRestricao` | pendência: remoção em `sketch_restringir` (F4b decide) |
| Mover, copiar, girar, escalar, espelhar, array (`M CO RO SC MI AR ARP`, G/R/S) | `editaSketch` + `edicao.ts` | pendência: nova tool `sketch_editar(sketch, operacao, ids, params)` |
| Aparar, estender, offset, fillet, chanfro (`TR EX O F CHA`) | `editaSketch` + `edicao2.ts` | `fillet_sketch`, `chanfro` (§5.7); `TR EX O`: pendência `sketch_editar` |
| Apagar (`E`, Del, `X`) | `editaSketch` + `apagar` | pendência: `sketch_editar` (operação apagar) |
| Alternar construção (`Q`) | `alternaConstrucao` | pendência: `sketch_editar` |
| Parâmetros e expressões (`PARAM`) | `definirParametro` | `parametro_definir` |
| Desfazer / refazer (Ctrl+Z/Y, `U`) | pilha | `desfazer`, `refazer` |
| Ver estado (verde/vermelho, perfis, pontas soltas) | `sketchResolvido` | pendência: `sketch_estado(sketch)` (estado, dof, culpadas, perfis); a UI usa `__3dm.sketch.inspeciona()` |
| Seleção, janela/cruzamento, pré-seleção | só UI (estado de interface) | não se aplica (o MCP endereça por id) |
| OSNAP/ORTHO/POLAR/GRID/SNAP | só UI | não se aplica (o MCP dá coordenadas exatas) |
| Entrar no sketch por duplo clique na árvore | — | pendência (a UI ainda não faz) |

## F2 — Sólidos

Toda ação passa por `projeto.executa(comando)` com os comandos de `@3dm/core/features` (`comandos.ts`); a regeneração é `entradaDe(doc)` + `Regenerador` (core), igual no Node. O MCP só precisa chamar os mesmos comandos e `regenera`.

| Ação da UI (alias) | Comando do core | Tool MCP prevista |
|---|---|---|
| Criar/editar feature (EXT REV BOX CYL SPH CONE TOR UNI SU IN SHELL HOLE AR MI SLICE, Shift+A) | `adicionaFeature`, `editaFeature` | `feature_adicionar(tipo, campos)`, `feature_editar(id, campos)` (§5.7 `extrudar`, `furo`, `padrao`… são açúcar sobre estas) |
| Chanfro/fillet de borda (CHA, F) | `editaFeature(id, {borda})` | `chanfro`, `fillet_borda` |
| Excluir, suprimir, mover marcador, reordenar | `removeFeature`, `suprimeFeature`, `moveMarcador`, `moveFeature` | `feature_remover`, `feature_suprimir`, `historico_marcador`, `feature_mover` |
| G/R/S, Shift+D (transformação como feature) | `adicionaFeature({tipo:'transformacao'})` | `transformar(corpo, mover, girar, escala, copiar)` |
| Cor do corpo | `definirCorCorpo` | `cor_definir` |
| Tabela de parâmetros (nome, expr, unidade, comentário, renomear, excluir) | `definirParametroCompleto`, `renomeiaParametro`, `removeParametro` | `parametro_definir`, `parametro_renomear`, `parametro_remover` |
| Estado das features (erro/suspensa), corpos, volume, bbox | `Regenerador.regenera` → `status`, `corpos` | `projeto_estado` (equivale a `__3dm.solido.inspeciona()`) |
| Medir (DI, MEA): distância, ângulo, raio, área, volume | `@3dm/core/medir` | `medir(modo, pontos/face/corpo)` |
| Cotas L×W×H (COTAS) | só UI (apresentação) | não se aplica; `projeto_estado` devolve a bbox |
| Esconder/isolar corpo (H, Shift+H, olho) | só UI (estado de interface) | não se aplica |
| Seleção de corpo (clique) | só UI | não se aplica (o MCP endereça por id) |
| Gizmo `W` (arrastar seta/anel) | `adicionaFeature({tipo:'transformacao'})` (igual G/R/S) | `transformar` |
| Plano do sketch por expressão (`offsetExpr`, ex.: `H`) | `criarSketch({base, offset, offsetExpr})` | `sketch_criar(plano, offset)` aceita expressão |

## F4b rodada 1 — tools implementadas (modo headless)

Implementadas em `packages/mcp/src/tools*.ts`: `projeto_novo|abrir|salvar`, `impressora_definir`, `impressoras_listar`, `parametro_definir`, `desfazer`, `refazer`, `features_listar`, `sketch_criar`, `sketch_adicionar` (ponto, linha, retângulo, círculo, arco, polígono), `sketch_restringir` (restrições e cotas), `fillet_sketch`, `extrudar`, `revolver`, `primitiva`, `booleana`, `shell`, `furo`, `padrao`, `espelhar`, `chanfro` (borda de extrude: chanfro/fillet), `feature_editar`, `feature_apagar`, `modelo_info`, `verificar_impressao`, `exportar` (stl|3mf), `captura` (SVG).

| Ação da UI | Estado |
|---|---|
| Sketch criar/adicionar/restringir/cotas/fillet | tool ✅ |
| Features (EXT REV BOX CYL SPH CONE TOR UNI SU IN SHELL HOLE AR MI), chanfro/fillet de borda | tool ✅ |
| Editar/excluir feature | `feature_editar`, `feature_apagar` ✅ |
| Parâmetros (definir) | ✅ `parametro_definir` (usa o core completo, com ciclo); renomear/remover: pendência |
| Medidas (modelo_info), imprimir (verificar), exportar | ✅ |
| Ponte (app ao vivo), PNG da captura | rodada 2 |
| Pendentes (sem tool ainda): `sketch_editar` (mover/copiar/girar/escalar/espelhar/array/aparar/estender/offset/apagar/construção), `sketch_estado`, remover restrição, `feature_suprimir`, `historico_marcador`, `feature_mover`, `transformar`, corte (SLICE), `cor_definir`, `parametro_renomear|remover`, `medir`, `parametros_expostos` (F3b) |

## F4b rodada 2 — fechamento (G7)

Novas tools: `sketch_estado`, `sketch_editar` (mover, copiar, girar, escalar, espelhar, apagar, construcao, aparar, estender, offset, cota, remover_restricao), `feature_suprimir`, `marcador_mover`, `feature_mover`, `transformar` (mover/girar/escalar/copiar), `corte`, `cor_definir` (cor + slot AMS), `parametro_renomear`, `parametro_remover`, `medir` (distancia, angulo, raio, volume, area_face), `parametros_expostos`; `projeto_novo` aceita `nome`; `exportar` aceita `valores` e usa slot/filamento do projeto. Com aba conectada (ponte) todas operam no documento da aba; `captura` devolve PNG da aba.

Ações da UI **sem tool, com motivo**: seleção, janela/cruzamento, OSNAP/ORTHO/POLAR/GRID/SNAP, esconder/isolar corpo, cotas 3D (COTAS), navegação da vista, tema/preferências (estado de interface; o MCP endereça por id e dá coordenadas exatas). Pendências explícitas: entrar no sketch por duplo clique na árvore (a UI ainda não faz); `sketch_adicionar` não cria elipse/oblongo (SLOT) nem polilinha com arco tangente; corte pelas faces e `W` (gizmo) não existem na UI; funções do F3b (importar STL/3MF/OBJ/SVG, texto 3D, `#customizar`) ainda sem tool: `importar` e `texto_3d` ficam para quando o F3b fechar o formato.

## F3b — Impressão, importar, texto, customizar (F4b-r3: tools implementadas)

Tudo passa por `projeto.executa(comando)`; o export é `exporta()` de `@3dm/core/export`.

| Ação da UI (alias) | Comando / função do core | Tool MCP |
|---|---|---|
| Filamento do projeto | `definirFilamento` | `filamento_definir` ✅ |
| Cor + slot do AMS por corpo | `definirCorCorpo` / `definirSlotCorpo` | `cor_definir` ✅ (cor e slot juntos) |
| Tabela de slots (slot → filamento + cor) | `definirSlotTabela` | `slots_definir` ✅ (sem filamento/cor remove) |
| Verificação + massa | `verificar`, `avisosFilamento`, `massaGramas` | `verificar_impressao`, `modelo_info` ✅ |
| Exportar STL / 3MF | `exporta` | `exportar` ✅ (miniatura só no modo ponte) |
| Soltar / Centralizar | `soltarNaMesa`, `centralizar` | `transformar` ✅ |
| Apoiar na face (`LF`) | `orientacaoParaFeature` | `apoiar_na_face(corpo, normal)` ✅ (acha a face plana pela normal, tolerância 10°) |
| Importar SVG → sketch | `lerSvg` + `sketchDePolilinhas` | `importar_svg(svg, plano, escala?, offset?)` ✅ |
| `TEXTO` | `carregaFonte` + `textoParaContornos` + extrude | `texto_3d(texto, tamanho, espessura, plano?, posicao?)` ✅ |
| Expor parâmetro | `exporParametro`, `removerExposto` | `parametros_expostos` ✅ (definir/remover/listar) |
| Customizar por link | `aplicaValores` | `parametro_definir` cobre; link é só UI |
| Modo inclinação, recentes, FSA | só UI | não se aplica |

## Lacunas restantes

- Importar STL/3MF/OBJ como referência (`IMPORTAR`): a referência não entra no documento nem no export; só existe como visual da sessão.
- Entrar no sketch por duplo clique na árvore: a UI ainda não faz.
- `sketch_adicionar` não cria elipse/oblongo (SLOT) nem polilinha com arco tangente.
- Corte pelas faces: não existe na UI. (O gizmo `W` existe e gera transformação, coberta por `transformar`.)
- Slot por corpo sem cor: `cor_definir` exige a cor.
- Seleção, OSNAP/ORTHO/GRID, esconder/isolar, COTAS 3D, vista e tema: estado de interface, sem tool (o MCP endereça por id).
