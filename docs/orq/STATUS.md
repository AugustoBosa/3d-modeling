# Status da orquestração

Plano: `docs/PLANO_EXECUCAO.md`. Atualizado pelo orquestrador a cada onda.

## Configuração do workflow

- Orquestrador: Opus 5.5 (sessão principal).
- Managers: Agent tool, `model: sonnet`, `effort: medium`, `general-purpose`.
- Workers: Agent tool chamado pelo manager, `model: haiku`.
- Auto-compact 40%: `.claude/settings.local.json` → `env.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=40`. A variável é global da sessão (não existe ajuste em % por agente na v2.1.282).
- Workers via `claude -p` foram descartados: o CLI está sem login nesta máquina (pendência H5).

## Ondas

| Onda | Managers | Estado |
|---|---|---|
| A | SPK, F0 | ✅ validada |
| B | F1, F3a | ✅ validada (F1 em 2 rodadas) |
| C | F2, F4a | ✅ validada (F2 em 3 rodadas). Checkpoint: `git add` de tudo exceto `packages/mcp` |
| D | F3b, F4b | ✅ validada (F3b; F4b em 3 rodadas) |
| Final | — | ✅ DoD automático (G1–G10 e critérios A da §1.2) cumprido em 2026-11-09. Restam só os itens H (usuário) |

## Incidentes

- 2026-11-08 ~22h: F1 e F2 pararam por limite de uso de 5 h da API (HTTP 429). Retomados após o reset com o mesmo contexto (SendMessage), com no máximo 2 workers simultâneos por manager para poupar cota.

- 2026-11-09 ~03h: F2 (rodada 3) e F4b (rodada 1) pararam no 2º limite de 5 h. Retomados às 09h26.

## Validações do orquestrador

### Publicação (2026-11-09) ✅

- Commits `00c5f0b` (MVP) e `edcb393` (CI). Repo público https://github.com/AugustoBosa/3d-modeling; Pages com fonte GitHub Actions.
- 1º deploy barrado no `npm test`: melhor de 15 do solver deu 18,97 ms no runner do GitHub (aqui 6 ms). Metas de 16 ms ganharam folga de 3× só com `CI` definido. 2º deploy: testes, build e deploy ✅.
- Site publicado: abre com 2 corpos em 1,28 s sem cache (meta < 2 s), console sem erros ✅; 375 px com `#customizar&L=100` → peça 100×50×30, sem rolagem horizontal, 3MF com miniatura ✅.
- Detalhe: trocar só o `#` numa aba já aberta no site não recarrega, então o link de customizar só vale ao abrir a página.

### Validação final do MVP (2026-11-09) ✅

| # | Resultado |
|---|---|
| G1 | `npm run build` ✅ |
| G2 | `npm test` 768/768 ✅ |
| G3 | `.github/workflows/pages.yml` roda `npm test` e `npm run build` antes do deploy ✅ (execução real = H1) |
| G4 | Hook do graphify num repo descartável: commit incluiu `graph.json` + `GRAPH_REPORT.md` ✅; `core.hooksPath` ligado aqui |
| G5 | `vite preview`: desktop abre com 2 corpos em 236 ms, console sem erros; 375 px sem rolagem horizontal, vista no topo (375×341), canvas com `touch-action: none` ✅ |
| G6 | Bundle gzip total 575 kB (meta ≤ 1,5 MB); solver melhor 6–12 ms (meta 16); regen ao mudar `L` 3 ms (meta 300) ✅ |
| G7 | `paridade-mcp.md`: 45 tools; lacunas restantes só com motivo registrado ✅ |
| G8 | `RETOMAR.md` e este arquivo atualizados ✅ |
| G9 | 13 dependências no THIRD_PARTY, nenhuma GPL/AGPL ✅ |
| G10 | `git log`: nenhum commit ✅ (tudo em `git add`) |

### Onda D — F4b rodada 3, tools das funções do F3b (2026-11-09) ✅

- Manager: 2 workers Haiku; 5 tools novas (`filamento_definir`, `slots_definir`, `apoiar_na_face`, `importar_svg`, `texto_3d`), 45 no total; `parametros_expostos` já expunha/removia. `npm test` 768/768.
- Sonda do orquestrador **em modo ponte** (o manager só testou headless): PETG → 152,4 g para 120 cm³ (densidade 1,27) ✅; `texto_3d "ABC"` vira corpo ✅; `apoiar_na_face [1,0,0]` deixa a caixa 30×50×80, centrada na mesa ✅; `importar_svg` de texto → sketch com 1 perfil ✅; erros com causa + correção: filamento `xyz` (lista os ids), normal sem face (lista normais e áreas), `../../../Windows/win.ini` (fora da pasta) ✅; aba recebeu as 5 features e o filamento ✅; captura PNG mostra caixa em pé e "ABC" legível ✅.
- Correção do orquestrador em `paridade-mcp.md`: o gizmo `W` existe na UI (coberto por `transformar`).

