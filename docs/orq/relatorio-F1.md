# Relatório F1 — Sketch 2D

Manager F1 (Sonnet 5.5). Sem commit, sem push. Implementação por **17 execuções de worker Haiku** (16 tarefas + 1 retomada após o limite de API). Integração e revisão por mim: `main.ts`, `atalhos.ts`, `textos.ts`, `core/package.json` (exports), `vista.ts`, `linha/*`, `pilha.ts`, `projeto.ts`.

## Tarefas

| Tarefa | Estado | Check | Resultado |
|---|---|---|---|
| F1-01 Expressões | ✅ | `core/test/expr-expr.test.ts` | parser sem `eval`, ciclo, trig em graus |
| F1-02 Solver | ✅ | `sketch-solver.test.ts` (20 sketches), `sketch-ponte.test.ts` | 199 entidades: mediana ≈ 6 ms pela ponte documento→solver (meta 16 ms) |
| F1-03 Entidades e perfis | ✅ | `sketch-geometria`, `sketch-perfis` | regiões, furos, ilhas, pontas soltas, autointerseção |
| F1-04 Teclado e coordenadas | ✅ | `app/test/teclado-despachante.test.ts` (39), `teclado-coordenadas.test.ts` | cada linha da tabela §7.5 e a regra §7.3 incl. 2b |
| F1-05 Ferramentas | ✅ parcial | `sketch-ferramentas-a/b` | L PL REC C A POL SLOT PO XL. Sem fillet/centro/3 pontos no REC, sem círculo 2P/3P/TTR, sem arco tangente |
| F1-06 Auxílios | ✅ parcial | `sketch-snap`, `sketch-inferencia` | OSNAP (8 tipos), ORTHO (Shift inverte), POLAR, GRID/SNAP, inferência H/V/coincidente/ponto-na-curva/tangente (Shift suprime). **Faltam OTRACK (F11) e DYN (F12)** |
| F1-07 Edição | ✅ | `sketch-edicao`, `sketch-edicao2`, `sketch-editores` | M CO RO SC MI AR ARP E Q TR EX O F CHA e G/R/S |
| F1-08 Restrições | ✅ | despachante + `sketch-sessao` | barra, letra sozinha com desfazer sem undo, cor por estado |
| F1-09 Cotas | ✅ | `sketch-cotas`, `sketch-sessao` | DIM inteligente, `=L`, referência, temporárias com cadeado |
| F1-10 Seleção | ✅ parcial | `sketch-selecao`, `sketch-sessao` | clique/Shift, janela×cruzamento, Esc, Ctrl+A/Alt+A. `A` sozinho não seleciona tudo (ver decisões) |

`npm run build` e `npm test` na raiz passam (419 testes, 0 falhas).

## Critérios F1 (§1.2) → verificação

| Critério | Teste automático | Checklist |
|---|---|---|
| `REC` + `@80,50` desenha 80×50 | `sketch-sessao.test.ts` (REC por texto, com snap ligado) | B1 |
| `DIM` e mudar para `=L` | `sketch-sessao.test.ts` (`=L` + `definirParametro('L','100')` muda a geometria sem novo comando) | B3 |
| Sketch verde quando totalmente definido | `sketch-ponte`, `sketch-sessao` (`estado==='definido'`) | B3 (`--restricao-ok`) |
| H/V/I/T/E/B/D por letra; `TR`/`EX`/`DI` viram comando sem deixar restrição | `teclado-despachante.test.ts`; `sketch-sessao` (`desfazRestricao` → `desfazSemRefazer`) | B4 |
| Regra §7.3 sem conflito (REC, RO, SC, G/R/S+eixo) | `teclado-despachante.test.ts` (`R`,`E`,`C` → `REC`; `R`,`O`; `S`,`C`; `G X 5 Enter`) | B4, B5; uso real = H4 |
| TR/EX/O/F funcionam | `sketch-edicao2.test.ts`, `sketch-editores.test.ts` | B6 |
| Solver 200 entidades ≤ 16 ms; 20 sketches convergem | `sketch-ponte.test.ts`, `sketch-solver.test.ts` | — |

Verificado por mim no browser pane, via `__3dm` e sem mouse: REC por texto = 80×50; `FIX` + `DIM =L` + `DIM 50` → `definido`; `PARAM L 100` move p3 para (100, 50) e continua definido; `h` aplica e `r` desfaz sem redo, deixando `HR` na linha; `g x 5 Enter` move; a barra de ferramentas aparece; sem erro no console. **Não exercitei mouse real (pointer) nem o visual do desenho em detalhe.**

## Comandos de verificação

```
npm run build && npm test
node --test packages/core/test/sketch-ponte.test.ts        # imprime a mediana de 199 entidades
node --test packages/app/test/teclado-despachante.test.ts
```

