# Relatório F0 — Fundação

Manager F0 (Sonnet 5.5). Sem commit, sem push. Nada tocado em `spikes/`.

## Tarefas

| Tarefa | Estado | Check usado | Resultado |
|---|---|---|---|
| F0-01 Monorepo | ✅ | `npm install && npm run build && npm test` | build e 31 testes passam; `dist` 613 kB (JS 154 kB gzip) |
| F0-02 Hook graphify | ✅ | cópia temporária fora do projeto, `git init`, `core.hooksPath=.githooks`, commit de teste | commit saiu com `graphify-out/graph.json` e `GRAPH_REPORT.md` (cache, manifest e html ficam fora). 3,4 s |
| F0-03 CI | ✅ (arquivo) | leitura + mesmos comandos local | `.github/workflows/pages.yml`: Node 22, `npm ci` → `npm test` → `npm run build` → `deploy-pages@v4`. Execução real = H1 |
| F0-04 Documento + comandos | ✅ | `node --test packages/core/test/doc.test.ts` | schema v1 à mão, `Comando{nome,fazer,desfazer}`, pilha undo/redo, ramo novo descarta redo |
| F0-05 Perfis | ✅ | `packages/core/test/perfis.test.ts` | 210×210×205 e 256×256×256; densidades 1,24 / 1,27 / 1,21 / 1,05 |
| F0-06 Casca | ✅ | build + teste de tokens + teste de textos + captura | tokens escuro/claro com contraste AA testado; 3 colunas ≥ 1100, 1 coluna < 1100, < 700 só visualização; `textos.ts` |
| F0-07 Viewport | ✅ (parcial no browser) | `nav.test.ts` + inspeção no browser pane | Z para cima, grade 1/10 mm adaptativa, volume + mesa, eixos, gizmo, Home, numpad 1/3/7/5/9/./2468/±, presets Blender e AutoCAD |
| F0-08 Linha + status | ✅ | `registro.test.ts`, `tema-prefs-status.test.ts` + browser | comando-teste **`PARAM`** (pergunta nome e expressão, cria parâmetro visível na lista esquerda). `U` e `REDO` também. Ctrl+Z/Y/Shift+Z. F2/F3/F7–F12 |
| F0-09 Persistência | ✅ | browser (criei 2 parâmetros, recarreguei) | projeto recuperado + aviso "Projeto recuperado do navegador"; abrir/salvar `.3dm.json` |
| F0-10 Seletor | ✅ | browser | trocar impressora é comando com undo: muda o volume na vista e o texto em Propriedades; Ctrl+Z volta |

## Verificação (copiável)

```
npm install
npm run build        # tsc --noEmit (raiz, com DOM) + tsc -p packages/core (sem DOM) + vite build
npm test             # node --test "packages/*/test/*.ts"  → 31 testes, 0 falhas
npm run dev          # http://localhost:5173
npm run preview -w @3dm/app -- --port 4173   # depois do build
```

Medidas (preview, browser pane): `loadEventEnd` 166 ms (meta < 2 s). HUD ≈ 0,4–1 ms por quadro. Bundle gzip 154 kB (meta ≤ 1,5 MB).

## Mapa dos critérios F0 "A" (§1.2) → check

| Critério | Check |
|---|---|
| Abre em < 2 s | medido: 166 ms (item 1 da checklist repete) |
| Grid e volume das 2 impressoras | `perfis.test.ts` (volumes) + checklist 3 (a vista lê o volume do perfil) |
| Home, numpad 1/3/7/5, gizmo | `nav.test.ts` (mapeamento) + checklist 4 |
| Ctrl+Z/Y num comando-teste | `doc.test.ts`, `registro.test.ts` + checklist 6 |
| Recarregar recupera (IndexedDB) | checklist 7 (não há IndexedDB no Node) |
| Hook do graphify | F0-02 acima |
| Tema claro/escuro + `prefers-color-scheme` | `tema-prefs-status.test.ts` (`temaEfetivo`), `tokens.test.ts` (contraste) + checklist 8 |
| Preset AutoCAD troca o pan | `nav.test.ts` + checklist 5 |
| Nenhum texto de UI fora de `textos.ts` | `textos.test.ts` (varre `src/**/*.ts` e `index.html`) |

## Checklist de verificação no navegador (orquestrador)

Observação: no browser pane o `requestAnimationFrame` só roda quando a janela está à frente; um `screenshot` força os quadros. Depois de apertar uma tecla de vista, tire um screenshot.

