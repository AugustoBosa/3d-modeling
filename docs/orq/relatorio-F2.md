# Relatório F2 — Sólidos

## Rodada 1 (core: F2-01, F2-02, F2-03, matemática da F2-07)

Sem commit, sem push. Raiz: `npm run build` ok; `npm test` 399 testes, 0 falhas. Editei como manager: `packages/core/package.json` (dep `manifold-3d ^3.5.4` + exports `./kernel ./features ./regen ./medir`) e `THIRD_PARTY.md`.

| Tarefa | Estado | Check | Resultado |
|---|---|---|---|
| F2-01 Kernel (init, lixo, malha, perfil→CrossSection, plano) | ✅ | `kernel-kernel.test.ts` | 5 testes |
| F2-02 extrude (normal/simétrica/duas/taper), revolve | ✅ | `features-perfis.test.ts` | 13 testes (volume, bbox, fechada) |
| F2-02 primitivas, booleana, shell prismático, padrão, espelho, corte, transformação | ✅ | `features-solidos.test.ts` | 17 testes |
| F2-02 furo simples/escareado/rebaixado, M2–M8, inserto, compensação | ✅ | `features-furo.test.ts` | 11 testes |
| F2-02 chanfro/fillet de borda topo/base (spike) | ✅ **entra no MVP** | `features-borda.test.ts` | 5 testes; integrado em `extrude.borda` |
| F2-03 Regeneração (cache, erro, suspensas, marcador, suprimida) | ✅ | `regen-regen.test.ts` | 8 testes |
| F2-07 core: distância, ângulo, raio, área de face, volume | ✅ | `medir-medir.test.ts` | 7 testes, precisão 0,01 |
| Desempenho | ✅ | `regen-desempenho.test.ts` | ver abaixo |

## Medições (Node, peça de 12 itens: caixa, casca, 4 furos, 2 pinos, padrão, espelho, união)
- Regeneração fria: 38,9 ms
- Mudar a 1ª feature (pior caso, recalcula tudo), mediana de 10: **15,0 ms** (meta ≤ 300)
- Mudar a última feature: 6,5 ms · sem mudança: 0,03 ms
- Memória: 100 regenerações com recálculo, `arrayBuffers` +0,29 MB (limite do teste 2 MB). Sem crescimento relevante.
- Chanfro/fillet por camadas: erro de volume ≤ 0,6 % do material removido; degraus de 0,2 mm (escala da camada de impressão); 1–6 ms. Conclusão: **viável**, não vai para "fora do MVP" (R3 resolvido). Limite: bordas só em extrusão modo normal, sem taper.

## Como o app importa (navegador)
`import { Manifold, CrossSection } from '@3dm/core/kernel'` **só dentro do worker de geometria** (top-level await inicia o WASM; o Vite empacota `manifold.wasm` como no terrain). Regeneração: `new Regenerador().regenera({features, marcador, resolvedor, planoDe, tol})` → `{corpos: Map<id, Malha>, status, recalculadas, ms}`. Malha é o tipo de `@3dm/core/malha` (vai direto para `fechada`/`stl`/3MF). Tolerâncias: `TOL_PREVIA` 0,05, `TOL_EXPORT` 0,01.

## Contrato (para a rodada 2)
- `Perfil = {externo, furos}`, `PlanoLocal = {origem, normal, eixoX}` (kernel/tipos.ts). Resolvedor injetado `(sketchId) => Perfil[]` e `planoDe(sketchId) => PlanoLocal` (acrescentei `planoDe` ao brief: extrude/revolve precisam do plano).
- Features: `features/tipos.ts` (valores já numéricos). Rodada 2 liga ao `Feature` do doc e avalia expressões. `executa(f, ctx, planoDe) -> Delta`; Delta = corpos novos/alterados (null = removido), objetos novos pertencem ao cache.
- Erros: `ErroFeature(causa, correcao)` → `status[id].erro`.

## Workers Haiku: 8
kernel; medir (caiu por limite de API, retomado por SendMessage); extrude/revolve; sólidos (primitivas, booleana, shell, padrão, espelho, corte, transformação); furo; borda (spike); regen; desempenho. Eu escrevi só interfaces (`kernel/tipos.ts`, `features/tipos.ts`, `operacao.ts`, `regen/tipos.ts`), `features/index.ts` e a integração da borda (4 linhas).

