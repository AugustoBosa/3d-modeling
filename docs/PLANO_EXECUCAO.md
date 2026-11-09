# 3d-modeling — Plano de Execução do MVP (F0–F4)

| | |
|---|---|
| **Base** | `docs/PROJETO_BASE.md` v0.4 (decisões D1–D31). Não reabrir decisões. |
| **Data** | 2026-11-08 |
| **Execução** | Workflow multiagente (§0). Estado vivo em `docs/orq/STATUS.md`. |
| **Regra de git** | `git init` local, **sem commit e sem push** (regra do usuário). Checkpoint = `git add -A` após cada onda validada. |

---

## 0. Como o trabalho roda (workflow multiagente)

### 0.1 Papéis

| Papel | Modelo | Faz | Não faz |
|---|---|---|---|
| **Orquestrador** | Opus 5.5 (sessão principal) | Escreve este plano, passa um *brief* para cada manager, valida a entrega contra o DoD (§1), devolve correções, faz o checkpoint | Não escreve código de feature |
| **Manager** | Sonnet 5.5, effort médio | Quebra o escopo em tarefas de worker, despacha workers em paralelo quando os arquivos não se cruzam, revisa (build + testes), corrige pequenos ajustes, reporta | Não mexe em arquivo fora da sua posse (§0.4) |
| **Worker** | Haiku 5.5, auto-compact em 40% | Executa **uma** tarefa pequena (1–3 arquivos) e deixa **um** check executável | Não decide arquitetura; não instala dependência fora da lista do brief |

### 0.2 Ondas e dependências

```
Onda A:  [SPK spikes R1/R2/R4] ∥ [F0 fundação]
              │                     │
Onda B:  [F1 sketch] ∥ [F3a export core]          (F1 promove o solver do SPK; F3a promove o 3MF do SPK)
              │              │
Onda C:  [F2 sólidos] ∥ [F4a MCP infra]
              │              │
Onda D:  [F3b impressão UI] ∥ [F4b MCP tools + integração]
              │
Fim:     validação final do MVP pelo orquestrador (DoD global + DoD por fase)
```

Uma onda só começa depois que o orquestrador aprova a anterior contra o DoD. Managers da mesma onda rodam em paralelo.

### 0.3 Protocolo

**Brief (orquestrador → manager):** id do manager, seção deste plano, arquivos que possui, dependências já entregues, DoD da entrega e formato do relatório.

**Tarefa (manager → worker):** um prompt autocontido com:
1. objetivo em uma frase;
2. arquivos a criar ou editar (caminho exato) e assinaturas esperadas;
3. trechos relevantes do `PROJETO_BASE.md` (citados, não "leia tudo");
4. **check executável** (`node --test …`, `npm run build`, script) e o resultado esperado;
5. regras de código (§0.5).

**Relatório (manager → orquestrador):** gravado em `docs/orq/relatorio-<manager>.md` e resumido na resposta em ≤ 250 palavras:
- tabela tarefa → ✅/❌ → check usado;
- comandos de verificação e saída resumida;
- o que ficou pendente e por quê;
- riscos novos.

**Loop:** o orquestrador roda os checks do DoD. Se algo falhar, manda a correção ao mesmo manager (mesmo contexto). Repete até passar.

### 0.4 Posse de arquivos (evita conflito entre workers paralelos)

| Manager | Possui |
|---|---|
| SPK | `spikes/**` |
| F0 | arquivos da raiz, `.githooks/**`, `.github/**`, `packages/core/src/doc/**`, `packages/core/printers/**`, `packages/core/filaments/**`, `packages/app/**` (casca) |
| F1 | `packages/core/src/expr/**`, `packages/core/src/sketch/**`, `packages/app/src/sketch/**`, `packages/app/src/teclado/**`, `packages/app/src/comandos/**` |
| F3a | `packages/core/src/malha/**`, `packages/core/src/export/**`, `packages/core/src/imprimir/**` |
| F2 | `packages/core/src/kernel/**`, `packages/core/src/features/**`, `packages/core/src/regen/**`, `packages/app/src/features/**`, `packages/app/src/worker/**`, `examples/**` |
| F4a / F4b | `packages/mcp/**`, `packages/app/src/ponte/**` |
| F3b | `packages/app/src/imprimir/**`, `packages/app/src/customizar/**`, `packages/core/src/importar/**`, `packages/core/src/texto/**` |

