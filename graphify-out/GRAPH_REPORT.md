# Graph Report - 3d_modeling  (2026-11-09)

## Corpus Check
- 294 files · ~199,636 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2341 nodes · 5863 edges · 125 communities (117 shown, 8 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 102 edges (avg confidence: 0.67)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- criaSessaoSketch
- editores.ts
- esquemas.ts
- parametros-ui.ts
- sketch/sessao.ts
- medir-modelo.ts
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
- tools-f3b.ts
- ferramentas-a.ts
- features-corpos3d.test.ts
- desenho.ts
- features/index.ts
- el
- ligacao.ts
- sketch/index.ts
- overhang.ts
- solver/solver.ts
- gizmo.ts
- captura-svg.ts
- tools-sketch.ts
- 2. Tarefas por manager
- solido.ts
- importar-malha.test.ts
- ponte/cliente.ts
- imprimir/painel.ts
- mcp/package.json
- package.json
- export-montar.test.ts
- 3mf.ts
- imprimir-orientacao.test.ts
- src/ponte.ts
- escrever3mf.mjs
- Validações do orquestrador
- novoDocumento
- doc/index.ts
- tools.ts
- prefs.ts
- Documento
- include
- 6. Funcionalidades em detalhe
- Feature
- regen/index.ts
- features/tipos.ts
- features-perfis.test.ts
- app/package.json
- Projeto
- features/perfis.ts
- svg.ts
- Vista
- V3
- texto-texto.test.ts
- F4b rodada 2
- 3d-modeling — Documento Base do Projeto
- gizmo3d.ts
- Regenerador
- sketch-snap.test.ts
- compilerOptions
- Relatório F2 — Sólidos
- linha-aliases.test.ts
- vista.ts
- kernel/index.ts
- tools-extra2.test.ts
- include
- Relatório F1 — Sketch 2D
- expor.ts
- captura.ts
- features-doc.test.ts
- Relatório F0 — Fundação
- dyn.ts
- sketch-editores.test.ts
- esferas.ts
- opentype.d.ts
- sketch-ponte.test.ts
- servidor.mjs
- tokens.test.ts
- ponte-stdio.test.ts
- spikes/package.json
- Relatório F3b — Impressão na UI
- Relatório SPK — spikes de risco (onda A)
- 5. Arquitetura
- src/barra.ts
- sketch.ts
- criaArvore
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
- instala.ts
- tools-f3b.test.ts
- 15. Questões
- 1. Visão e objetivos
- 3. Máquinas disponíveis (base do MVP)
- 4. Herança dos projetos anteriores
- Teste da ponte MCP (WebSocket) a partir de uma página https
- 16. Regras do projeto
- textos.test.ts
- mensagens.ts
- 3d-modeling
- CLAUDE.md
- relatorio-F4b-r3.md
- pre-commit

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
- `Registro` --references--> `Documento`  [EXTRACTED]
  packages/app/src/arquivos.ts → packages/core/src/doc/tipos.ts
- `CotaCaixa` --references--> `V3`  [EXTRACTED]
  packages/app/src/features/cotas3d.ts → packages/app/src/features/contrato.ts
- `criaSolido()` --indirect_call--> `orienta()`  [INFERRED]
  packages/app/src/features/solido.ts → packages/core/src/sketch/perfis.ts
- `criaExportador()` --indirect_call--> `exporta()`  [INFERRED]
  packages/app/src/imprimir/exportar.ts → packages/core/src/export/montar.ts

## Import Cycles
- None detected.

## Communities (125 total, 8 thin omitted)

### Community 0 - "criaSessaoSketch"
Cohesion: 0.05
Nodes (38): registraSketch(), criaSessaoSketch(), Deps, SessaoSketch, EstadoModos, Ent, Insp, linhaSel() (+30 more)

### Community 1 - "editores.ts"
Cohesion: 0.08
Nodes (51): FabricaEditor, PassoEd, APAGAR(), APARAR(), ARRAY(), ARRAYPOLAR(), CHANFRO(), CONSTRUCAO_ALT() (+43 more)

### Community 2 - "esquemas.ts"
Cohesion: 0.06
Nodes (40): ALVO, ALVO_OP, Base, Campo, CHECADOS, Esquema, ESQUEMAS, fromFeature() (+32 more)

### Community 3 - "parametros-ui.ts"
Cohesion: 0.07
Nodes (46): CampoEdicao, CAMPOS, criaTabelaParametros(), executaEdicao(), formataValor(), LinhaUI, mensagem(), ResultadoEdicao (+38 more)

### Community 4 - "sketch/sessao.ts"
Cohesion: 0.06
Nodes (42): Editor, Resp, EntradaFerr, FabricaFerramenta, Ferramenta, Passo, Oblongo, PtRef (+34 more)

### Community 5 - "medir-modelo.ts"
Cohesion: 0.09
Nodes (43): comp(), CotaCaixa, geometriaCotas(), soma(), sub(), unit(), numeroPtBr(), rotuloCota() (+35 more)

### Community 6 - "dist"
Cohesion: 0.13
Nodes (45): polilinhaDe(), polilinhaDeForma(), brutos(), anguloDe(), areaAssinada(), discretizaArco(), discretizaCirculo(), dist() (+37 more)

### Community 7 - "sketch/tipos.ts"
Cohesion: 0.08
Nodes (27): ancoraCota(), centro(), cotasTemporarias(), dimInteligente(), ent(), extremos(), fmt(), mesmos() (+19 more)

### Community 8 - "arquivos.ts"
Cohesion: 0.07
Nodes (26): abre(), ArquivoFsa, cancelado(), criaArquivos(), fsa(), JanelaFsa, lembra(), msg() (+18 more)

### Community 9 - "tools-modelo.ts"
Cohesion: 0.12
Nodes (32): calculaPainel(), Painel, limiarOverhang(), Filamento, filamentoPorId(), filamentos, Impressora, impressoraPorId() (+24 more)

### Community 10 - "malha/index.ts"
Cohesion: 0.11
Nodes (24): Item, verificar(), malhaDe(), area(), bbox(), fechada(), stl(), volume() (+16 more)

### Community 11 - "ferramentas-b.ts"
Cohesion: 0.10
Nodes (30): ContextoFerr, Alvo, alvoEm(), arco(), arcoTangente(), centrosTTR(), circulo(), circuncentro() (+22 more)

### Community 12 - "main.ts"
Cohesion: 0.06
Nodes (33): abaDir, arquivo, arquivos, atualiza(), barra, barraSketch, buscaComando, cards (+25 more)

### Community 13 - "textos.ts"
Cohesion: 0.13
Nodes (18): criaBuscaComando(), criaCartaoAjuda(), ATALHOS, filtra(), LinhaAjuda, linhasAjuda(), norm(), iniciou() (+10 more)

### Community 14 - "tools-solido.ts"
Cohesion: 0.08
Nodes (29): idLivre(), Operacao, comandoDoc(), executaChecando(), idsComErro(), regeneradores, resumo(), ALVO (+21 more)

### Community 15 - "edicao2.ts"
Cohesion: 0.13
Nodes (33): achar(), aparar(), canto(), chanfro(), Curva, dentro(), erroRaioInterno(), estender() (+25 more)

### Community 16 - "modo.ts"
Cohesion: 0.13
Nodes (21): criaCustomizar(), Customizar, DadosCustomizar, msg(), agrupa(), aplicaValores(), arredonda(), Aviso (+13 more)

### Community 17 - "features/doc.ts"
Cohesion: 0.11
Nodes (23): NUMERICOS, Delta, FeatureGeo, FFuro, Perfil, PlanoLocal, TOL_PREVIA, Vec2 (+15 more)

### Community 18 - "exports"
Cohesion: 0.07
Nodes (29): manifold-3d, opentype.js, dependencies, fflate, @fontsource/roboto, manifold-3d, opentype.js, exports (+21 more)

### Community 19 - "tools-f3b.ts"
Cohesion: 0.11
Nodes (18): definirImpressora(), definirParametro(), IMPRESSORA_PADRAO, lerDocumento(), NOME_PARAMETRO, objeto(), slotValido(), TIPOS_EXPOSTO (+10 more)

### Community 20 - "ferramentas-a.ts"
Cohesion: 0.12
Nodes (19): alturaDe(), cadeia(), Canto, construcao(), cortes(), Fase, linha(), normalEsq() (+11 more)

### Community 21 - "features-corpos3d.test.ts"
Cohesion: 0.10
Nodes (10): CorpoInfo, AcertoCorpo, Corpos3d, criaCorpos3d(), Entrada, Medicao, cores, IDX (+2 more)

### Community 22 - "desenho.ts"
Cohesion: 0.12
Nodes (18): corDaEntidade(), CorEntidade, criaDesenho(), criaPontos(), Desenho, EstadoDesenho, localSimbolo(), Lote (+10 more)

### Community 23 - "features/index.ts"
Cohesion: 0.21
Nodes (23): cilindro(), DadosPreset, executaFuro(), PRESETS, executa(), aplicaOperacao(), idAlvo(), copias() (+15 more)

### Community 24 - "el"
Cohesion: 0.21
Nodes (19): criaCards(), NivelHud, Aliases, criaDialogoPrefs(), opcoes(), secaoAliases(), slotsDe(), criaCorSlotCorpo() (+11 more)

### Community 25 - "ligacao.ts"
Cohesion: 0.15
Nodes (19): Acao, Ctx, despacha(), ehRestricao(), Estado, estadoInicial(), Letra, RESTRICOES (+11 more)

### Community 26 - "sketch/index.ts"
Cohesion: 0.14
Nodes (19): resolveSketch(), cholesky(), cholResolve(), compilar(), diagnosticarConflito(), Entidade, Eq, jacobiano() (+11 more)

### Community 27 - "overhang.ts"
Cohesion: 0.10
Nodes (17): AMARELO, coresOverhang(), CorOverhang, corPorAlpha(), criaOverhang(), LARANJA, mistura(), Overhang (+9 more)

### Community 28 - "solver/solver.ts"
Cohesion: 0.13
Nodes (17): medir(), cholesky(), cholResolve(), compilar(), diagnosticarConflito(), Entidade, Eq, jacobiano() (+9 more)

### Community 29 - "gizmo.ts"
Cohesion: 0.23
Nodes (19): add(), arrastaAnel(), arrastaSeta(), cross(), distRaioAnel(), distRaioPonto(), distRaioSegmento(), dot() (+11 more)

### Community 30 - "captura-svg.ts"
Cohesion: 0.13
Nodes (20): CAMERAS, capturaSvg(), CorpoCaptura, cross(), dot(), fmtMm(), hexRgb(), norm() (+12 more)

### Community 31 - "tools-sketch.ts"
Cohesion: 0.14
Nodes (17): regenera(), Tool, itemEntidade, itemRestricao, TIPOS_REST, toolsSketch, toolsSolido, chama() (+9 more)

### Community 32 - "2. Tarefas por manager"
Cohesion: 0.09
Nodes (22): 0.1 Papéis, 0.2 Ondas e dependências, 0.3 Protocolo, 0.4 Posse de arquivos (evita conflito entre workers paralelos), 0.5 Regras de código (valem para todo worker), 0. Como o trabalho roda (workflow multiagente), 1.1 DoD global (toda onda), 1.2 DoD por fase (+14 more)

### Community 33 - "solido.ts"
Cohesion: 0.13
Nodes (11): criaCotas3d(), ResultadoMedida, criaMedirUI(), COMANDOS, criaSolido(), DepsSolido, PALETA, PREFIXO (+3 more)

### Community 34 - "importar-malha.test.ts"
Cohesion: 0.17
Nodes (15): classifica(), Classificado, lerObj(), cantosAscii(), cantosBinario(), lerStl(), soldar(), atr() (+7 more)

### Community 35 - "ponte/cliente.ts"
Cohesion: 0.15
Nodes (18): doServidor(), ESPERAS_PADRAO, objeto(), AcaoPonte, ArgsAplicar, ArgsCaptura, lerMensagemDoApp(), MensagemDoApp (+10 more)

### Community 36 - "imprimir/painel.ts"
Cohesion: 0.17
Nodes (10): ArquivoInfo, criaExportador(), DepsExportador, sha256Hex(), UltimoExport, criaPainelImprimir(), DepsPainelImprimir, EntradaExport (+2 more)

### Community 37 - "mcp/package.json"
Cohesion: 0.10
Nodes (20): @modelcontextprotocol/sdk, bin, 3d-modeling-mcp, dependencies, @3dm/core, @modelcontextprotocol/sdk, ws, zod (+12 more)

### Community 38 - "package.json"
Cohesion: 0.10
Nodes (20): devDependencies, @types/node, @types/three, typescript, vite, license, name, private (+12 more)

### Community 39 - "export-montar.test.ts"
Cohesion: 0.19
Nodes (13): fmtGramas(), doc(), falsas(), mapa(), SEM, ArquivoExport, CORPOS(), EXEMPLO (+5 more)

### Community 40 - "3mf.ts"
Cohesion: 0.16
Nodes (17): bambuModelSettings(), bambuProjectJson(), completa(), Corpo3mf, CorpoNorm, corRGBA(), ESC, escrever3mf() (+9 more)

### Community 41 - "imprimir-orientacao.test.ts"
Cohesion: 0.18
Nodes (17): apoiarNaFace(), bboxGirada(), Caixa, centralizar(), cross(), eulerDe(), giroParaBaixo(), Mat (+9 more)

### Community 42 - "src/ponte.ts"
Cohesion: 0.15
Nodes (11): digest(), iniciarPonte(), ORIGENS_OK, Ponte, recusa(), servirArquivo(), TIPOS, tokenDoPedido() (+3 more)

### Community 43 - "escrever3mf.mjs"
Cohesion: 0.16
Nodes (14): bambuModelSettings(), bambuProjectJson(), corRGBA(), esc(), escrever3mf(), modeloXml(), slic3rPeConfig(), slic3rPeModelConfig() (+6 more)

### Community 44 - "Validações do orquestrador"
Cohesion: 0.10
Nodes (19): Configuração do workflow, Incidentes, Onda A — F0 (2026-11-08) ✅ com rodada 2 de correção, Onda A — SPK (2026-11-08) ✅, Onda B — F1 rodada 1 (2026-11-08) ❌ volta para rodada 2, Onda B — F1 rodada 2 (2026-11-08) ✅, Onda B — F3a (2026-11-08) ✅, Onda C (antecipada) — F2 rodada 1, core (2026-11-08) ✅ (+11 more)

### Community 45 - "novoDocumento"
Cohesion: 0.14
Nodes (13): criaClientePonte(), DepsPonte, ehSiteHttpsPublico(), EstadoPonte, TextosPonte, urlLocal(), cenario(), comParametro() (+5 more)

### Community 46 - "doc/index.ts"
Cohesion: 0.16
Nodes (6): criaPilha(), Pilha, criaSessao(), nova(), pasta(), novaSessao()

### Community 47 - "tools.ts"
Cohesion: 0.12
Nodes (14): criaDespacho(), executa, server, sessao, basicas, checaImpressora(), docsApi(), toolsExtra (+6 more)

### Community 48 - "prefs.ts"
Cohesion: 0.19
Nodes (14): Armazem, em(), lePrefs(), normaliza(), PADRAO, Prefs, TECLA_F, aoMudarSistema() (+6 more)

### Community 49 - "Documento"
Cohesion: 0.16
Nodes (4): criaProjeto(), Comando, Documento, Sessao

### Community 50 - "include"
Cohesion: 0.11
Nodes (18): **/dist, DOM, node_modules, packages/app/vite.config.ts, packages/*/filaments, packages/*/printers, packages/*/src, packages/*/test (+10 more)

### Community 51 - "6. Funcionalidades em detalhe"
Cohesion: 0.11
Nodes (18): 6.10 Impressão [F3], 6.11 Importar [F3], 6.12 Calibração [F6], 6.13 Perfis genéricos de impressora [F6], 6.14 Aparência e materiais [F2], 6.15 Undo, histórico e erros [F0–F2], 6.16 Modo customizar [F3], 6.17 Ajuda e descoberta [F1+] (+10 more)

### Community 52 - "Feature"
Cohesion: 0.23
Nodes (12): DocArvore, LinhaArvore, linhasArvore(), proximoMarcador(), DadosSolido, PedidoPainel, dados, feats (+4 more)

### Community 53 - "regen/index.ts"
Cohesion: 0.18
Nodes (12): criaGeometria(), DEBOUNCE_MS, Ok, Pend, reg, w, CorpoBuf, Pedido (+4 more)

### Community 54 - "features/tipos.ts"
Cohesion: 0.24
Nodes (14): Base, FBooleana, FCorte, FEspelho, FExtrude, FPadrao, FPrimitiva, FRevolve (+6 more)

### Community 55 - "features-perfis.test.ts"
Cohesion: 0.12
Nodes (8): Ctx, criaLixo(), Lixo, ctxNovo(), ctxCom(), ctxCom(), PLANO, ctxCom()

### Community 56 - "app/package.json"
Cohesion: 0.12
Nodes (16): dependencies, @3dm/core, @fontsource/roboto, three, @3dm/core, @fontsource/roboto, license, name (+8 more)

### Community 57 - "Projeto"
Cohesion: 0.18
Nodes (5): criaOrientacaoUi(), DepsOrientacao, criaPaineis(), Projeto, secao()

### Community 58 - "features/perfis.ts"
Cohesion: 0.24
Nodes (13): distanciaAte(), executaExtrude(), executaRevolve(), normaliza(), perfisDe(), CrossSection, Manifold, cruz() (+5 more)

### Community 59 - "svg.ts"
Cohesion: 0.20
Nodes (16): arco(), atributos(), caminho(), comp(), comprimento(), cubica(), elipse(), FATOR (+8 more)

### Community 60 - "Vista"
Cohesion: 0.21
Nodes (6): Alvos, instalaAtalhos(), criaLinha(), Sessao, Ligacao, Vista

### Community 61 - "V3"
Cohesion: 0.22
Nodes (11): V3, AlvoT, criaTransformacaoSolido(), Efeito, Eixo, IDX, Letra, MouseT (+3 more)

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

### Community 66 - "Regenerador"
Cohesion: 0.22
Nodes (9): aplica(), chaveDe(), cyrb53(), liberaEntrada(), mensagem(), Regenerador, comRegen(), corposDe() (+1 more)

### Community 67 - "sketch-snap.test.ts"
Cohesion: 0.15
Nodes (5): OpcoesSnap, TipoSnap, base, P(), ptoAng()

### Community 68 - "compilerOptions"
Cohesion: 0.14
Nodes (13): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, isolatedModules, module, moduleResolution, noEmit, noUncheckedSideEffectImports (+5 more)

### Community 69 - "Relatório F2 — Sólidos"
Cohesion: 0.15
Nodes (12): Como o app importa (navegador), Como o orquestrador valida (sem mouse), Contrato (para a rodada 2), Decisões / riscos, Medições (Node, peça de 12 itens: caixa, casca, 4 furos, 2 pinos, padrão, espelho, união), Pendências e riscos novos, Relatório F2 — Sólidos, Rodada 1 (core: F2-01, F2-02, F2-03, matemática da F2-07) (+4 more)

### Community 70 - "linha-aliases.test.ts"
Cohesion: 0.26
Nodes (9): aplicaAliases(), CHAVE_ALIASES, DefAlias, leAliases(), parseAliases(), resolveDefs(), salvaAliases(), serializaAliases() (+1 more)

### Community 71 - "vista.ts"
Cohesion: 0.31
Nodes (10): acaoDoMouse(), AcaoMouse, AcaoTecla, passoGrade(), Preset, teclaNumpad(), Vec3, criaVista() (+2 more)

### Community 72 - "kernel/index.ts"
Cohesion: 0.24
Nodes (7): extrudeComBorda(), recuo(), BordaExtrude, ErroFeature, quadrado(), retangulo(), roda()

### Community 73 - "tools-extra2.test.ts"
Cohesion: 0.24
Nodes (10): adicionaFeature(), toolsExtra2, toolsModelo, caixa(), chama(), extra(), modelo(), pasta() (+2 more)

### Community 74 - "include"
Cohesion: 0.15
Nodes (12): compilerOptions, lib, types, extends, include, ES2022, node, ../../tsconfig.base.json (+4 more)

### Community 75 - "Relatório F1 — Sketch 2D"
Cohesion: 0.17
Nodes (11): Checklist de browser — rodada 2, Checklist de verificação no navegador (orquestrador), Comandos de verificação, Critérios F1 (§1.2) → verificação, Decisões, Decisões e pendências da rodada 2, Pendências e riscos, Relatório F1 — Sketch 2D (+3 more)

### Community 76 - "expor.ts"
Cohesion: 0.33
Nodes (8): criaExpor(), msg(), numOuUndef(), textoErro(), ErroOpcoes, parseOpcoes(), exporParametro(), removerExposto()

### Community 77 - "captura.ts"
Cohesion: 0.24
Nodes (8): direcaoDaVista(), DIRECOES, isoDir, isoUp, metadeOrtografica(), NomeVista, Vec3, VISTAS

### Community 78 - "features-doc.test.ts"
Cohesion: 0.27
Nodes (9): entradaDe(), planoDoSketch(), docCom(), furo, ln(), pt(), regenera(), sketch() (+1 more)

### Community 79 - "Relatório F0 — Fundação"
Cohesion: 0.20
Nodes (9): Checklist de verificação no navegador (orquestrador), Decisões, Mapa dos critérios F0 "A" (§1.2) → check, Pendências e riscos, Pontos de extensão para as próximas ondas, Relatório F0 — Fundação, Rodada 2, Tarefas (+1 more)

### Community 80 - "dyn.ts"
Cohesion: 0.29
Nodes (4): criaDyn(), Dyn, medidasDyn(), textoDyn()

### Community 81 - "sketch-editores.test.ts"
Cohesion: 0.22
Nodes (3): EDITORES, de(), temPonto()

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

### Community 87 - "ponte-stdio.test.ts"
Cohesion: 0.25
Nodes (6): Cliente, Conteudo, dorme(), espera(), Resposta, SERVIDOR

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
Cohesion: 0.46
Nodes (6): criaBarra(), TECLA, alterna(), estadoInicial(), Modo, ORDEM

### Community 93 - "sketch.ts"
Cohesion: 0.29
Nodes (5): FERRAMENTAS, TODOS_COMANDOS_SKETCH, DESENHO, RESTRICOES, LetraRestricao

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

### Community 103 - "importar-svg.test.ts"
Cohesion: 0.29
Nodes (3): docExtrudado(), PLANO, Pt

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

### Community 109 - "instala.ts"
Cohesion: 0.60
Nodes (5): criaCapturador(), tokenDoHash(), guarda(), instalaPonte(), lembrado()

### Community 110 - "tools-f3b.test.ts"
Cohesion: 0.47
Nodes (4): toolsF3b, caixa(), pasta(), vazia()

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

### Community 118 - "mensagens.ts"
Cohesion: 0.67
Nodes (3): dims(), MSG, n1()

## Knowledge Gaps
- **597 isolated node(s):** `name`, `private`, `type`, `license`, `packages/*` (+592 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `T` connect `textos.ts` to `criaSessaoSketch`, `editores.ts`, `esquemas.ts`, `parametros-ui.ts`, `sketch/sessao.ts`, `medir-modelo.ts`, `arquivos.ts`, `ferramentas-b.ts`, `main.ts`, `modo.ts`, `ferramentas-a.ts`, `desenho.ts`, `el`, `solido.ts`, `imprimir/painel.ts`, `Feature`, `regen/index.ts`, `Projeto`, `V3`, `expor.ts`, `dyn.ts`, `sketch-editores.test.ts`, `src/barra.ts`, `sketch.ts`, `instala.ts`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `Documento` connect `Documento` to `criaSessaoSketch`, `parametros-ui.ts`, `sketch/sessao.ts`, `arquivos.ts`, `tools-modelo.ts`, `malha/index.ts`, `tools-solido.ts`, `modo.ts`, `features/doc.ts`, `tools-f3b.ts`, `solido.ts`, `ponte/cliente.ts`, `imprimir/painel.ts`, `export-montar.test.ts`, `src/ponte.ts`, `doc/index.ts`, `regen/index.ts`, `Projeto`, `texto-texto.test.ts`, `features-doc.test.ts`, `importar-svg.test.ts`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `SketchFeature` connect `sketch/tipos.ts` to `criaSessaoSketch`, `editores.ts`, `sketch-snap.test.ts`, `sketch/sessao.ts`, `dist`, `ferramentas-b.ts`, `features-doc.test.ts`, `edicao2.ts`, `doc/index.ts`, `sketch-editores.test.ts`, `Feature`, `sketch-ponte.test.ts`, `desenho.ts`, `sketch/index.ts`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `criaSolido()` (e.g. with `.corposFinos()` and `.escreve()`) actually correct?**
  _`criaSolido()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _597 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `criaSessaoSketch` be split into smaller, more focused modules?**
  _Cohesion score 0.05086071987480438 - nodes in this community are weakly interconnected._
- **Should `editores.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0763888888888889 - nodes in this community are weakly interconnected._