1. `npm run dev` → abre em `http://localhost:5173`, sem faixa vermelha de erro, sem erro no console. Esperado: topo (Arquivo, abas desabilitadas, impressora, ↶ ↷, ◐, ⚙), esquerda "Navegador do projeto", vista com wireframe, direita "Propriedades", linha de comando, barra de status.
2. Em `localStorage`/IndexedDB limpos o tema segue o sistema (escuro se o sistema não pedir claro).
3. Propriedades mostra "Bambu Lab P2S, 256 × 256 × 256 mm" (padrão). Trocar a impressora no topo para "Anycubic i3 Mega S": texto vira "210 × 210 × 205 mm" e a caixa na vista encolhe (a mesa é 210 × 210). Ctrl+Z volta para a P2S. Na vista, aproximar muito mostra grade de 1 mm; afastar sobe para 10 mm e 100 mm (`__3dm.vista.inspeciona().passoGrade`).
4. Foco na vista (clique fora de campos): Numpad 7 topo, 1 frente, 3 direita, Ctrl+Numpad 1/3/7 lados opostos, 5 alterna perspectiva/ortográfica (botão "Perspectiva" no card Vista muda de rótulo), 9 vista oposta, Home enquadra tudo. Clicar nas esferas do gizmo (canto inferior direito) leva a câmera para o eixo, com animação de 300 ms. Botões Frente/Direita/Topo do card Vista fazem o mesmo.
5. Mouse (Preferências ⚙ → Navegação): **Blender** — arrastar com o botão do meio orbita, Shift+meio faz pan. **AutoCAD** — meio sozinho faz pan, Shift+meio orbita. Roda dá zoom no cursor. Botão esquerdo/direito não navegam e não abrem menu do navegador na vista. Duplo clique do meio enquadra. Estado: `__3dm.vista.inspeciona().botaoMeio` ("orbitar" ou "pan").
6. Clicar na vista (tirar foco de campos) e digitar `PARAM` + Espaço (ou Enter) → pergunta "Nome do parâmetro:" → `L` Enter → "Expressão…" → `80` Enter. A lista da esquerda ganha `L = 80`. Ctrl+Z remove; Ctrl+Y ou Ctrl+Shift+Z devolve; `U` também desfaz. Enter vazio repete `PARAM`. Esc durante a pergunta cancela ("*Cancelado*"). Digitar `PA` mostra sugestões (`PAR`, `PARAM`); Tab completa; ↑↓ recuperam entradas. F2 expande o histórico. `XYZ` Enter mostra erro com a correção.
7. Com um parâmetro criado, esperar 1 s e recarregar (F5): o parâmetro continua na lista e aparece o aviso "Projeto recuperado do navegador". Arquivo › Salvar baixa `projeto.3dm.json`; Arquivo › Novo (confirma) zera; Arquivo › Abrir… com o arquivo salvo traz de volta. Abrir um JSON qualquer mostra o erro em português sem derrubar o app.
8. ◐ no topo alterna claro/escuro (a vista também troca: fundo, grade, mesa, eixos); recarregar mantém a escolha. ⚙ → Tema "Automático" volta a seguir o sistema. Emular `prefers-color-scheme: light` com preferência "Automático" → claro.
9. Barra de status: mover o mouse sobre a mesa mostra `X 12.50  Y 30.00`. F7 liga/desliga a grade (e o botão GRID); F8 (ORTHO) liga e desliga o POLAR; F10 (POLAR) desliga o ORTHO; F3, F9, F11, F12 só alternam. O HUD mostra ms (verde). Card Desempenho: orçamento e pixels 1×/1,5×/2×.
10. N esconde e mostra Propriedades (≥ 1100 px); a aba vertical "Propriedades (N)" também.
11. **375 px**: vista fixa no topo (42 dvh), Navegador e Propriedades embaixo com rolagem, sem linha de comando, cards recolhidos, topo cabe sem cortar, abre e orbita com um dedo (toque), pinça dá zoom. Largura 800–1099: uma coluna com a vista a 60 dvh.
12. Conferir que nenhum texto está fora de `textos.ts`: `npm test` (teste `textos.test.ts`).

## Decisões

- **Não despachei workers Haiku.** O F0 é ~40 arquivos pequenos e acoplados (textos, tokens, vista, linha); escrever tudo no mesmo contexto saiu mais coerente e mais rápido que briefar 10 workers. Desvio do protocolo, registrado aqui. Posse de arquivos respeitada.
- **Comando-teste = `PARAM`** (alias `PAR`), com perguntas (nome, expressão). Também `U`/`DESFAZER` e `REDO`/`REFAZER`. Argumentos colados na mesma linha (`PARAM L 80`) respondem as perguntas.
- **Espaço executa** o alias digitado só se ele existe; durante uma pergunta, só Enter envia (expressões têm espaço).
- **Foco:** depois de executar, a linha perde o foco (o numpad volta a navegar); durante uma pergunta mantém o foco. Digitar um caractere imprimível fora de campos foca a linha.
- **Tema:** padrão "auto" (segue `prefers-color-scheme`; escuro quando o sistema não pede claro). O botão ◐ grava escolha explícita. Script inline no `index.html` evita o piscar (lógica oficial em `tema.ts`).
- **Tema claro:** base do §4.2 (`#f4f5f7`, `#e9ebee`, `#1d1f22`, `#8f8a80`). Cores de eixo, cota, destaque e vértice ficaram **mais escuras no claro** (ex.: `--eixo-y #4c8a00`), porque as do escuro não passam 3:1 sobre fundo claro. No escuro, só `--ativo` mudou de `#5a6b7d` para `#4f6072` (texto sobre ativo < 4,5:1). `tokens.test.ts` confere AA.
- **Documento:** campo opcional `nome` (para nomear exportações). **Perfis:** campos extras `camaraFechada` e `ams` (F3a-04 precisa de "impressora aberta"). **ABS/ASA:** densidade 1,05 (média; `variantes` abs 1,04 e asa 1,07).
- **Tipos/build:** `npm run build` roda `tsc --noEmit` na raiz (com DOM; cobre app e testes, exclui `spikes/`), `tsc -p packages/core` (sem DOM, garante o princípio) e `vite build` com `base: './'`.
- **Branch:** renomeei a branch não nascida de `master` para `main` (`git symbolic-ref`), porque o `pages.yml` dispara em `main`. Sem commit.
- **Navegação:** só os presets Blender e AutoCAD (como no plano). Onshape/Fusion (§7.4 terceira linha) fica para depois.
- **Abas Sketch/Sólido/Inspecionar/Imprimir** existem desabilitadas (layout "vazio" do §11).
- `.gitattributes` força LF no hook (CRLF quebraria o `sh`).
- `window.__3dm = { projeto, vista, barra }` fica exposto para conferência no browser.

