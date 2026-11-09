# Relatório F4a — MCP infraestrutura (rodada 1)

| Tarefa | Estado | Check | Resultado |
|---|---|---|---|
| F4a-01 Pacote + stdio + 9 tools | ✅ | `node --test packages/mcp/test/servidor.test.ts` | 8/8 (cliente SDK lista tools, chama projeto_novo + parametro_definir + desfazer, erros isError) |
| F4a-02 HTTP + WS com token | ✅ | `node --test packages/mcp/test/ponte.test.ts` | 9/9 (401 sem/errado, 403 Origin, traversal, ola/estado/pede) |
| F4a-03 Headless (parcial) | ✅ parcial | `node --test packages/mcp/test/headless.test.ts` | 5/5. STL/3MF headless **pendentes** até a F2 entregar regeneração (F4b-03) |
| F4a-04 Cliente da ponte no app | ⏸ | — | 2ª rodada (depende de `main.ts` liberado pelo F1) |
| F4a-05 Recursos | ✅ | teste do servidor | `docs://api` (gerado dos schemas), `printers://lista`, `projeto://atual` |

Raiz: `npm run build` ok; `npm test` 196/196.

## Rodar
```
npm run build
node packages/mcp/bin/3d-modeling-mcp.mjs     # stdio; stderr mostra "App: http://127.0.0.1:47800/#token=..."
```
Abra a URL do stderr em http://127.0.0.1:47800 (serve `packages/app/dist`). Use `MODELING_MCP_DIR` (pasta dos .3dm.json, padrão `./3dm-projetos`), `MODELING_MCP_PORT`, `MODELING_MCP_PONTE=0` (desliga a ponte). No Claude Code: `claude mcp add 3dm -- node <caminho>/packages/mcp/bin/3d-modeling-mcp.mjs`.

## Workers Haiku: 3
1. `headless.ts` + teste. 2. `ponte.ts` + teste. 3. `tools.ts`, `servidor.ts` + teste de integração. Eu escrevi `package.json`, `bin`, `protocolo.ts`, `sessao.ts` (interfaces), 1 linha em `ponte.ts` (porta 0 era tratada como padrão) e `THIRD_PARTY.md`.

## Decisões / pendências
- `protocolo.ts`: Pedido{id,acao,args} / Resposta{id,ok,resultado|erro} / EventoEstado{doc,podeDesfazer,podeRefazer} / Ola/OlaOk. Token por subprotocolo `token.<t>` ou `?token=`.
- `zod` adicionado (dependência do SDK, fora da lista §0.5): necessário para schemas das tools.
- `sessao.ts` é a interface; na F4b as tools escolhem entre ponte (se app conectado) e headless. Hoje as tools só usam headless; a ponte já expõe `pede()`.
- Página de aviso sem build está fixa em `ponte.ts` (pt-BR), fora de `textos.ts` (mcp não importa o app).
- Headless: checagem de caminho é lexical (symlinks não bloqueados).
- Origem: aceita localhost/127.0.0.1 e `*.github.io` (+ `MODELING_MCP_ORIGINS`).
- Paridade (G7): as demais tools da §5.7 entram na F4b.
- Checklist de browser: após `npm run build` e subir o servidor, abrir a URL do stderr: deve carregar o app (sem build, a página de aviso). Conexão WS do app só na F4a-04.

---

# F4b rodada 1 (só `packages/mcp/**`)

`npm run build` ok; `npm test` 625/625.

| Tarefa | Estado | Check |
|---|---|---|
| F4b-01 tools §5.7 no headless (sketch_criar/adicionar/restringir, fillet_sketch, extrudar, revolver, primitiva, booleana, shell, furo, padrao, espelhar, chanfro, feature_editar/apagar, modelo_info, verificar_impressao, exportar) | ✅ | `tools-sketch` 7, `tools-solido` 15, `tools-modelo` 7 |
| F4b-02 captura SVG (iso/frente/topo/direita), headless | ✅ | `captura-svg.test.ts` 6; tool `captura` grava `capturas/*.svg` e devolve `resource image/svg+xml` |
| F4b-03 fluxo caixa+tampa por stdio + hash 3MF == core/worker | ✅ | `fluxo.test.ts`: sha256 do 3MF exportado = `escrever3mf` sobre a saída de `processa()` do app (tol de export) |
| `docs://api` com exemplo de cada tool; paridade | ✅ | gerado dos schemas; `docs/orq/paridade-mcp.md` |
| `parametros_expostos`, PNG, cliente da ponte | rodada 2 | — |

## Workers Haiku: 5 (máx. 2 simultâneos)
tools de sketch; captura SVG; tools de sólido; tools de modelo/export; teste de fluxo. Eu: `tool.ts`, `modelo.ts` (Regenerador por sessão, `executaChecando`), agregador, anexos no `servidor.ts`, `caminhoSaida` na sessão, docs.

## Decisões
- Feature nova que falha na regeneração é **desfeita automaticamente** e o erro volta com causa + correção (o projeto não fica quebrado).
- `parametro_definir` agora usa `definirParametroCompleto` (detecta ciclo).
- Captura: `_anexos` no retorno da tool vira `resource` MCP (SVG como texto). PNG só via ponte.
- Exportação: STL um arquivo por corpo; 3MF todos os corpos, cor de `aparencia` (padrão `#d9b36c`), slot 1, filamento PLA por padrão.
- Caminhos de saída ficam dentro de `MODELING_MCP_DIR`.