Arquivos compartilhados (`packages/app/src/main.ts`, `packages/app/src/textos.ts`, `package.json` de cada pacote, `THIRD_PARTY.md`): **só o manager edita**, nunca dois workers ao mesmo tempo. `npm install` só pelo manager.

### 0.5 Regras de código (valem para todo worker)

- TypeScript strict, ES2022, `moduleResolution: bundler`, **`erasableSyntaxOnly`** (sem `enum`, sem *parameter properties*), imports relativos com extensão `.ts`. Assim o Node 25 roda os `.ts` direto e `node --test` não precisa de `tsx`.
- `packages/core` **sem DOM**. Roda no worker do navegador e no Node.
- Sem framework de UI, de estado ou de testes. Testes com `node --test`.
- Menor código que funciona (ponytail): stdlib e recurso nativo antes de dependência; sem abstração com uma implementação só.
- Mudança cirúrgica (karpathy): só toca o que a tarefa pede.
- Todo texto de UI vai para `packages/app/src/textos.ts` (pt-BR).
- Dependências permitidas no MVP: `three`, `manifold-3d`, `fflate`, `earcut`, `opentype.js`, `@modelcontextprotocol/sdk`, `ws`; dev: `vite`, `typescript`, `@types/*`. Outra = pedir ao manager.
- Licença: só copiar MIT/Apache/BSD/ISC; GPL/AGPL nunca (PROJETO_BASE §9).

---

## 1. DoD desta execução

O DoD vem da §12 do `PROJETO_BASE.md`. Cada item tem um dono:
- **A** = o workflow verifica sozinho.
- **H** = depende do usuário (publicar, imprimir, abrir no slicer, login). Fica na lista de pendências (§5), não bloqueia o loop.

### 1.1 DoD global (toda onda)

| # | Critério | Dono | Como o orquestrador verifica |
|---|---|---|---|
| G1 | `npm run build` passa (tsc strict + vite build) | A | Rodar na raiz |
| G2 | `npm test` passa (core + hashes de referência + `fechada()` nos exemplos) | A | Rodar na raiz |
| G3 | CI roda testes antes do deploy | A (arquivo) · H (execução real) | Ler `.github/workflows/pages.yml` |
| G4 | Hook do graphify funciona | A | Commit de teste num clone temporário na scratchpad |
| G5 | Navegador: fluxo da onda ponta a ponta no desktop; 375 px abre e orbita | A | Browser pane em `npm run dev` / `vite preview` |
| G6 | Orçamentos §10 não pioraram | A | Tamanho de `dist` gzip ≤ 1,5 MB; HUD |
| G7 | Toda ação nova da UI tem tool MCP ou pendência em `docs/orq/paridade-mcp.md` | A | Ler o arquivo |
| G8 | `RETOMAR.md` e `docs/orq/STATUS.md` atualizados | A | Ler |
| G9 | `THIRD_PARTY.md` atualizado; nenhuma licença fora da regra | A | Ler `package.json` × `THIRD_PARTY.md` |
| G10 | Sem commit e sem push | A | `git log` vazio |

### 1.2 DoD por fase