### Onda D — F3b (2026-11-09) ✅ com 1 correção do orquestrador

- `npm run build` ✅ · `npm test` 746/746 ✅ (+1 teste novo do orquestrador). 13 workers Haiku.
- Bundle gzip total 575 kB (meta ≤ 1,5 MB) ✅; texto (66 kB) e fonte Roboto (21 kB) só carregam no `TEXTO`.
- Browser (via `__3dm.imprimir`, pane oculto): filamento muda massa (PLA 50,2 g · TPU 49 · ABS 42,5 · PETG 51,5) e avisos (Bowden com TPU e câmara aberta com ABS só na Mega S; encolhimento do ABS nas duas) ✅; export 3MF em 190 ms com miniatura e STL por corpo, nomes `caixa-com-tampa-<corpo|todos>-<impressora>` ✅; hash do 3MF repetível ✅.
- **Bug (corrigido pelo orquestrador):** cancelar o export antes de o worker novo ficar pronto deixava a promessa presa para sempre ("Exportando…" eterno, e cada export seguinte reiniciava o worker). Causa: `worker/cliente.ts` encadeia `pede()` no `pronto` do worker, que nunca resolve se o worker morre antes de carregar. Correção: `reinicia()`/`dispose()` soltam quem esperava (contador de geração → `null`). Teste `worker-cliente.test.ts` falha sem a correção e passa com ela. Browser: cancelar com 5/20/60 ms → `cancelado`, export seguinte ok, nada preso ✅.
- Customizar em 375 px: `#customizar&L=93&parede=3` → L=95 (aviso de ajuste), parede 3, sem rolagem horizontal; slider W=60 regenera (95×60) e exporta 3MF ✅. Projeto salvo no navegador não foi sobrescrito pelo link ✅.
- Sem mouse no pane: clique real em `LF`, arrastar arquivo para importar e diálogos do File System Access ficam na checklist do usuário (H4); a lógica tem testes.
- Testes de desempenho intermitentes: `sketch-ponte` (agora melhor de 15) e `sketch-solver` #21 (agora melhor de 5). Na suíte em paralelo a mediana chegou a 16,38 ms; o melhor tempo fica em 6–12 ms.
- Antecipados do DoD global: G3 (CI roda `npm test` antes do deploy) ✅; G4 (hook gerou e incluiu `graph.json`/`GRAPH_REPORT.md` num repo descartável) ✅, e `npm run setup` foi rodado aqui (o `core.hooksPath` estava vazio); G9 (13 dependências no THIRD_PARTY, nenhuma GPL) ✅.

### Onda A — SPK (2026-11-08) ✅

- `node --test spikes/solver/*.test.ts spikes/3mf/teste.mjs spikes/ws/teste.mjs` → 34/34.
- Solver: 0,38 ms/iteração no pior caso de 200 pontos (meta 16 ms). GO.
- 3MF: estrutura e chaves OK. Abrir nos slicers = H2.
- R4 no browser pane: página `https://example.com` → `ws://127.0.0.1:47800` falha (1006) antes de chegar ao servidor; Node com o mesmo Origin e token recebe `pong`; página em `http://127.0.0.1:47800` conecta e recebe `pong`. Conclusão: bloqueio de Local Network Access. Mitigação registrada na F4a-02 (MCP serve o app em 127.0.0.1) + H7.

### Onda A — F0 (2026-11-08) ✅ com rodada 2 de correção