## Decisões / riscos
- Taper = escala uniforme em torno do centro da bbox (aproximação; exata só para perfis centrados simples).
- Booleana: sem `manter`, as ferramentas são removidas.
- Cilindros poligonais com tol 0,01 têm volume ~0,5 % menor que π r² (flecha, não área); testes comparam com o polígono.
- Shell só prismático (Z global), erro claro caso contrário. "Extrude até o plano" não feito (fora do brief da rodada 1).
- Inserto de latão: valores típicos, conferir com o comprado.
- Pendência rodada 2: ligar ao tipo `Feature` do doc, avaliar expressões, resolvedor/planoDe reais do sketch, UI, worker, G/R/S, exemplo, `ref_hashes.json`.

---

## Rodada 2 (integração, worker, UI, G/R/S, medir, exemplo)

Raiz: `npm run build` ok; `npm test` 563 testes, 0 falhas. Sem commit, sem push. Verificado no browser pane por `__3dm` (sem mouse real): exemplo carregado no primeiro uso, mudar `L` regenera em 5,4 ms, painel de feature com prévia, G X 5 Enter, DI, H.

| Item | Estado | Check |
|---|---|---|
| Integração core: `entradaDe(doc)` (expressões nos campos numéricos, resolvedor e `planoDe` reais do sketch, feature com expressão inválida vira erro), "extrude até o plano" (`modo:'ate'`), `copiaId` na transformação | ✅ | `features-doc`, `features-perfis` |
| Comandos do documento (adicionar/editar/remover/suprimir/marcador/mover/cor, parâmetros com ciclo e renomear) | ✅ | `features-comandos` (17) |
| F2-04 worker (`worker/processa|gera.worker|cliente`): debounce 60 ms, 1 pedido em voo, cache de regeneração mora no worker, só buffers | ✅ | `worker-processa`; build gera `gera.worker` + `manifold.wasm` |
| Corpos na vista (arestas 20°, cor por corpo, dispose, picking) | ✅ | `features-corpos3d` |
| F2-05 árvore (ícones, olho, erro em vermelho, suspensas, marcador arrastável e por ↑/↓, duplo clique edita) | ✅ | `features-arvore` (modelo); DOM verificado só por JS |
| F2-05 painel de feature (esquemas por tipo, prévia ao vivo, Enter/Esc) e propriedades Tipo/Instância | ✅ | `features-esquemas` |
| F2-05 tabela de parâmetros (nome, expr, valor, unidade, comentário, ciclo com mensagem) | ✅ | `features-parametros` |
| Comandos §7.1 no modo sólido (EXT/E REV UNI SU IN BOX CYL SPH CONE TOR SHELL HOLE CHA F AR MI SLICE, Shift+A); aba Sólido/Sketch | ✅ | manual (checklist) |
| F2-06 G/R/S (eixo, Shift+plano, número, Ctrl snap, Shift+D, Enter/clique/Esc/direito), H/Alt+H/Shift+H | ✅ | `features-transformar` (22) + browser; **`W` (gizmo) não feito** |
| F2-07 `DI`/`MEA`: distância, ângulo, raio, área, volume, snap vértice/aresta/centro, resultado até Esc; cotas 3D L×W×H (`COTAS`) | ✅ | `features-medir-modelo`, `features-cotas3d` (precisão 0,01) |
| F2-08 exemplo `examples/caixa-com-tampa.3dm.json` + `ref_hashes.json` + teste (L → 2,6–6 ms; hash estável) | ✅ | `features-exemplo` |
| `window.__3dm.solido` (inspeciona, aguarda, seleciona, abre, confirmaPainel, medirPonto/Face/Corpo) | ✅ | browser |
| `docs/orq/paridade-mcp.md` | ✅ | leitura |

## Workers Haiku nesta rodada: 14
doc→regen+planos+`ate`; comandos de documento+tabela; worker+cliente; exemplo+hashes; corpos3d; árvore; painel+esquemas; parâmetros UI; transformar; medir-modelo; medir-ui+cotas3d (mais os 8 da rodada 1). Eu escrevi: `features/contrato.ts`, `solido.ts` (controlador), `solido-textos.ts`, `paineis.ts`, abas do `topo.ts`, `ligacao.ts` (rota para o sólido), `main.ts`, `vista.raio`, `copiaId`.

