# Graph Report - 3d_modeling  (2026-11-09)

## Corpus Check
- 294 files · ~199,798 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2342 nodes · 5864 edges · 130 communities (118 shown, 12 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 102 edges (avg confidence: 0.67)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `edcb393f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- sketch/comandos.ts
- editores.ts
- esquemas.ts
- parametros-ui.ts
- sketch/sessao.ts
- medir.ts
- dist
- sketch/tipos.ts
- arquivos.ts
- tools-modelo.ts
- malha/index.ts
- ferramentas-b.ts
- main.ts
- textos.ts
- tools-solido.ts
- edicao2.ts
- modo.ts
- features/doc.ts
- exports
- doc/index.ts
- ferramentas-a.ts
- features-corpos3d.test.ts
- desenho.ts
- features/index.ts
- el
- ligacao.ts
- criaSessaoSketch
- overhang.ts
- solver/solver.ts
- gizmo.ts
- captura-svg.ts
- tools-sketch.ts
- 2. Tarefas por manager
- solido.ts
- classifica.ts
- ponte/cliente.ts
- imprimir/painel.ts
- mcp/package.json
- package.json
- export-montar.test.ts
- 3mf.ts
- orientacao.ts
- Sessao
- escrever3mf.mjs
- Validações do orquestrador
- medir-formato.ts
- Pilha
- tools.ts
- prefs.ts
- Documento
- include
- 6. Funcionalidades em detalhe
- Feature
- novoDocumento
- features/tipos.ts
- features-perfis.test.ts
- app/package.json
- criaOrientacaoUi
- features/perfis.ts
- svg.ts
- Vista
- V3
- texto-texto.test.ts
- F4b rodada 2
- 3d-modeling — Documento Base do Projeto
- gizmo3d.ts
- regen.ts
- sketch-snap.test.ts
- compilerOptions
- Relatório F2 — Sólidos
- topo.ts
- vista.ts
- medir-modelo.ts
- tools-extra2.test.ts
- include
- Relatório F1 — Sketch 2D
- expor.ts
- captura.ts
- features-doc.test.ts
- Relatório F0 — Fundação
- Pt
- importar/ui.ts
- esferas.ts
- opentype.d.ts
- sketch-ponte.test.ts
- servidor.mjs
- tokens.test.ts
- sketch-sessao.test.ts
- spikes/package.json
- Relatório F3b — Impressão na UI
- Relatório SPK — spikes de risco (onda A)
- 5. Arquitetura
- src/barra.ts
- tools-extra2.ts
- imprimir-ui-overhang.test.ts
- TransformacaoSolido
- worker-cliente.test.ts
- RETOMAR — 3d-modeling
- Spike SPK-2: 3MF com fflate (R2)
- Paridade UI ↔ MCP (F1 — sketch)
- Relatório F3a — Export core
- 7. Mapa de atalhos e comandos
- features-medir-modelo.test.ts
- importar-svg.test.ts
- SPK-1 — Solver de restrições (R1)
- Dependências de terceiros
- Protocolo do manager
- 8. Pesquisa: projetos semelhantes
- Desvio
- CorpoInfo
- tools-extra.ts
- 15. Questões
- 1. Visão e objetivos
- 3. Máquinas disponíveis (base do MVP)
- 4. Herança dos projetos anteriores
- Teste da ponte MCP (WebSocket) a partir de uma página https
- 16. Regras do projeto
- textos.test.ts
- imprimir/modelo.ts
- 3d-modeling
- CLAUDE.md
- relatorio-F4b-r3.md
- pre-commit
- referencia.ts
- sketch-selecao.test.ts
- tools-extra.test.ts
- cotas3d.ts
- stl.ts

## God Nodes (most connected - your core abstractions)
1. `el()` - 53 edges
2. `Documento` - 53 edges
3. `T` - 47 edges
4. `Pt` - 42 edges
5. `criaSolido()` - 38 edges
6. `criaSessaoSketch()` - 38 edges
7. `dist()` - 36 edges
8. `SketchFeature` - 36 edges
9. `SessaoSketch` - 34 edges
10. `Projeto` - 32 edges

## Surprising Connections (you probably didn't know these)
- `criaExpor()` --indirect_call--> `item()`  [INFERRED]
  packages/app/src/customizar/expor.ts → packages/app/test/arquivos.test.ts
- `CotaCaixa` --references--> `V3`  [EXTRACTED]
  packages/app/src/features/cotas3d.ts → packages/app/src/features/contrato.ts
- `criaSolido()` --indirect_call--> `orienta()`  [INFERRED]
  packages/app/src/features/solido.ts → packages/core/src/sketch/perfis.ts
- `criaExportador()` --indirect_call--> `exporta()`  [INFERRED]
  packages/app/src/imprimir/exportar.ts → packages/core/src/export/montar.ts
- `criaSessaoSketch()` --indirect_call--> `ehSketch()`  [INFERRED]
  packages/app/src/sketch/sessao.ts → packages/core/src/sketch/tipos.ts

## Import Cycles
- None detected.

## Communities (130 total, 12 thin omitted)

### Community 0 - "sketch/comandos.ts"
Cohesion: 0.14
Nodes (21): achaRestricao(), achaSketch(), adicionaRestricao(), alternaRefCota(), aplicaAdicao(), criarSketch(), editaExprCota(), editaSketch() (+13 more)

### Community 1 - "editores.ts"
Cohesion: 0.07
Nodes (51): Editor, FabricaEditor, PassoEd, Resp, APAGAR(), APARAR(), ARRAY(), ARRAYPOLAR() (+43 more)

### Community 2 - "esquemas.ts"
Cohesion: 0.08
Nodes (34): ALVO, ALVO_OP, Base, Campo, CHECADOS, Esquema, ESQUEMAS, fromFeature() (+26 more)

### Community 3 - "parametros-ui.ts"
Cohesion: 0.05
Nodes (61): CampoEdicao, CAMPOS, criaTabelaParametros(), executaEdicao(), formataValor(), LinhaUI, mensagem(), ResultadoEdicao (+53 more)

### Community 4 - "sketch/sessao.ts"
Cohesion: 0.11
Nodes (22): achaOpcao(), circ(), curva(), DimBase, FERRAMENTAS, Modo, ModoDim, norm() (+14 more)

### Community 5 - "medir.ts"
Cohesion: 0.26
Nodes (15): angulo(), areaFace(), comp(), cross(), det3(), distancia(), dot(), faceDoTriangulo() (+7 more)

### Community 6 - "dist"
Cohesion: 0.14
Nodes (40): brutos(), anguloDe(), areaAssinada(), discretizaArco(), dist(), EPS, interCirculoCirculo(), interLinhaCirculo() (+32 more)

### Community 7 - "sketch/tipos.ts"
Cohesion: 0.10
Nodes (18): ancoraCota(), centro(), cotasTemporarias(), dimInteligente(), ent(), extremos(), fmt(), mesmos() (+10 more)

### Community 8 - "arquivos.ts"
Cohesion: 0.12
Nodes (24): abre(), ArquivoFsa, cancelado(), criaArquivos(), fsa(), JanelaFsa, lembra(), msg() (+16 more)

### Community 9 - "tools-modelo.ts"
Cohesion: 0.11
Nodes (24): calculaPainel(), limiarOverhang(), filamentoPorId(), filamentos, impressoraPorId(), impressoras, EntradaExport, exporta() (+16 more)

### Community 10 - "malha/index.ts"
Cohesion: 0.11
Nodes (24): verificar(), area(), bbox(), fechada(), stl(), volume(), normaliza(), carrega() (+16 more)

### Community 11 - "ferramentas-b.ts"
Cohesion: 0.08
Nodes (38): ContextoFerr, EntradaFerr, FabricaFerramenta, Ferramenta, Forma, Passo, Alvo, alvoEm() (+30 more)

### Community 12 - "main.ts"
Cohesion: 0.05
Nodes (42): aplicaAliases(), CHAVE_ALIASES, DefAlias, leAliases(), parseAliases(), resolveDefs(), salvaAliases(), serializaAliases() (+34 more)

### Community 13 - "textos.ts"
Cohesion: 0.10
Nodes (22): criaBuscaComando(), criaCartaoAjuda(), ATALHOS, filtra(), LinhaAjuda, linhasAjuda(), norm(), iniciou() (+14 more)

### Community 14 - "tools-solido.ts"
Cohesion: 0.14
Nodes (16): idLivre(), Operacao, resumo(), ALVO, cria(), Num, Numero, OPERACAO (+8 more)

### Community 15 - "edicao2.ts"
Cohesion: 0.13
Nodes (34): achar(), aparar(), canto(), chanfro(), Curva, dentro(), erroRaioInterno(), estender() (+26 more)

### Community 16 - "modo.ts"
Cohesion: 0.13
Nodes (20): criaCustomizar(), Customizar, DadosCustomizar, msg(), agrupa(), aplicaValores(), arredonda(), Aviso (+12 more)

### Community 17 - "features/doc.ts"
Cohesion: 0.13
Nodes (20): converteFeature(), NUMERICOS, resolveCampos(), FeatureGeo, FFuro, Perfil, PlanoLocal, Vec2 (+12 more)

### Community 18 - "exports"
Cohesion: 0.07
Nodes (29): manifold-3d, opentype.js, dependencies, fflate, @fontsource/roboto, manifold-3d, opentype.js, exports (+21 more)

### Community 19 - "doc/index.ts"
Cohesion: 0.18
Nodes (10): definirImpressora(), definirParametro(), IMPRESSORA_PADRAO, NOME_PARAMETRO, objeto(), slotValido(), TIPOS_EXPOSTO, valida() (+2 more)

### Community 20 - "ferramentas-a.ts"
Cohesion: 0.13
Nodes (17): alturaDe(), cadeia(), construcao(), cortes(), Fase, linha(), normalEsq(), poligono() (+9 more)

### Community 21 - "features-corpos3d.test.ts"
Cohesion: 0.13
Nodes (8): AcertoCorpo, Corpos3d, criaCorpos3d(), Entrada, cores, IDX, POS, SEM

### Community 22 - "desenho.ts"
Cohesion: 0.12
Nodes (21): corDaEntidade(), CorEntidade, criaDesenho(), criaPontos(), Desenho, EstadoDesenho, localSimbolo(), Lote (+13 more)

### Community 23 - "features/index.ts"
Cohesion: 0.19
Nodes (24): cilindro(), DadosPreset, executaFuro(), PRESETS, executa(), idAlvo(), copias(), dot() (+16 more)

### Community 24 - "el"
Cohesion: 0.16
Nodes (24): criaCards(), NivelHud, Aliases, criaDialogoPrefs(), opcoes(), secaoAliases(), slotsDe(), criaCorSlotCorpo() (+16 more)

### Community 25 - "ligacao.ts"
Cohesion: 0.15
Nodes (19): Acao, Ctx, despacha(), ehRestricao(), Estado, estadoInicial(), Letra, RESTRICOES (+11 more)

### Community 26 - "criaSessaoSketch"
Cohesion: 0.10
Nodes (7): registraSketch(), centroDe(), criaSessaoSketch(), Deps, msg(), SessaoSketch, linhaSel()

### Community 27 - "overhang.ts"
Cohesion: 0.19
Nodes (11): AMARELO, coresOverhang(), CorOverhang, corPorAlpha(), criaOverhang(), LARANJA, mistura(), Overhang (+3 more)

### Community 28 - "solver/solver.ts"
Cohesion: 0.13
Nodes (17): medir(), cholesky(), cholResolve(), compilar(), diagnosticarConflito(), Entidade, Eq, jacobiano() (+9 more)

### Community 29 - "gizmo.ts"
Cohesion: 0.23
Nodes (19): add(), arrastaAnel(), arrastaSeta(), cross(), distRaioAnel(), distRaioPonto(), distRaioSegmento(), dot() (+11 more)

### Community 30 - "captura-svg.ts"
Cohesion: 0.13
Nodes (19): CAMERAS, capturaSvg(), CorpoCaptura, cross(), dot(), fmtMm(), hexRgb(), norm() (+11 more)

### Community 31 - "tools-sketch.ts"
Cohesion: 0.16
Nodes (10): itemEntidade, itemRestricao, TIPOS_REST, toolsSketch, toolsSolido, novaSessao(), achaTool(), novaSessao() (+2 more)

### Community 32 - "2. Tarefas por manager"
Cohesion: 0.09
Nodes (22): 0.1 Papéis, 0.2 Ondas e dependências, 0.3 Protocolo, 0.4 Posse de arquivos (evita conflito entre workers paralelos), 0.5 Regras de código (valem para todo worker), 0. Como o trabalho roda (workflow multiagente), 1.1 DoD global (toda onda), 1.2 DoD por fase (+14 more)

### Community 33 - "solido.ts"
Cohesion: 0.13
Nodes (15): criaCotas3d(), criaMedirUI(), COMANDOS, criaSolido(), DepsSolido, PALETA, PREFIXO, Solido (+7 more)

### Community 34 - "classifica.ts"
Cohesion: 0.27
Nodes (8): classifica(), Classificado, lerObj(), atr(), desescapa(), ENT, ler3mf(), num()

### Community 35 - "ponte/cliente.ts"
Cohesion: 0.05
Nodes (44): criaClientePonte(), DepsPonte, doServidor(), ehSiteHttpsPublico(), ESPERAS_PADRAO, EstadoPonte, objeto(), TextosPonte (+36 more)

### Community 36 - "imprimir/painel.ts"
Cohesion: 0.16
Nodes (13): ArquivoInfo, criaExportador(), DepsExportador, sha256Hex(), UltimoExport, fmtGramas(), criaPainelImprimir(), DepsPainelImprimir (+5 more)

### Community 37 - "mcp/package.json"
Cohesion: 0.10
Nodes (20): @modelcontextprotocol/sdk, bin, 3d-modeling-mcp, dependencies, @3dm/core, @modelcontextprotocol/sdk, ws, zod (+12 more)

### Community 38 - "package.json"
Cohesion: 0.10
Nodes (20): devDependencies, @types/node, @types/three, typescript, vite, license, name, private (+12 more)

### Community 39 - "export-montar.test.ts"
Cohesion: 0.16
Nodes (12): SEM, Malha, ResultadoRegen, CORPOS(), EXEMPLO, codigos(), rodar(), caixa() (+4 more)

### Community 40 - "3mf.ts"
Cohesion: 0.14
Nodes (19): bambuModelSettings(), bambuProjectJson(), completa(), Config3mf, Corpo3mf, CorpoNorm, corRGBA(), ESC (+11 more)

### Community 41 - "orientacao.ts"
Cohesion: 0.33
Nodes (10): apoiarNaFace(), bboxGirada(), Caixa, cross(), eulerDe(), giroParaBaixo(), Mat, matRot() (+2 more)

### Community 42 - "Sessao"
Cohesion: 0.14
Nodes (7): criaDespacho(), Sessao, Tool, PLANO, toolsF3b2, nova(), pasta()

### Community 43 - "escrever3mf.mjs"
Cohesion: 0.16
Nodes (14): bambuModelSettings(), bambuProjectJson(), corRGBA(), esc(), escrever3mf(), modeloXml(), slic3rPeConfig(), slic3rPeModelConfig() (+6 more)

### Community 44 - "Validações do orquestrador"
Cohesion: 0.10
Nodes (20): Configuração do workflow, Incidentes, Onda A — F0 (2026-11-08) ✅ com rodada 2 de correção, Onda A — SPK (2026-11-08) ✅, Onda B — F1 rodada 1 (2026-11-08) ❌ volta para rodada 2, Onda B — F1 rodada 2 (2026-11-08) ✅, Onda B — F3a (2026-11-08) ✅, Onda C (antecipada) — F2 rodada 1, core (2026-11-08) ✅ (+12 more)

### Community 45 - "medir-formato.ts"
Cohesion: 0.22
Nodes (11): numeroPtBr(), rotuloCota(), numero(), textoAngulo(), textoArea(), textoDistancia(), textoRaio(), textoVolume() (+3 more)

### Community 47 - "tools.ts"
Cohesion: 0.15
Nodes (11): executa, server, sessao, basicas, checaImpressora(), docsApi(), tools, NOMES (+3 more)

### Community 48 - "prefs.ts"
Cohesion: 0.20
Nodes (13): Armazem, em(), lePrefs(), normaliza(), PADRAO, Prefs, aoMudarSistema(), aplicaTema() (+5 more)

### Community 49 - "Documento"
Cohesion: 0.19
Nodes (9): Registro, tokenDoHash(), guarda(), instalaPonte(), lembrado(), criaProjeto(), Projeto, Comando (+1 more)

### Community 50 - "include"
Cohesion: 0.11
Nodes (18): **/dist, DOM, node_modules, packages/app/vite.config.ts, packages/*/filaments, packages/*/printers, packages/*/src, packages/*/test (+10 more)

### Community 51 - "6. Funcionalidades em detalhe"
Cohesion: 0.11
Nodes (18): 6.10 Impressão [F3], 6.11 Importar [F3], 6.12 Calibração [F6], 6.13 Perfis genéricos de impressora [F6], 6.14 Aparência e materiais [F2], 6.15 Undo, histórico e erros [F0–F2], 6.16 Modo customizar [F3], 6.17 Ajuda e descoberta [F1+] (+10 more)

### Community 52 - "Feature"
Cohesion: 0.16
Nodes (14): criaArvore(), DocArvore, LinhaArvore, linhasArvore(), proximoMarcador(), AcoesArvore, DadosSolido, PedidoPainel (+6 more)

### Community 53 - "novoDocumento"
Cohesion: 0.15
Nodes (15): criaGeometria(), DEBOUNCE_MS, Ok, Pend, reg, w, CorpoBuf, Pedido (+7 more)

### Community 54 - "features/tipos.ts"
Cohesion: 0.24
Nodes (14): Base, FBooleana, FCorte, FEspelho, FExtrude, FPadrao, FPrimitiva, FRevolve (+6 more)

### Community 55 - "features-perfis.test.ts"
Cohesion: 0.11
Nodes (11): BordaExtrude, criaLixo(), malhaDe(), ctxNovo(), quadrado(), retangulo(), roda(), ctxCom() (+3 more)

### Community 56 - "app/package.json"
Cohesion: 0.12
Nodes (16): dependencies, @3dm/core, @fontsource/roboto, three, @3dm/core, @fontsource/roboto, license, name (+8 more)

### Community 58 - "features/perfis.ts"
Cohesion: 0.17
Nodes (18): extrudeComBorda(), recuo(), aplicaOperacao(), distanciaAte(), executaExtrude(), executaRevolve(), normaliza(), perfisDe() (+10 more)

### Community 59 - "svg.ts"
Cohesion: 0.20
Nodes (16): arco(), atributos(), caminho(), comp(), comprimento(), cubica(), elipse(), FATOR (+8 more)

### Community 60 - "Vista"
Cohesion: 0.30
Nodes (4): Alvos, instalaAtalhos(), Ligacao, Vista

### Community 61 - "V3"
Cohesion: 0.16
Nodes (12): V3, ResultadoMedida, AlvoT, criaTransformacaoSolido(), Efeito, Eixo, IDX, Letra (+4 more)

### Community 62 - "texto-texto.test.ts"
Cohesion: 0.17
Nodes (12): carregaFonte(), igual(), limpa(), P, textoParaContornos(), areaAbs(), areaLiquida(), dentro() (+4 more)

### Community 63 - "F4b rodada 2"
Cohesion: 0.14
Nodes (13): Ajuste da captura (pós-rodada 2), Checklist no browser (orquestrador), Como funciona o modo ponte, Decisões, Decisões / pendências, F4b rodada 1 (só `packages/mcp/**`), F4b rodada 2, Pendências / riscos (+5 more)

### Community 64 - "3d-modeling — Documento Base do Projeto"
Cohesion: 0.14
Nodes (13): 10. Orçamentos de desempenho, 11. Roadmap por fases, 12.1 DoD global (vale para toda entrega), 12.2 DoD por fase (critérios de aceite), 12. Definition of Done (DoD), 13. Testes e verificação, 14. Riscos, 17. Estrutura de pastas proposta (+5 more)

### Community 65 - "gizmo3d.ts"
Cohesion: 0.18
Nodes (9): COR, corBase(), criaGizmo3d(), DIR, Eixo, EIXO_Z, EIXOS, Gizmo3d (+1 more)

### Community 66 - "regen.ts"
Cohesion: 0.19
Nodes (12): TOL_PREVIA, aplica(), chaveDe(), cyrb53(), Entrada, Erro, liberaEntrada(), mensagem() (+4 more)

### Community 67 - "sketch-snap.test.ts"
Cohesion: 0.15
Nodes (5): OpcoesSnap, TipoSnap, base, P(), ptoAng()

### Community 68 - "compilerOptions"
Cohesion: 0.14
Nodes (13): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, isolatedModules, module, moduleResolution, noEmit, noUncheckedSideEffectImports (+5 more)

### Community 69 - "Relatório F2 — Sólidos"
Cohesion: 0.15
Nodes (12): Como o app importa (navegador), Como o orquestrador valida (sem mouse), Contrato (para a rodada 2), Decisões / riscos, Medições (Node, peça de 12 itens: caixa, casca, 4 furos, 2 pinos, padrão, espelho, união), Pendências e riscos novos, Relatório F2 — Sólidos, Rodada 1 (core: F2-01, F2-02, F2-03, matemática da F2-07) (+4 more)

### Community 71 - "vista.ts"
Cohesion: 0.31
Nodes (10): acaoDoMouse(), AcaoMouse, AcaoTecla, passoGrade(), Preset, teclaNumpad(), Vec3, criaVista() (+2 more)

### Community 72 - "medir-modelo.ts"
Cohesion: 0.38
Nodes (11): centroDaRegiao(), comp(), cross(), distTri(), dot(), ModoMedir, noSegmento(), Snap (+3 more)

### Community 73 - "tools-extra2.test.ts"
Cohesion: 0.20
Nodes (14): criaPilha(), adicionaFeature(), criaSessao(), toolsModelo, caixa(), chama(), extra(), modelo() (+6 more)

### Community 74 - "include"
Cohesion: 0.15
Nodes (12): compilerOptions, lib, types, extends, include, ES2022, node, ../../tsconfig.base.json (+4 more)

### Community 75 - "Relatório F1 — Sketch 2D"
Cohesion: 0.17
Nodes (11): Checklist de browser — rodada 2, Checklist de verificação no navegador (orquestrador), Comandos de verificação, Critérios F1 (§1.2) → verificação, Decisões, Decisões e pendências da rodada 2, Pendências e riscos, Relatório F1 — Sketch 2D (+3 more)

### Community 76 - "expor.ts"
Cohesion: 0.20
Nodes (12): criaExpor(), msg(), numOuUndef(), textoErro(), ErroOpcoes, parseOpcoes(), item(), Exposto (+4 more)

### Community 77 - "captura.ts"
Cohesion: 0.23
Nodes (9): criaCapturador(), direcaoDaVista(), DIRECOES, isoDir, isoUp, metadeOrtografica(), NomeVista, Vec3 (+1 more)

### Community 78 - "features-doc.test.ts"
Cohesion: 0.23
Nodes (11): entradaDe(), perfisDoSketch(), planoDoSketch(), v2(), docCom(), furo, ln(), pt() (+3 more)

### Community 79 - "Relatório F0 — Fundação"
Cohesion: 0.20
Nodes (9): Checklist de verificação no navegador (orquestrador), Decisões, Mapa dos critérios F0 "A" (§1.2) → check, Pendências e riscos, Pontos de extensão para as próximas ondas, Relatório F0 — Fundação, Rodada 2, Tarefas (+1 more)

### Community 80 - "Pt"
Cohesion: 0.09
Nodes (21): criaDyn(), Dyn, medidasDyn(), textoDyn(), Canto, Vertice, Oblongo, PtRef (+13 more)

### Community 81 - "importar/ui.ts"
Cohesion: 0.23
Nodes (7): carregaFonteSobDemanda(), criaImportar(), DepsImportar, Fonte, Contexto, sketchDePolilinhas(), docExtrudado()

### Community 82 - "esferas.ts"
Cohesion: 0.22
Nodes (8): AMARELO, CINZA, DEGRADE, LARANJA, lerp(), porPixel(), VERDE, VERMELHO

### Community 83 - "opentype.d.ts"
Cohesion: 0.20
Nodes (5): Font, Glyph, opentype.js, Path, PathCommand

### Community 84 - "sketch-ponte.test.ts"
Cohesion: 0.38
Nodes (6): grade(), ln(), pt(), recNoOlho(), rs(), sk()

### Community 85 - "servidor.mjs"
Cohesion: 0.29
Nodes (6): digest(), EXTRAS, iniciar(), ORIGENS_OK, tokenDoPedido(), comServidor()

### Community 86 - "tokens.test.ts"
Cohesion: 0.25
Nodes (7): claro, css, escuro, GRAFICO, lum(), razao(), TEXTO

### Community 87 - "sketch-sessao.test.ts"
Cohesion: 0.18
Nodes (8): Ent, Insp, monta(), perto(), ponto(), pontos(), Rest, ORIGEM

### Community 88 - "spikes/package.json"
Cohesion: 0.22
Nodes (8): dependencies, fflate, ws, fflate, ws, name, private, type

### Community 89 - "Relatório F3b — Impressão na UI"
Cohesion: 0.25
Nodes (7): Checklist de mouse/navegador (orquestrador), Decisões, Pendências e riscos, Relatório F3b — Impressão na UI, Tarefas, Verificação, Workers Haiku: 14

### Community 90 - "Relatório SPK — spikes de risco (onda A)"
Cohesion: 0.25
Nodes (7): Checklist de verificação manual (R4, browser pane), Comandos, Decisões, Pendências (H2 e outros), Promoção, Relatório SPK — spikes de risco (onda A), Riscos novos

### Community 91 - "5. Arquitetura"
Cohesion: 0.25
Nodes (8): 5.1 Visão geral, 5.2 Documento do projeto (formato `.3dm.json`), 5.3 Kernel (MVP = manifold-3d), 5.4 Solver de restrições do sketch, 5.5 Workers e regeneração, 5.6 Persistência, 5.7 MCP, 5. Arquitetura

### Community 92 - "src/barra.ts"
Cohesion: 0.36
Nodes (8): criaBarra(), TECLA, alterna(), estadoInicial(), EstadoModos, Modo, ORDEM, TECLA_F

### Community 93 - "tools-extra2.ts"
Cohesion: 0.18
Nodes (8): ALVO, ExpostoZ, Num, Numero, Plano, toolsExtra2, V3, Vec3

### Community 94 - "imprimir-ui-overhang.test.ts"
Cohesion: 0.20
Nodes (6): AMARELO, LARANJA, piramide(), VERDE, VERMELHO, R()

### Community 96 - "worker-cliente.test.ts"
Cohesion: 0.25
Nodes (3): doc, WorkerFalso, workers

### Community 97 - "RETOMAR — 3d-modeling"
Cohesion: 0.25
Nodes (7): Como rodar, Lacunas conhecidas (não bloqueiam o MVP), O que existe, Pendências do usuário (H), Próximas fases (§11 do `PROJETO_BASE.md`, ainda sem plano), Regras do usuário, RETOMAR — 3d-modeling

### Community 98 - "Spike SPK-2: 3MF com fflate (R2)"
Cohesion: 0.25
Nodes (7): Chaves conferidas nas fontes, Chaves de UI novas, Decisão, NAO CONFIRMADO, Spike SPK-2: 3MF com fflate (R2), Teste manual (H2), URLs consultadas

### Community 99 - "Paridade UI ↔ MCP (F1 — sketch)"
Cohesion: 0.29
Nodes (6): F2 — Sólidos, F3b — Impressão, importar, texto, customizar (F4b-r3: tools implementadas), F4b rodada 1 — tools implementadas (modo headless), F4b rodada 2 — fechamento (G7), Lacunas restantes, Paridade UI ↔ MCP (F1 — sketch)

### Community 100 - "Relatório F3a — Export core"
Cohesion: 0.29
Nodes (6): API, Decisões, Pendências / riscos, Relatório F3a — Export core, Tarefas, Workers Haiku: 4

### Community 101 - "7. Mapa de atalhos e comandos"
Cohesion: 0.29
Nodes (7): 7.1 Aliases de comando (linha de comando, Enter/Espaço executa), 7.2 Teclas de função (estado, barra de status), 7.3 Teclas imediatas (sem Enter), 7.4 Mouse, 7.5 Conferência dos atalhos (rodada 2, D30), 7.6 Arquivo de aliases editável, 7. Mapa de atalhos e comandos

### Community 102 - "features-medir-modelo.test.ts"
Cohesion: 0.33
Nodes (6): criaMedicao(), caixa, IDX, perto(), pertoV(), POS

### Community 104 - "SPK-1 — Solver de restrições (R1)"
Cohesion: 0.29
Nodes (6): Achados e riscos para a F1, Cobertura (20 sketches), Como rodar, Números (Node 25.8, mediana de 15 execuções, com resolução de 1 mm de ruído inicial), O que foi implementado (`solver.ts`), SPK-1 — Solver de restrições (R1)

### Community 105 - "Dependências de terceiros"
Cohesion: 0.29
Nodes (6): Código copiado de projetos do mesmo autor (MIT), Dependências de terceiros, No bundle publicado (runtime), `packages/mcp` (F4a, Node; não vai no bundle do app), Previstas (ainda não instaladas), Só de desenvolvimento (não publicados)

### Community 106 - "Protocolo do manager"
Cohesion: 0.33
Nodes (5): Antes de começar, Como trabalhar, Entrega, Protocolo do manager, Regras do worker (copiar no fim de todo prompt de worker)

### Community 107 - "8. Pesquisa: projetos semelhantes"
Cohesion: 0.33
Nodes (6): 8.1 Panorama, 8.2 MCPs de CAD existentes, 8.3 Copiar (ranqueado por impacto na facilidade de uso), 8.4 Evitar, 8.5 Repositórios para inspiração e reuso, 8. Pesquisa: projetos semelhantes

### Community 110 - "tools-extra.ts"
Cohesion: 0.11
Nodes (18): comandoDoc(), executaChecando(), idsComErro(), regenera(), regeneradores, copiaLivre(), corpoDe(), IDS (+10 more)

### Community 111 - "15. Questões"
Cohesion: 0.40
Nodes (5): 15.1 Resolvidas na rodada 1 (2026-11-08), 15.2 Resolvidas na rodada 2 (2026-11-08), 15.3 Resolvida na rodada 3, 15.4 Abertas, 15. Questões

### Community 112 - "1. Visão e objetivos"
Cohesion: 0.40
Nodes (5): 1.1 O que é, 1.2 Problema que resolve, 1.3 Objetivos (em ordem de prioridade), 1.4 Não-objetivos (MVP), 1. Visão e objetivos

### Community 113 - "3. Máquinas disponíveis (base do MVP)"
Cohesion: 0.40
Nodes (5): 3.1 Anycubic i3 Mega S, 3.2 Bambu Lab P2S, 3.3 Modelo de dados de impressora (MVP), 3.4 Filamentos (MVP: PLA, PETG, TPU, ABS/ASA), 3. Máquinas disponíveis (base do MVP)

### Community 114 - "4. Herança dos projetos anteriores"
Cohesion: 0.40
Nodes (5): 4.1 Do `modular_terrain_system` (RPG Block Builder) — **base visual, de desempenho e de processo**, 4.2 Premissas visuais (valores reais do terrain), 4.3 Premissas de desempenho (do terrain), 4.4 Do `3dprinter_plotter`, 4. Herança dos projetos anteriores

### Community 115 - "Teste da ponte MCP (WebSocket) a partir de uma página https"
Cohesion: 0.40
Nodes (4): 1. Subir o servidor, 2. Teste com token (deve funcionar), 3. Teste sem token (deve ser recusado), Teste da ponte MCP (WebSocket) a partir de uma página https

### Community 116 - "16. Regras do projeto"
Cohesion: 0.50
Nodes (4): 16.1 Graphify (sem LLM, a cada commit), 16.2 CLAUDE.md do projeto (proposta), 16.3 Regras do usuário (herdadas), 16. Regras do projeto

### Community 118 - "imprimir/modelo.ts"
Cohesion: 0.27
Nodes (11): Painel, Filamento, Impressora, OpcoesAvisosFilamento, dims(), MSG, n1(), Achado (+3 more)

### Community 125 - "referencia.ts"
Cohesion: 0.29
Nodes (3): criaReferencias(), Item, Referencias

### Community 126 - "sketch-selecao.test.ts"
Cohesion: 0.39
Nodes (6): todas(), C(), cena(), L(), P(), sk()

### Community 127 - "tools-extra.test.ts"
Cohesion: 0.36
Nodes (5): chama(), estado(), novaSessao(), retangulo(), tool()

### Community 128 - "cotas3d.ts"
Cohesion: 0.52
Nodes (6): comp(), CotaCaixa, geometriaCotas(), soma(), sub(), unit()

### Community 129 - "stl.ts"
Cohesion: 0.70
Nodes (4): cantosAscii(), cantosBinario(), lerStl(), soldar()

## Knowledge Gaps
- **598 isolated node(s):** `name`, `private`, `type`, `license`, `packages/*` (+593 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `T` connect `textos.ts` to `editores.ts`, `esquemas.ts`, `parametros-ui.ts`, `sketch/sessao.ts`, `arquivos.ts`, `tools-modelo.ts`, `ferramentas-b.ts`, `main.ts`, `modo.ts`, `ferramentas-a.ts`, `desenho.ts`, `el`, `solido.ts`, `imprimir/painel.ts`, `medir-formato.ts`, `Documento`, `Feature`, `novoDocumento`, `V3`, `topo.ts`, `medir-modelo.ts`, `expor.ts`, `Pt`, `importar/ui.ts`, `sketch-sessao.test.ts`, `src/barra.ts`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `Documento` connect `Documento` to `sketch/comandos.ts`, `parametros-ui.ts`, `sketch/sessao.ts`, `arquivos.ts`, `tools-modelo.ts`, `malha/index.ts`, `modo.ts`, `features/doc.ts`, `doc/index.ts`, `tools-sketch.ts`, `solido.ts`, `ponte/cliente.ts`, `imprimir/painel.ts`, `export-montar.test.ts`, `Sessao`, `novoDocumento`, `texto-texto.test.ts`, `tools-extra2.test.ts`, `expor.ts`, `features-doc.test.ts`, `importar-svg.test.ts`, `tools-extra.ts`, `imprimir/modelo.ts`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `SketchFeature` connect `ferramentas-b.ts` to `sketch/comandos.ts`, `editores.ts`, `parametros-ui.ts`, `sketch/sessao.ts`, `sketch-snap.test.ts`, `dist`, `sketch/tipos.ts`, `features-doc.test.ts`, `edicao2.ts`, `Pt`, `Feature`, `sketch-ponte.test.ts`, `desenho.ts`, `sketch-sessao.test.ts`, `sketch-selecao.test.ts`, `tools-sketch.ts`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `criaSolido()` (e.g. with `.corposFinos()` and `.escreve()`) actually correct?**
  _`criaSolido()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _598 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `sketch/comandos.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1402116402116402 - nodes in this community are weakly interconnected._
- **Should `editores.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06559356136820925 - nodes in this community are weakly interconnected._