## Pendências / riscos
- Sem tool: `sketch_editar`, `sketch_estado`, remover restrição, suprimir, marcador, mover feature, transformar, corte, cor, renomear/remover parâmetro, medir (ver paridade).
- Solver: fixa em p1 + distância move o ponto na diagonal (mínima norma), não só em X; use restrições H/V (retângulo já as tem).
- Caixa `pos` = canto da base. Shell com `abrir:['topo']` fecha a malha corretamente (22112 mm³ no exemplo).
- Nada pedido ao core.

---

# F4b rodada 2

`npm run build` ok; `npm test` verde (ver contagem na resposta). Arquivos: `packages/mcp/**`, `packages/app/src/ponte/**`; integração minha em `main.ts` (1 import + 1 chamada), `textos.ts` (bloco `ponte`).

| Item | Estado | Check |
|---|---|---|
| F4a-04 cliente da ponte no app (`ponte/cliente.ts`, `ponte/instala.ts`): token do `#token=` (removido da barra) ou comando `PONTE`; indicador `MCP ●/◐/○` na barra de status; reconexão com aviso; site https público → mensagem de rede local + link `http://127.0.0.1:47800/` | ✅ | `app/test/ponte-cliente.test.ts` (7) |
| Modo ponte nas tools (`despacho.ts`) | ✅ | `mcp/test/ponte-stdio.test.ts` |
| Captura PNG no app (`ponte/captura.ts`, renderer offscreen próprio, não mexe na vista) | ✅ lógica pura testada; render real só no browser | `app/test/ponte-captura.test.ts` (5) |
| Tools restantes + `projeto_novo{nome}` + `exportar{valores,slot,filamento}` | ✅ | `tools-extra` (11), `tools-extra2` (11) |
| `docs://api` e paridade | ✅ | gerado dos schemas; `paridade-mcp.md` |
| Teste de integração da ponte (stdio + aba simulada com o cliente real, recusa sem/errado token, volta ao headless) | ✅ | `ponte-stdio.test.ts` |

## Como funciona o modo ponte
Com aba conectada, cada tool roda no servidor sobre uma cópia do documento da aba (último `estado` recebido); se o documento mudou, o servidor manda `aplicar {doc, nome}` e a aba executa UM comando `MCP <tool>` pela pilha (`projeto.executa`): Ctrl+Z desfaz a tool inteira. `desfazer`/`refazer` do MCP são repassados à pilha da aba. Sem aba, headless. Como a lógica é a mesma, o 3MF tem o mesmo hash nos dois modos. Workers Haiku nesta rodada: 6 (cliente, captura PNG, tools-extra, tools-extra2, teste ponte-stdio, + os da rodada anterior no total acumulado: 11).

## Checklist no browser (orquestrador)
1. `npm run build`; `node packages/mcp/bin/3d-modeling-mcp.mjs` (o stderr mostra `App: http://127.0.0.1:47800/#token=XXXX`). Em cliente MCP (SDK ou `claude mcp add`) deixe o processo vivo.
2. Abra a URL com o token no browser pane. Esperado: o indicador `MCP ●` na barra de status e o aviso "Conectado ao servidor MCP". A barra de endereço perde o `#token`.
3. Pelo cliente SDK chame `parametro_definir {nome:'L', expr:'100'}`; no browser a tabela mostra L=100 e `window.__3dm.solido.inspeciona()` regenera (`ms`, `recalculadas`). A resposta traz `modo:'ponte'`. Ctrl+Z na UI desfaz a chamada inteira.
4. `primitiva {tipo:'caixa', dim:[10,10,10], pos:[200,0,0]}` → aparece o corpo novo na vista e em `inspeciona().corpos`.
5. `captura {}` → 4 imagens PNG (`capturas/*.png` na pasta do projeto); confira que a vista do usuário não mexeu.
6. Edite algo na UI (ex.: parâmetro H) e chame `features_listar`/`parametro_definir`: a resposta reflete a edição da UI.
7. Linha de comando: `PONTE` + Enter, Enter vazio desconecta (indicador `○`); colar o token reconecta. Matar o servidor: indicador `◐` com "Nova tentativa em N s".
8. No site https publicado (sem servidor local): a conexão só é tentada com token; a mensagem de rede local aparece se falhar.

## Riscos / pendências
- Captura PNG real (WebGL offscreen) e o visual do indicador não foram vistos num browser; só lógica pura e protocolo testados.
- Cada tool aplicada na aba substitui o documento inteiro (um comando); edições simultâneas do usuário no instante da chamada podem ser sobrescritas (janela de ms).
- `importar`/`texto_3d` (F3b) sem tool ainda. Ver `paridade-mcp.md`.

## Ajuste da captura (pós-rodada 2)
- PNG (ponte): enquadra só os corpos visíveis (margem 10 %); mesa/volume/grade/eixos escondidos, salvo `mostrarVolume: true` na tool `captura`; seleção (emissiva e aresta laranja) neutralizada durante a captura e restaurada no `finally`. `vista.ts`: 1 linha nomeando os grupos `impressora`/`grade`/`eixos`.
- Verificado no browser pane: iso ocupa 79 % × 91 % da imagem 800×600 (frente 91 % × 49 %); caixa com shell aberto mostra as arestas internas da borda, sem cor de seleção.
- SVG headless: teste do exemplo caixa-com-tampa nas 4 vistas, bbox ≥ 92 % da largura do viewBox (`captura-svg.test.ts`). O SVG nunca desenha o volume.
- Obs.: o teste de desempenho `sketch-ponte` (≤ 16 ms) falha esporadicamente sob carga (17,7 ms); não é do MCP.