## Como o orquestrador valida (sem mouse)
`__3dm.solido.inspeciona()` → features (estado/erro), corpos (bbox, volume, tri, fechada), `ms`, `recalculadas`, seleção, medidas.
1. **Caixa com tampa regenera ≤ 300 ms:** `__3dm.projeto.executa(...definirParametroCompleto('L',{expr:'100'}))` (import de `/@fs/.../core/src/features/comandos.ts`) ou editar o campo L na tabela; `await __3dm.solido.aguarda()`; ver `ms` e `recalculadas` (começa em `ex1`).
2. **Erro sem quebrar:** pôr `H` = `???` na tabela → `ex1` com `erro`, as seguintes `suspensa`; árvore vermelha; corrigir volta.
3. **G/R/S:** `__3dm.solido.seleciona(['ex2'])`; `__3dm.sketch.tecla('g')`, `'x'`, `'5'`, `'Enter'` → feature `tr1` e bbox deslocada. Shift+D: `tecla('d',{shift:true})`.
4. **Medir:** `__3dm.sketch.executa('DI')` (não dar `await` em `MEA`: ele pergunta), `__3dm.solido.medirPonto([0,0,0])`, `medirPonto([3,4,12])` → "Distância 13,00 mm"; `medirFace('ex1', 0)`; `medirCorpo('ex1')`; Esc limpa.
5. **Painel:** `executa('BOX')` abre o painel com prévia (`previa: true`); `__3dm.solido.confirmaPainel()` grava.
6. Esconder: `tecla('h')` com corpo selecionado; `tecla('h',{alt:true})` mostra tudo; `tecla('h',{shift:true})` isola.
Mouse real (pick, arrasto do marcador, clique para confirmar G/R/S, snap de medida) **não foi exercitado**.

## Pendências e riscos novos
- `W` (gizmo de manipulação) não implementado; "sem corpos nos 375 px" não verificado; `Plano.offset` do sketch só aceita número (a tampa do exemplo fica em z fixo 35/32, aba sem encaixe real: 2 mm acima da borda).
- Area/volume sem âncora para o rótulo 3D (`pontos` vazio): o texto aparece no aviso/linha de comando.
- `renomeiaParametro` reescreve só campos string de topo das features; `removeParametro` não bloqueia (a UI bloqueia).
- O worker recria `corpos` a cada regeneração (copia buffers): a vista recria geometria de corpos inalterados. Custo ok hoje; otimizar com ids de versão se pesar.
- Textos novos estão em `features/*-textos.ts` (aceitos pelo teste), não em `textos.ts`, para não conflitar com o F1.

---

## Rodada 3

`npm test`: 585 testes, 584 ok; a única falha é `packages/mcp/test/servidor.test.ts` (F4 em andamento; `tsc` na raiz também só acusa `packages/mcp`). `vite build` do app ok. Tudo que é meu passa.

| Item | Estado | Check |
|---|---|---|
| 1. Tampa 100% paramétrica: `Plano.offsetExpr` (sketch/tipos.ts, `resolveSketch` e `entradaDe` avaliam); exemplo refeito: tampa apoiada em z=H (`offsetExpr` "H" e "H-3"), aba (L-2p-2f)×(W-2p-2f) dentro da cavidade | ✅ | `features-exemplo` (10): 4 combinações de L/W/H/parede/folga, folga ≥ `folga` de cada lado, interseção caixa∩tampa vazia, H=30/40 move a tampa; hash `ex2` atualizado |
| 2. Textos: os 11 `*-textos.ts` viraram namespaces de `T` em `src/textos.ts` (`ajuda, arvore, medir, medirUi, painel, parametros, solido, transformar, ferrA, ferrB, worker`) e foram apagados; funções de formato ficaram em `features/medir-formato.ts` e `cotas-formato.ts`; `textos.test.ts` agora exclui só `src/textos.ts` | ✅ | 229 testes do app, 0 falhas |
| 3. Gizmo `W`: `gizmo.ts` (pega alça, arrasta seta/anel, puro), `gizmo3d.ts` (desenho), ligado em `solido.ts`; tecla `W` (linha vazia) e comando `W` | ✅ lógica; **arraste real com mouse não testado** | `features-gizmo` (12); browser: `__3dm.solido.gizmo(true)`, `gizmoArrasta('seta','X',7)` → feature `tr1`, bbox +7 |

Browser pane (via `__3dm`): mudar `H` 30→40 move a tampa de z 27..32 para 37..42, todas as features ok.

**Workers Haiku:** 2 (teste do exemplo; gizmo). A migração de textos foi um **script Python** meu (mecânica determinística, mais segura que 11 edições manuais num arquivo só); sem worker.

**Checklist de mouse (orquestrador):** com a caixa selecionada e `W` ligado, clicar numa seta e arrastar move em 1 eixo (preview ao vivo), soltar cria `trN`; arrastar um anel gira; botão direito durante o arraste cancela; Ctrl arredonda (1 mm / 15°). Atenção: a ponta das setas usa o `mmPorPixel` do momento do `mostra` (não reescala ao dar zoom até a próxima atualização).

**Risco:** durante a migração apaguei `arvore-textos.ts` com `tipos`/`icones` fora do objeto exportado; reconstruí os dois a partir da especificação (conferir os rótulos na árvore).