- `npm run build` ✅ (JS 154 kB gzip) · `npm test` 31/31 ✅ · `git log` vazio ✅.
- Browser pane, 1400 px: 3 colunas ✅; Numpad 1/3/Ctrl+7/5 e Home ✅ (evento real `code: Numpad*`; a ferramenta de clique do pane não envia código de numpad); `PARAM` → `l = 80`, Ctrl+Z remove, Ctrl+Y devolve ✅; troca P2S → Mega S: 210×210×205 na vista e no painel ✅; recarregar recupera parâmetro e impressora + aviso ✅; ◐ alterna e volta ✅; preset AutoCAD → `botaoMeio: pan` ✅; `prefers-color-scheme: light` em Automático → tela clara ✅.
- 375 px: sem rolagem horizontal, vista no topo, painéis embaixo ✅. Toque real não dá para simular no pane; configuração conferida no código (`touches ONE=ROTATE, TWO=DOLLY_PAN`, `touch-action: none`).
- Rodada 2 (manager F0): banner de erro só antes do boot; `data-theme` = tema efetivo; pivô de órbita sob o cursor.
- Desvio: SPK e F0 não usaram workers Haiku. `PROTOCOLO.md` item 2 agora obriga.
- Adiado para F3b: lista de projetos recentes, File System Access API.

### Onda B — F3a (2026-11-08) ✅

- `node --test packages/core/test/{malha,export,imprimir}-*.test.ts` → 44/44. 4 workers Haiku (um por tarefa).
- `p2s-bambu-2cores.3mf`: `printer_model "Bambu Lab P2S"`, `filament_colour [#FF0000, #0000FF]`, `extruder` 1 e 2 por objeto ✅. `mega-s-prusa.3mf` com `Slic3r_PE.config` ✅. Abrir nos slicers = H2.

### Onda C (antecipada) — F4a rodada 1 (2026-11-08) ✅

- `node --test packages/mcp/test/*` → 22/22 (stdio via cliente SDK, WS com/sem token, Origin, traversal, headless). 3 workers Haiku.
- `node packages/mcp/bin/3d-modeling-mcp.mjs` → app servido em `http://127.0.0.1:47800/#token=…`, `window.__3dm` presente, WS da mesma origem abre ✅ (mitigação do R4 funcionando).
- `zod` entrou como dependência (exigida pelo SDK, MIT). F4a-04 (cliente no app) fica para depois da F1.

### Onda C (antecipada) — F2 rodada 1, core (2026-11-08) ✅

- `node --test packages/core/test/{kernel,features,regen,medir}-*` → 67/67; `npm run build` ✅ (JS 156 kB gzip). 8 workers Haiku.
- Regeneração de peça com 12 itens no Node: fria 38,9 ms; pior caso (muda a 1ª feature) 15 ms; memória WASM +0,29 MB em 100 regenerações.
- Chanfro/fillet de borda topo/base entra no MVP (ver abaixo)

### Onda B — F1 rodada 1 (2026-11-08) ❌ volta para rodada 2

- `npm run build` ✅ (JS 186 kB gzip) · `npm test` 419/419 ✅. 17 execuções de workers Haiku.
- Browser (via `__3dm.sketch.executa/tecla`, pane oculto): `REC` 0,0 → @80,50 = 4 linhas, p3 (80,50), 1 perfil ✅; `FIX` + `DIM =L` + `DIM 50` → `definido`, dof 0 ✅; `PARAM L 100` → p3 (100,50) ✅; `h`→`r` aplica e desfaz sem refazer, linha `HR` ✅; `TR`/`EX`/`DI` ✅.
- **Bug bloqueante:** com seleção, `t` sem restrição aplicável seguido de `r` desfaz o último comando da pilha (apagou a linha desenhada e um `PARAM`), sem refazer. Perda de dados.
- Rodada 2 pedida: bug 2b; origem fixa do sketch; DYN/OTRACK; opções de REC/C/A; F1/Ctrl+K/tooltips/aliases.
### Onda C — F2 rodada 2, UI (2026-11-09) ✅ critérios A · rodada 3 pedida

- `npm run build` ✅ · `npm test` 563/563 ✅ · 14 workers Haiku (+8 da rodada 1).
- Bundle gzip: JS 225 kB + worker 27 kB + WASM manifold 204 kB + CSS 4 kB ≈ **462 kB** (meta ≤ 1,5 MB) ✅.
- Browser (via `__3dm.solido`): exemplo caixa com tampa carrega, 2 corpos fechados ✅; `L=100` → 3 ms, recalcula de `ex1` em diante ✅; `H=???` → `ex1` vermelho com causa+correção, seguintes suspensas, desfazer volta ✅; `g x 5 Enter` → feature `tr1`, bbox +5 em X ✅; `DI` (0,0,0)→(3,4,12) = "Distância 13,00 mm" ✅.
- Visual não conferido: o pane está oculto (screenshot falha). Cena tem 3 malhas e 8 conjuntos de linhas.
- Rodada 3: tampa não encaixa (offset de plano só numérico → tampa em z 32–37); 11 arquivos `*-textos.ts` violam D20 e o teste tinha brecha; gizmo `W`.