## Pontos de extensão para as próximas ondas

- Registro: `packages/app/src/linha/registro.ts` (`registra({nome, aliases, descricao, executa(ctx)})`; `ctx.pergunta`, `ctx.escreve`). F1 registra os comandos de `comandos/` em `main.ts` (manager).
- Atalhos globais: `packages/app/src/atalhos.ts`. O despachante G/R/S + restrições da F1 (`teclado/`) deve entrar **antes** do bloco "Enter/Espaço repete" e "digitar foca a linha".
- Mudanças no documento: sempre `projeto.executa(comando)` (`packages/app/src/projeto.ts`); a lista, o autosave e a vista reagem a `projeto.aoMudar`.
- Cena 3D: `vista.cena` (THREE.Scene, já com luzes) e `vista.pedeRender()`; HUD: `cards.hud(ms)` + `barra.hud(...)` (hoje alimentado pelo tempo do quadro; a F2 deve passar o tempo de regeneração).
- Textos novos: `textos.ts` (`T`).

## Pendências e riscos

- **H1:** repo no GitHub, push e Pages; o CI não foi executado de verdade. O CI usa `node-version: 22` e depende de type stripping no Node (≥ 22.18).
- Não feito (fora do F0 ou não pedido): pivô de órbita sob o cursor (a roda já dá zoom no cursor), lista de projetos recentes (§5.6), File System Access API (salvar usa download), F1 (ajuda), terceiro preset de navegação, desenho técnico recolhível na direita, cards Corte e Cotas.
- Os botões de sombreamento (esferas) só trocam o destaque; o efeito vem com os sólidos (F2).
- Risco: o `lightningcss` (MPL-2.0) é dependência de build do Vite; não vai no `dist` (ver `THIRD_PARTY.md`).
- Risco: `three` gera um chunk de ~600 kB; está dentro do orçamento (154 kB gzip), mas a F2 soma o WASM do manifold (~540 kB) — conferir G6 lá.
- Teste de contraste cobre só tokens em hex; `--card` (rgba) não entra.
- Verifiquei no browser pane: carga, vistas (numpad 7 renderizou), PARAM, undo/redo, persistência, troca de impressora, tema, 375 px. Não verifiquei arraste real do mouse (orbitar/pan) nem toque; ficam na checklist 4, 5 e 11.

## Rodada 2

Implementada por 3 workers Haiku; checks reexecutados por mim (`npm run build` ok, `npm test` ver contagem abaixo).

| Item | Estado | Check |
|---|---|---|
| 1. Erro depois do boot | ✅ | `boot.ts`: banner "não conseguiu iniciar" só se `#vista canvas` ainda não existe (`iniciou()`, testado em `test/boot.test.ts`). Depois do boot o erro vai para a linha de comando (`.l-erro`) e o toast, com `T.erroDepoisDoInicio` (causa + correção). Nova chave em `textos.ts`. Checklist: no console `setTimeout(()=>{throw new Error('x')})` → sem banner vermelho, mensagem na linha |
| 2. Tema auto | ✅ | `tema.ts`: `aplicaTema` guarda a preferência e instala sozinho um listener de `prefers-color-scheme`; `dataset.theme` segue o efetivo. `atributoTema`/`temaEfetivo` testados em `tema-prefs-status.test.ts`. Checklist: preferência "Automático", emular claro → `document.documentElement.dataset.theme === 'light'` |
| 3. Pivô de órbita | ✅ (sem teste de browser) | `vista.ts`: no pointerdown do meio (ação orbitar) o alvo vai para a profundidade do ponto sob o cursor (meshes da cena, senão plano z=0), sem mudar a imagem. Checklist: Blender, pointerdown do meio sobre a mesa fora do centro → `__3dm.vista.inspeciona().alvo` muda e `pos` não |

Não tocados: `main.ts`, `atalhos.ts`.