| Fase | Critério (de §12.2) | Dono |
|---|---|---|
| F0 | Abre em < 2 s (local, `vite preview`) | A |
| F0 | Site publicado no Pages | **H** (precisa criar o repo e dar push) |
| F0 | Grid e volume das 2 impressoras corretos (210×210×205 e 256×256×256) | A |
| F0 | Home, numpad 1/3/7/5 e gizmo funcionam | A |
| F0 | Ctrl+Z/Y funciona num comando-teste | A |
| F0 | Recarregar recupera o projeto (IndexedDB) | A |
| F0 | Hook do graphify roda num commit de teste | A |
| F0 | Tema claro/escuro alterna e respeita `prefers-color-scheme` | A |
| F0 | Preset AutoCAD troca o pan para o botão do meio | A |
| F0 | Nenhum texto de UI fora de `textos.ts` | A |
| F1 | `REC` + `@80,50` desenha 80×50; `DIM` e mudar para `=L` | A |
| F1 | Sketch fica verde quando totalmente definido | A |
| F1 | H/V/I/T/E/B/D por letra; `TR`/`EX`/`DI` com seleção viram comando sem deixar restrição | A (teste automático do despachante de teclas) |
| F1 | Regra §7.3 sem conflito com REC, RO, SC, G/R/S+eixo | A (teste) · **H** (uso real, D25) |
| F1 | TR/EX/O/F funcionam | A |
| F1 | Solver: 200 entidades ≤ 16 ms; 20 sketches de referência convergem | A |
| F2 | "Caixa com tampa" 100% paramétrica; mudar `L` regenera ≤ 300 ms | A |
| F2 | Feature com erro fica vermelha sem quebrar as anteriores | A |
| F2 | G/R/S + eixo + número | A |
| F2 | Medir com precisão de 0,01 mm | A |
| F3 | 3MF P2S abre no Bambu Studio com a P2S; 3MF Mega S abre no PrusaSlicer com o perfil | **H** (slicers não instalados nesta máquina) · A = estrutura do zip, XML e chaves conferidas contra a fonte |
| F3 | STL abre em qualquer slicer | A (estrutura binária + `fechada()`) · H (abrir) |
| F3 | Export bloqueia malha aberta; peça maior que o volume mostra erro; modo overhang | A |
| F3 | Peça real impressa em cada impressora (±0,2 mm) | **H** |
| F3 | Trocar filamento muda massa e avisos (TPU na Mega S, ABS em impressora aberta) | A |
| F3 | 2 corpos em slots diferentes → cores e slots certos no 3MF | A (chaves no XML/JSON) · H (abrir no Bambu Studio) |
| F3 | Modo customizar abre por link, muda parâmetro e exporta, inclusive em 375 px | A |
| F4 | Prompt no Claude Code gera o modelo ao vivo e o 3MF | **H** (CLI sem login nesta máquina) · A = cliente MCP via SDK simula o Claude Code |
| F4 | Headless gera o mesmo 3MF (hash idêntico ao da web) | A |
| F4 | Conexão sem token é recusada | A |

---

## 2. Tarefas por manager

Formato: **ID — entrega** · arquivos · check. Os managers podem dividir uma tarefa em várias de worker.

### SPK — Spikes de risco (onda A)

- **SPK-1 Solver (R1)** — protótipo LM/Gauss-Newton denso, sem dependência · `spikes/solver/` · `node --test spikes/solver/` com 20 sketches de referência + medição de 200 entidades (meta ≤ 16 ms/iteração) + detecção de conflito e de "totalmente definido" (contagem de graus de liberdade / posto do jacobiano). Saída: `spikes/solver/RESULTADO.md` com GO/NO-GO e números.
- **SPK-2 3MF (R2)** — writer com `fflate`: 3MF core + sabor Prusa (`Metadata/Slic3r_PE.config`, `Slic3r_PE_model.config`) + sabor Bambu/Orca (`Metadata/project_settings.config` JSON com `printer_model`, `filament_colour`; `Metadata/model_settings.config` com `extruder` por objeto). Chaves conferidas na fonte (PrusaSlicer `3mf.cpp`, artigo "Inside a Bambu/Orca 3MF", perfis Orca da P2S) · `spikes/3mf/` · gera `spikes/3mf/out/{mega-s,p2s-2cores}.3mf`, check de zip + XML bem formado + chaves presentes. Saída: `spikes/3mf/RESULTADO.md` com fontes e o que precisa do teste manual.
- **SPK-3 WebSocket local (R4)** — servidor `ws` em `127.0.0.1:47800` com token no handshake; recusa sem token · `spikes/ws/` · `node spikes/ws/teste.mjs` (cliente com e sem token). O orquestrador testa a conexão vinda de uma página **https** no browser pane.

### F0 — Fundação (onda A)