## Checklist de verificação no navegador (orquestrador)

`window.__3dm.sketch` expõe `sessao` (API completa), `inspeciona()` (entidades, restrições, `estado`, `dof`, `culpadas`, `erros`, nº de `perfis`, `pontasSoltas`, `autointersecoes`, seleção, ferramenta, prompt), `tecla(key, {ctrl,alt,shift})` (passa pelo mesmo despachante do teclado real, sem precisar de `code` nem de numpad) e `executa(texto)` (linha de comando).

Cuidados:
- `executa('PARAM')` não resolve a promessa até as perguntas serem respondidas: não use `await` na 1ª chamada de um comando que pergunta.
- Se `localStorage['3dm.prefs'].teclasBlender` estiver `false` (⚙), G/R/S e as letras de restrição não valem.
- Depois de recarregar, o projeto é recuperado mas o sketch não está "ativo": rode `__3dm.sketch.sessao.entra()` (ou Tab).
- Para zerar: `__3dm.sketch.sessao.sai(); __3dm.projeto.substitui({formato:'3d-modeling',versao:1,unidade:'mm',impressora:'bambu-p2s',parametros:{},features:[],marcadorHistorico:null,aparencia:{}})`.

B1. **REC 80×50.** Digite `REC` Enter, `0,0` Enter, `@80,50` Enter. Esperado: prompts "Especifique o primeiro canto" e "canto oposto"; `inspeciona()` mostra 4 linhas, p3 = (80,50), 1 perfil; o retângulo aparece na vista (numpad 7 ou botão Topo). Por script: `executa('REC')`, `executa('0,0')`, `executa('@80,50')`.
B2. **Entrar/sair.** Tab (ou `__3dm.sketch.tecla('Tab')`) entra num sketch XY e alinha a vista ao plano; a barra de ferramentas aparece embaixo; Tab sai. `SK XZ` cria sketch no plano XZ e alinha a vista.
B3. **Cota, `=L`, verde.** `PARAM` `L` `80`. Selecione o ponto p1 (`sessao.seleciona(['p1'])` ou clique) e rode `FIX`; selecione l1 e `DIM`, digite `=L`; selecione l2 e `DIM`, digite `50`. Esperado: `inspeciona().estado === 'definido'` (linhas verdes); `PARAM` `L` `100` → 100×50 sem novo comando. `DIM` + `=X` (parâmetro inexistente) mostra "Parâmetro "X" não existe…". Clicar no número de uma cota reabre o `DIM`.
B4. **Letras e regra 2b.** Selecione uma linha inclinada; `h` → horizontal aplicada na hora (`restricoes` +1). Depois `r` → a restrição some sem refazer (`__3dm.projeto.podeRefazer === false`) e a linha de comando fica com `HR`. Idem `t`,`r` → `TR`; `e`,`x` → `EX`; `d`,`i` → `DI`. `l`, `c`, `o` com seleção vão direto para a linha. `Enter` depois de `h` confirma.
B5. **G/R/S.** Com seleção: `g`, `x`, `5`, Enter move 5 mm em X (um Ctrl+Z desfaz). `r`, `9`, `0`, Enter gira 90°. `s`, `2`, Enter escala 2. `r`,`e`,`c` → `REC` na linha. Esc cancela. Com mouse: depois de `g` o objeto segue o cursor e o clique confirma.
B6. **Edição.** `O` (distância, objeto, lado). `TR`: clique no trecho (Esc termina). `EX`, `F` (raio, duas linhas), `CHA`, `M`/`CO`/`RO`/`SC`/`MI`/`AR` (seleção antes, ou o prompt pede seleção + Enter), `E`/Del/`X` apagam (X confirma). `Q` alterna construção (tracejada, sem perfil).
B7. **Seleção.** Clique seleciona, Shift+clique soma, clique no vazio limpa, Esc limpa. Arrastar esquerda→direita = janela (contidos); direita→esquerda = cruzamento. Ctrl+A seleciona tudo, Alt+A limpa.
B8. **Perfis e erros.** 3 linhas abertas: `inspeciona().pontasSoltas.length === 2` e pontos vermelhos. Duas linhas cruzadas: `autointersecoes` não vazio.
B9. **Snap.** Com F3 ligado, o cursor sobre uma extremidade mostra o marcador e a dica "Extremidade". F8 trava horizontal/vertical (Shift inverte). F7/F9 grade e snap.
B10. **Tooltips.** Mouse sobre os botões da barra: "Retângulo — REC · Shift+A › Sketch".
B11. **375 px.** A barra de ferramentas quebra em linhas; sem linha de comando no celular, só barra e toque.

## Decisões