### Onda D — F4b rodada 2, ponte no app (2026-11-09) ✅ com ajuste de captura

- `npm test` 723/723 (relato do manager; 1 falha intermitente vista por ele). 11 workers Haiku na F4b.
- Ponte ao vivo (cliente SDK próprio + aba em `http://127.0.0.1:47800/?r=1#token=…`): indicador "MCP ●"; `projeto_novo{nome:'ponte'}`, `primitiva`, `shell` → `modo:"ponte"`, aba com cx1+sh1, 22.112 mm³ (= headless), `nome: 'ponte'` ✅; `desfaz` na aba tira a tool ✅; `captura` → PNG 43 kB ✅.
- Ajuste pedido: a captura enquadra o volume da impressora em vez dos corpos (peça ocupa ~10% da imagem) e o topo do shell aparece liso, sem arestas internas.
- Dica para validar: a aba presa numa página 426 não recarrega só mudando o `#token`; usar `/?r=1#token=…`.
- Reconferência (sondas 2–4): enquadramento corrigido pelo manager ✅. Topo liso persistia: a captura renderizava antes do worker devolver a malha nova (corrida). Correção do orquestrador: `instala.ts` espera `solido.api.aguarda()` antes de renderizar (+1 linha em `main.ts`). Sombreamento: degradê nas paredes por normais suavizadas em quinas de 90°; `corpos3d.ts` passou a usar `toCreasedNormals` (three, MIT) com o mesmo ângulo das arestas (20°). Sonda 4 (`captura` logo após `shell`, sem pausa): shell aberto com aro e cantos internos, faces planas, PNG 45 kB ✅. `tsc` ✅ · app 294/294 ✅.

### Onda D — F4b rodada 1, tools headless (2026-11-09) ✅

- `node --test packages/mcp/test/*` → 58/58; `fluxo.test.ts`: caixa+tampa via SDK stdio, sha256 do 3MF headless = `escrever3mf(processa())` do worker do app ✅. 5 workers Haiku.
- Sonda própria (cliente SDK, scratchpad): 28 tools; caixa 80×50×30 na Mega S → 120.000 mm³, 148,8 g PLA, fechada; caixa de 300 mm → erro `fora-do-volume` com correção; `desfazer` ✅; `exportar 3mf` ✅; alvo inexistente → causa + correção, "nada foi alterado" ✅. Detalhe: nome do `projeto_novo` não vai para o arquivo.
- Rodada 2 pedida: cliente da ponte no app, modo ponte nas tools, PNG, tools faltantes, `parametros_expostos`.

### Onda C — F2 rodada 3 (2026-11-09) ✅

- `node --test packages/core/test/* packages/app/test/*` → 556/556; `vite build` do app ✅. Nenhum `*-textos.ts` restante; `textos.test.ts` só exclui `src/textos.ts`.
- Browser: exemplo carrega sem erro; caixa z 0–30, tampa z 27–32 (aba dentro da cavidade, interseção vazia no teste) ✅; árvore com rótulos ✅. Gizmo `W`: lógica testada (12 casos), arraste real fica para o usuário.

### Onda B — F1 rodada 2 (2026-11-08) ✅

- Testes da F1 (`expr-`, `sketch-`, `teclado-`, `comandos-`) → 288/288; suíte total 523 no fim da rodada.
- Browser: `REC 0,0 @80,50` + `DIM =L` + `DIM 50` → `definido` **sem `FIX`** (origem `p0` fixa) ✅; `t r`, `e x`, `d i` sem restrição aplicável → entidades inalteradas, linha `TR`/`EX`/`DI` ✅; `h` + Enter aplica, `desfaz` tira só a restrição e mantém a linha ✅; F1 e Ctrl+K abrem o cartão "Atalhos de teclado" ✅; F12 liga DYN ✅; tooltip "Retângulo — REC · Shift+A › Sketch" ✅.
- Pendências menores: aliases removidos só somem ao recarregar; TTR sem círculo×círculo; linha presa na origem não anda com G/R/S (comportamento do Onshape).
- Linha original: chanfro/fillet de borda topo/base entra no MVP (erro de volume ≤ 0,6% da perda). Pendente para a rodada 2: ligar ao tipo do documento, resolvedor real do sketch, UI/worker/G/R/S/exemplo, `ref_hashes.json`, "extrude até o plano".