- **F0-01 Monorepo** — `package.json` raiz (workspaces `packages/*`; scripts `dev`, `build`, `test`, `setup`), `tsconfig.base.json` (§0.5), `.gitignore` (regra graphify §16.1), `LICENSE` MIT, `THIRD_PARTY.md`, `CLAUDE.md` (§16.2), `README.md` curto, `git init` · check: `npm install && npm run build && npm test`.
- **F0-02 Hook graphify** — `.githooks/pre-commit` (`PYTHONHASHSEED=0 graphify update . --force` + `git add graphify-out/graph.json graphify-out/GRAPH_REPORT.md`), `npm run setup` (`git config core.hooksPath .githooks`) · check: clone temporário + commit de teste gera o grafo.
- **F0-03 CI** — `.github/workflows/pages.yml`: Node 22, `npm ci` → `npm test` → `npm run build` → `deploy-pages@v4`, `base ./` · check: leitura + mesmos comandos local.
- **F0-04 Documento + comandos** — `packages/core/src/doc/`: tipos do `.3dm.json` v1 (§5.2), validador de schema escrito à mão, `Comando {fazer, desfazer}`, pilha undo/redo · check: `node --test packages/core/test/doc.test.ts`.
- **F0-05 Perfis** — `packages/core/printers/{anycubic-i3-mega-s,bambu-p2s}.json`, `packages/core/filaments/{pla,petg,tpu,abs-asa}.json` (§3.3–3.4) + loader · check: teste confere volumes e densidades.
- **F0-06 Casca do app** — `packages/app/` Vite: `index.html`, `tokens.css` (escuro padrão + claro, `prefers-color-scheme`, alternância salva no localStorage), `layout.css` (3 colunas ≥ 1100; 1 coluna < 1100; < 700 só visualização), `textos.ts`, helpers de UI extraídos do `main.ts` do terrain (`ui.ts`) · check: build + captura desktop e 375 px.
- **F0-07 Viewport** — porta `vista.ts` do terrain: Z para cima, grid 1/10 mm adaptativo, volume da impressora em wireframe + mesa, gizmo, Home, numpad 1/3/7/5/Ctrl, preset de navegação Blender (padrão) e AutoCAD nas Preferências, ícones `esferas.ts` · check: browser.
- **F0-08 Linha de comando + barra de status** — casca da linha (Enter/Espaço executa, vazio repete, Esc cancela, histórico de 3 linhas, F2 expande, autocompletar), registro `alias → comando`, um comando-teste com undo, Ctrl+Z/Y; barra de status com F3/F7/F8/F9/F10/F11/F12 (F8 e F10 exclusivos), X/Y do cursor, HUD em ms · check: browser + teste do registro.
- **F0-09 Persistência** — autosave IndexedDB (debounce 1 s), recarregar recupera; salvar/abrir `.3dm.json` · check: browser (recarregar).
- **F0-10 Seletor de impressora** — barra superior troca o perfil e o volume · check: browser.

### F1 — Sketch 2D (onda B)

- **F1-01 Expressões** — `packages/core/src/expr/`: parser sem `eval` (`+ − * / ( )`, `min max round floor ceil sqrt sin cos tan` em graus, `pi`, parâmetros), detecção de ciclo · check: testes.
- **F1-02 Solver** — promove o SPK-1 para `packages/core/src/sketch/solver.ts`; estados subdefinido / definido / conflito · check: 20 sketches + 200 entidades ≤ 16 ms.
- **F1-03 Entidades e perfis** — modelo de pontos/linhas/arcos/círculos; detecção de regiões fechadas, pontas soltas e autointerseção; saída em polígonos para o `CrossSection` · check: testes.
- **F1-04 Teclado e coordenadas** — `packages/app/src/teclado/`: despachante puro da regra §7.3 (G/R/S, restrições 2b, letras → comando) + parser de coordenadas (`x,y`, `@dx,dy`, `@d<ang`, distância direta) · check: teste de regressão de **cada linha da tabela de conflitos §7.5**.
- **F1-05 Ferramentas de desenho** — Tab entra/sai, planos XY/XZ/YZ/offset, alinhar vista; `L PL REC C A POL SLOT PO XL` com prompts e opções entre colchetes · check: browser.
- **F1-06 Auxílios de precisão** — OSNAP (extremidade, médio, centro, quadrante, interseção, perpendicular, tangente, mais próximo), ORTHO (Shift inverte), GRID/SNAP, POLAR, DYN, OTRACK simples · check: browser.
- **F1-07 Edição** — `TR EX O F CHA M CO RO SC MI AR E/Del/X Q` · check: testes de geometria + browser.
- **F1-08 Restrições** — barra, letra sozinha (D31) com desfazer ao vir outra letra, inferência ao desenhar com Shift suprimindo, cor de estado · check: browser + teste do despachante.
- **F1-09 Cotas** — `DIM` inteligente, edição inline com expressão e `=L`, acionadora vs referência, cotas temporárias estilo Revit com cadeado (porta `cotas.ts`) · check: browser.
- **F1-10 Seleção** — clique/Shift, janela vs cruzamento, pré-seleção, A/Alt+A, Esc, H/Alt+H/Shift+H fora do sketch · check: browser.