- **`A` sozinho vai para a linha** (alias de arco e de `AR`), não seleciona tudo: o §7.3 diz "toda letra sem seleção vai para a linha". `Ctrl+A` seleciona tudo, `Alt+A` limpa e há o comando `TUDO`. Se preferir `A` imediato, é uma linha no despachante (H4).
- Ferramentas e edições são máquinas de estado puras (`sketch/ferramenta.ts`, `editor.ts`); a sessão (`sketch/sessao.ts`) é testada em Node sem DOM; a camada DOM é fina (`desenho.ts`, `interacao.ts`, `barra.ts`).
- `editaSketch` guarda o antes/depois do sketch inteiro e resolve o solver no mesmo comando. As coordenadas guardadas são cache; a verdade são as restrições. O desenho usa `sketchResolvido` (clone resolvido): mudar `PARAM L` atualiza o sketch sem passar pelo undo.
- `editaSketch(..., {prender:true})` (mover/girar/escalar): os pontos movidos ficam fixos na solução. Sem isso o solver (mínima norma) espalhava o deslocamento pelo contorno livre.
- Estendi a pilha do F0 (`desfazSemRefazer`, 3 linhas) para a regra 2b. `criaSessao`/`criaLinha` ganharam um "desvio" opcional: enquanto há ferramenta ativa, a linha de comando alimenta a ferramenta. `vista.ts` ganhou `noPlano`, `paraTela`, `alinhaAoPlano`, `canvas`, `mmPorPixel`.
- `=L` é só sintaxe de digitação; o documento guarda `"L"`. Ângulo em graus no documento.
- `FIXAR` (`FIX`) fixa os pontos selecionados; o app não fixa a origem sozinho.
- Textos novos em `textos.ts`: `T.ferr`, `T.ed`, `T.sk`, `T.teclado`. Mensagens lançadas pelo core (expr, ponte, edição) estão em pt-BR no próprio core; a UI as repete na linha de comando.

## Pendências e riscos

- OTRACK (F11) e DYN (F12) não implementados (os botões só alternam). Opções de REC (fillet/centro/3 pontos), círculo 2P/3P/TTR, arco tangente e "Desfazer" segmento da polilinha (só recua o estado) ficaram de fora.
- Não feitos: entrada no sketch por duplo clique na árvore, F1 (cartão de atalhos), Ctrl+K, arquivo de aliases editável (§7.6), pré-seleção por destaque com ferramenta ativa. Cotas temporárias cobrem só pontos e comprimento de linha.
- `H`/`Alt+H`/`Shift+H`, `Shift+A`, `Shift+D` e G/R/S fora do sketch: o despachante já emite as ações e está testado; a ação é vazia até a F2.
- Origem não é fixa por padrão: para o sketch ficar verde é preciso `FIX` num ponto (ou cota de posição). Sugestão: fixar o primeiro ponto desenhado em (0,0).
- Risco: tangência é quase-singular (~1e-4 mm). `diagnosticarConflito` é O(m) resoluções (só sob demanda).
- Dependência nova: nenhuma. `packages/core/package.json`: acrescentei `exports` `./expr` e `./sketch`; conferir se F2/F3a mantiveram.
- `dist/` foi regenerado pelo build.
- Mouse real e visual detalhado: ver B1–B9.

## Workers usados (17 execuções Haiku)

expr · despachante · coordenadas · ponte solver↔documento · geometria+perfis · edição básica · comandos de undo do sketch · ferramentas L/PL/REC/PO/XL · ferramentas C/A/POL/SLOT (+1 retomada) · snap+inferência · seleção+cotas · aparar/estender/offset/fillet/chanfro · tabela de editores · sessão do sketch · desenho THREE e rótulos · transformação G/R/S e ações. O solver foi promovido por cópia do spike (`cp`), sem worker.

---

## Rodada 2

`npm run build` e `npm test` passam (523 testes, 0 falhas). 6 workers Haiku (origem, OTRACK+DYN, REC/polilinha, círculo/arco, ajuda/busca/aliases) + correção do bug feita por mim (pequena).

| # | Item | Estado | Check |
|---|---|---|---|
| 1 | **Bug 2b (perda de dados)** | ✅ | A sessão guarda os comandos que ELA aplicou (`restrLetra`) e `pilha.desfazSemRefazer(so)` só desfaz se esse comando for o topo da pilha. Letra que não aplicou nada (`t`, `e`, `d` com uma linha) não desfaz coisa alguma. Testes novos em `sketch-sessao.test.ts` (sem restrição aplicável; com PARAM antes; depois de confirmar). Reproduzi o roteiro do orquestrador no browser: `L 0,100 @30,20`, selecionar, `t`, `r` → entidades 12→12 |
| 2 | Origem fixa | ✅ | `criarSketch` cria `p0` (0,0) + restrição `r0` fixa (`ORIGEM` em `tipos.ts`). Visível, entra no OSNAP e na inferência `coincidente`; `apagar`, `mover`, `girar`, `escalar`, `copiar` e `removeRestricao('r0')` a respeitam. Browser: `REC 0,0 @80,50` + `DIM 80` + `DIM 50` → `definido`, dof 0, sem `FIX`. Efeito: uma linha com ponta na origem não anda com G/R/S (ponto preso) |
| 3 | DYN (F12) e OTRACK (F11) | ✅ | `core/sketch/otrack.ts` (guias H/V a partir de pontos adquiridos, interseção H×V; só vale onde o OSNAP não tem candidato) e `app/sketch/dyn.ts` (caixas Comprimento/Ângulo junto ao cursor; Tab foca o próximo campo; Enter envia `@c<a` ou distância direta pela mesma entrada da linha). Testes puros; DOM só em browser |
| 4 | Opções de F1-05 | ✅ | REC: Centro, 3Pontos (girado, perpendicular/paralela), Fillet e Chanfro nos cantos; círculo 2P, 3P, TTR (linha×linha, linha×círculo) e Diâmetro; arco Tangente à última linha; Desfazer da polilinha desfaz o segmento de verdade (`Passo.desfazUltima` → `projeto.desfaz()`). Textos novos em `sketch/ferr-textos.ts` e `ferrb-textos.ts` (nomes terminam em `textos.ts`, que o teste de textos permite) |
| 5 | §6.17/§7.6 | ✅ (sem teste de DOM) | F1 abre o cartão pesquisável; Ctrl+K a busca de comando (↑↓ Enter); Preferências → Aliases (textarea, Aplicar, Restaurar padrão; formato `L, *LINHA`, `;` comenta, última definição vale; salvo em `localStorage['3dm.aliases']`). Testes: `linha-aliases.test.ts`, `ajuda-dados.test.ts`, `registro.test.ts`. Tooltips: barra do sketch segue "nome — alias · atalho"; os botões do F0 já têm dica com atalho (ex.: "Vista frontal (Numpad 1)"), não reescrevi todos |

### Checklist de browser — rodada 2

R1. **Bug 2b.** `L`, `0,100`, `@30,20`, Esc; clicar na linha nova; `t` e `r` (`__3dm.sketch.tecla('t')`, `tecla('r')`): a linha continua, `__3dm.projeto.podeRefazer` inalterado, a linha de comando fica com `TR`. Com `PARAM L 100` feito antes, ele não é desfeito.
R2. **Origem.** Tab cria sketch: há um ponto em (0,0) (laranja, `inspeciona().entidades[0].id === 'p0'`). `REC 0,0 @80,50` + `DIM` em duas linhas deixa `estado === 'definido'` e verde. Selecionar p0 e apagar (Del) não remove.
R3. **DYN.** F12 ligado, `L`, clicar o 1º ponto, mover o cursor: aparecem as caixas Comprimento e Ângulo com os valores ao vivo. Tab foca a caixa, digitar `50` Enter cria a linha de 50 na direção do cursor; `50` Tab `30` Enter cria `@50<30`.
R4. **OTRACK.** F11 ligado, `L`, passar o cursor sobre um canto do retângulo e depois afastar em horizontal/vertical: aparece a guia tracejada e o ponto "gruda" nela; duas guias cruzadas dão a interseção. Com OSNAP ligado, uma extremidade tem prioridade.
R5. **REC e círculo.** `REC` mostra `[Centro/3Pontos/Fillet/Chanfro]`: `F` `5` (raio) depois 2 cantos gera cantos arredondados com arcos tangentes; `C` mostra `[2P/3P/TTR]`; `A` mostra `[Tangente]` depois de desenhar uma linha. Polilinha: `L` 3 pontos, `D` (Desfazer) apaga o último segmento (Ctrl+Y não o traz de volta como segmento do comando em andamento).
R6. **Ajuda.** F1 abre o cartão de atalhos; digitar "aparar" filtra; Esc fecha. Ctrl+K abre a busca; digitar "ret" + Enter inicia o retângulo.
R7. **Aliases.** ⚙ → Aliases: escrever `RR, *RETANGULO`, Aplicar → "1 alias aplicado."; digitar `RR` inicia o retângulo. Linha sem `*` aparece como erro e as válidas valem.

### Decisões e pendências da rodada 2
- O aviso de acento em `src/worker/cliente.ts` (F2) apareceu e sumiu: não é meu.
- Aliases removidos do texto continuam ativos até recarregar (o registro só ganha, não perde).
- TTR: círculo×círculo não suportado; tolerância de clique do TTR é 2 mm fixa. Fillet/Chanfro do REC ignoram snap por ref (usam só a posição).
- Letra `c` no REC casa com Centro; para Chanfro use a palavra inteira.
- Não mexi no despachante G/R/S fora do sketch.