### F3a — Export core (onda B, paralelo à F1)

- **F3a-01 Malha** — `fechada()` e `stl()` portados do `bloco.ts` do terrain; bbox, volume, área · check: testes.
- **F3a-02 3MF** — promove o SPK-2: core + Prusa + Bambu/Orca + cor e slot AMS por corpo + gancho de miniatura · check: testes de estrutura e chaves.
- **F3a-03 Verificação de imprimibilidade** — malha fechada, cabe no volume, overhang por limiar, detalhe mínimo, área de apoio · check: testes.
- **F3a-04 Filamento** — massa pela densidade; avisos de compatibilidade (TPU na Mega S, ABS/ASA em impressora aberta) · check: testes.

### F2 — Sólidos (onda C)

- **F2-01 Kernel** — wrapper do manifold (init em Node e navegador), perfis do sketch → `CrossSection`, lista `lixo` · check: teste em Node.
- **F2-02 Features** — extrude (distância, simétrica, duas, taper), revolve, booleanas, primitivas, shell prismático, furo (simples/escareado/rebaixado, M2–M8, inserto), padrão linear/circular, espelho, corte por plano, transformação · check: volume e bbox por feature.
- **F2-03 Regeneração** — cache por feature (hash das entradas), recomeça na primeira alterada, feature com erro fica vermelha e as seguintes suspensas, marcador de histórico · check: testes.
- **F2-04 Worker** — porta `cliente.ts` + `gera.worker.ts` (fila com cancelamento), debounce 60 ms, HUD · check: browser.
- **F2-05 UI** — árvore de features (esquerda), propriedades Tipo/Instância (direita), tabela de parâmetros, painéis de feature com prévia ao vivo, Enter/Esc · check: browser.
- **F2-06 G/R/S** — eixo, número, Ctrl snap, Shift+D, gizmo `W` · check: teste do despachante + browser.
- **F2-07 Medir e cotas 3D** — `DI`/`MEA`, cotas 3D e bbox (porta `cotas.ts`) · check: precisão 0,01 mm em teste.
- **F2-08 Exemplo** — `examples/caixa-com-tampa.3dm.json` + `packages/core/test/ref_hashes.json` + teste: mudar `L` regenera ≤ 300 ms e fica fechada · check: `npm test`.

### F4a — MCP infraestrutura (onda C, paralelo à F2)

- **F4a-01 Pacote** — `packages/mcp` (`3d-modeling-mcp`, `bin`), servidor stdio com `@modelcontextprotocol/sdk` · check: cliente SDK lista as tools.
- **F4a-02 Ponte WS** — promove o SPK-3: `127.0.0.1:47800` (`MODELING_MCP_PORT`), token por sessão, recusa sem token. **Decisão R4 (onda A):** o mesmo servidor também serve o build do app por HTTP em `http://127.0.0.1:47800/` (mesma porta, upgrade para WS), e `open_app` abre `http://127.0.0.1:47800/#token=…`. Motivo: o Chromium bloqueia `ws://127.0.0.1` vindo de página https pública (Local Network Access) e libera vindo de origem local. O site do Pages continua tentando a ponte (funciona no Chrome se o usuário aceitar o prompt de rede local — H7) · check: teste.
- **F4a-03 Headless** — mesmo core em Node; grava `.3dm.json`, STL e 3MF (padrão do `cli.ts` do terrain) · check: teste.
- **F4a-04 Cliente da ponte no app** — `packages/app/src/ponte/`: conecta com token (`#token=` ou colado), aplica comandos pela mesma pilha de undo, devolve estado · check: browser.
- **F4a-05 Recursos** — `docs://api`, `printers://lista`, `projeto://atual` · check: cliente SDK.

### F3b — Impressão na UI (onda D)

- **F3b-01 Painel Imprimir** — impressora + filamento, lista de checagens, export STL/3MF, bloqueio de malha aberta com "exportar mesmo assim", nome `<projeto>-<corpo>-<impressora>`, Cancelar · check: browser.
- **F3b-02 Orientação** — modo overhang (porta "inclinação"), `LF` apoiar na face, soltar na mesa, centralizar · check: browser.
- **F3b-03 Cor e AMS** — cor por corpo + tabela de slots no navegador do projeto · check: browser + chave no 3MF.
- **F3b-04 Miniatura** — PNG da vista iso no 3MF · check: arquivo presente no zip.
- **F3b-05 Importar** — STL/3MF/OBJ como corpo de referência; SVG → sketch · check: teste + browser.
- **F3b-06 Texto 3D** — `TEXT` com opentype.js · check: teste de volume.
- **F3b-07 Modo customizar** — parâmetros expostos, `#customizar&projeto=<https>` com aviso de origem e validação por schema, valores na URL, 375 px · check: browser desktop + 375 px.

### F4b — Tools MCP e integração (onda D)

- **F4b-01 Tools** — as ~20 tools da §5.7 nos dois modos, mais `parametros_expostos` · check: cliente SDK chama cada uma.
- **F4b-02 Captura** — PNG no modo ponte; SVG (porta `esquema.ts`) no headless (R6) · check: arquivo gerado.
- **F4b-03 Integração** — script chama as tools no headless → 3MF; hash igual ao export da web para o mesmo documento · check: `npm test`.
- **F4b-04 Paridade** — `docs/orq/paridade-mcp.md`: cada ação da UI → tool ou pendência · check: leitura.

---

## 3. Módulos do `modular_terrain_system` (copiar, não depender)

| Origem (`modular_terrain_system/web/`) | Destino | Tarefa |
|---|---|---|
| `index.html` `<style>` | `packages/app/src/tokens.css` + `layout.css` | F0-06 |
| `src/main.ts` → `controle, grupo, secao, segmentos, campo, cartao, previa` | `packages/app/src/ui.ts` | F0-06 |
| `src/vista.ts` | `packages/app/src/viewport/vista.ts` | F0-07 |
| `src/esferas.ts` | `packages/app/src/viewport/esferas.ts` | F0-07 |
| `src/cotas.ts` | `packages/app/src/viewport/cotas.ts` | F1-09 / F2-07 |
| `src/cliente.ts` + `src/gera.worker.ts` | `packages/app/src/worker/` | F2-04 |
| `src/bloco.ts` → `fechada()`, `stl()` | `packages/core/src/malha/` | F3a-01 |
| `ref_hashes.json` + `check_paredes.ts` | `packages/core/test/` (padrão) | F2-08 |
| `cli.ts` | `packages/mcp/src/headless.ts` (padrão) | F4a-03 |
| `src/esquema.ts` | `packages/mcp/src/captura-svg.ts` | F4b-02 (folhas completas ficam na F5) |
| `.github/workflows/pages.yml` | `.github/workflows/pages.yml` + passo de teste | F0-03 |

---

## 4. Repositório, Pages e graphify

1. `git init` local na F0-01. Sem commit.
2. Hook versionado em `.githooks/`, ativado por `npm run setup` (F0-02).
3. `.gitignore` com `graphify-out/*` + `!graphify-out/graph.json` + `!graphify-out/GRAPH_REPORT.md`.
4. `pages.yml` pronto (F0-03), mas **o repo `AugustoBosa/3d-modeling` no GitHub e o push ficam com o usuário** (§5).

---

## 5. Pendências do usuário (H)

| # | O quê | Quando |
|---|---|---|
| H1 | Criar o repo `AugustoBosa/3d-modeling` (público), primeiro commit e push; ativar Pages (source: GitHub Actions) | Quando quiser publicar |
| H2 | Abrir os 3MF de `spikes/3mf/out/` e do export no Bambu Studio (P2S) e no PrusaSlicer (Mega S) | Depois da F3a |
| H3 | Imprimir uma peça de verificação em cada impressora e medir (±0,2 mm) | Depois da F3b |
| H4 | Testar o teclado §7.3 no uso real (D25) | Depois da F1 |
| H5 | `claude auth login` no terminal (o CLI está sem login) e testar o prompt da caixa no Claude Code com o MCP | Depois da F4b |
| H6 | Q18: aliases do `acad.pgp` | Quando puder |
| H7 | No Chrome de verdade, abrir o site do Pages com o MCP rodando e aceitar o prompt "acessar dispositivos da rede local" (R4) | Depois de H1 e da F4b |
