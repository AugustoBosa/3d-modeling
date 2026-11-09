# Relatório F3b — Impressão na UI

Sem commit, sem push. `npm run build` ok; `npm test` 746 testes, 0 falhas (o teste de desempenho do solver, `sketch-solver` #10, é sensível a carga: falhou uma vez com 3 processos em paralelo e passa isolado).

## Tarefas

| Tarefa | Estado | Check |
|---|---|---|
| F3b-01 Painel Imprimir (filamento, achados, massa, STL/3MF, Cancelar, "exportar mesmo assim", nome `<projeto>-<corpo>-<impressora>`) | ✅ | `imprimir-ui-modelo`, `imprimir-ui-exportar`, `export-montar`; browser via `__3dm.imprimir.exporta` (3MF 6,8 kB, 2 STL) |
| F3b-02 Orientação (modo inclinação, `LF`, `SOLTAR`, `CENTRAR`) como feature de transformação | ✅ lógica e comandos; **clique real em `LF` e visual do overlay não verificados** | `imprimir-orientacao` (inclui regeneração com o kernel), `imprimir-ui-overhang`; browser: `CENTRAR`/`SOLTAR` movem a tampa para z 0..5, centro da mesa |
| F3b-03 Cor + slot AMS por corpo (propriedades) e tabela de slots (navegador) → 3MF | ✅ | `imprimir-projeto`, `export-montar` (cor da tabela vence; slot 2 no `model_settings.config`) |
| F3b-04 Miniatura PNG iso no 3MF | ✅ (`vista.capturaIso`; `miniaturaFalhou:false` no browser) | `export-montar`/`export-3mf` (presença no zip) |
| F3b-05 Importar STL/3MF/OBJ (referência) e SVG → sketch | ✅ lógica | `importar-malha`, `importar-svg`, `importar-classifica`; seletor e arrastar não exercitados com mouse |
| F3b-06 `TEXTO` (opentype.js sob demanda, fonte Roboto) | ✅ | `texto-texto`; browser: `TEXTO` gera sketch + extrusão fechada |
| F3b-07 Modo customizar (expostos, link `#customizar&projeto=<https>&L=90`, aviso de origem, schema, 375 px) | ✅ | `customizar-schema`, `customizar-modo`; browser: `#customizar&L=93&parede=3` → L=95 (ajustado ao passo), parede 3, aviso; 375 px sem rolagem horizontal |
| Recentes + File System Access | ✅ lógica | `arquivos.test.ts` (só `ordenaRecentes`); DOM/FSA só na checklist |
| `__3dm.imprimir` + 3MF finais do exemplo | ✅ | `export-montar` gera `caixa-com-tampa-bambu-p2s.3mf` (2 objetos, slots 1 e 2) e `caixa-com-tampa-anycubic-i3-mega-s.3mf` em `packages/core/test/saida/` |
| `paridade-mcp.md` | ✅ | leitura |

## Verificação
```
npm run build
npm test
node --test packages/core/test/export-montar.test.ts   # regenera os 3MF de H2
```
Browser (sem mouse), em `http://localhost:5173/`:
- `await __3dm.imprimir.exporta('3mf')` → `{arquivos:[{nome,bytes,hash}], achados, bloqueado, miniaturaFalhou}` (padrão `semDownload`); `'stl'`, `'stl-tudo'`; opção `{ignoraBloqueio:true}`.
- `__3dm.imprimir.inspeciona()` → achados, massa, filamento, último export, overhang, slots, expostos.
- `__3dm.sketch.executa('SOLTAR' | 'CENTRAR')` com corpo selecionado (`__3dm.solido.seleciona(['ex2'])`); `__3dm.imprimir.overhangLigado(true)`.
- `__3dm.sketch.executa('TEXTO Oi')`, depois `executa('8')` e `executa('2')` (o texto consome todos os argumentos da linha).
- URL `http://localhost:5173/#customizar&L=93&parede=3` (o exemplo agora tem `expostos` L, W, H, parede).

## Checklist de mouse/navegador (orquestrador)
1. Aba Imprimir abre a seção; trocar o filamento recalcula achados e massa. Com TPU na Mega S aparece o aviso Bowden.
2. Botões STL/3MF baixam arquivos com nome `caixa-com-tampa-<corpo|todos>-<impressora>`. Cancelar durante a geração interrompe (reinicia o worker). Corpo aberto (forçar com booleana vazia): bloqueio + "Exportar mesmo assim".
3. Propriedades do corpo: seletor de cor e slot (1..4 na P2S, só 1 na Mega S) mudam o 3MF.
4. Orientação: "Mostrar inclinação" pinta overhang (verde → vermelho); "Apoiar na face" + clique numa face gira e apoia; Esc cancela.
5. Importar: botão ou arrastar um STL/3MF/OBJ/SVG sobre a vista; referência cinza translúcida; `LIMPAREF` remove.
6. Arquivo ▸ Salvar como/Abrir (Chrome: diálogo nativo; Firefox: download/input) e a lista de recentes no menu.
7. Customizar: `CUSTOMIZAR` na linha ou o link; sliders e lista regeneram; "Sair do modo customizar".
8. H2: abrir os 2 `.3mf` de `packages/core/test/saida/` no Bambu Studio e no PrusaSlicer.

## Workers Haiku: 14
1 importar STL/OBJ/3MF; 2 comandos de projeto (filamento, slots, expostos, validação); 3 orientação; 4 SVG + polilinhas→sketch; 5 texto (opentype); 6 `exporta()` do core + 3MF de exemplo; 7 schema do customizar; 8 exportador do app; 9 painel Imprimir + slots (DOM); 10 modo inclinação (overlay); 11 UI do customizar; 12 UI de importar/TEXTO; 13 recentes/FSA. (Mais os 4 da F3a, já reportados.) Eu escrevi: tipos, `textos.ts` (namespaces `imprimir`, `orient`, `importar`, `texto`, `customizar`, `recentes`), `orientacao-ui.ts`, a integração em `main.ts`, `paineis.ts`, `topo.ts`, e os hooks em `solido.ts` e `vista.ts` (`capturaIso`).

## Decisões
- **Parsers próprios no core** (STL/OBJ/3MF/SVG), em vez dos loaders do `three/examples`: ficam testáveis no Node e valem no headless. Sem texto de loader do three.
- **Referência importada não entra no documento nem no export** (só visual, sessão). Persistir malha no `.3dm.json` exigiria uma feature de kernel (F2).
- **Texto = sketch + extrusão**, não feature nova: reaproveita todo o pipeline. Roboto 400 (OFL) via `@fontsource/roboto` (dependência fora da lista §0.5: justificada por trazer a licença junto e carregar sob demanda; o chunk `texto` tem 68 kB gzip e só carrega no comando). opentype.js 2.0 quebrou com `getPath` multi-caractere em Roboto (GSUB): desenha caractere a caractere com kerning, sem ligaduras.
- **Export fino**: `geo.pede(doc, 0.01)` no mesmo worker; Cancelar = `reinicia()` (perde o cache; a prévia recomputa). O hash do export é determinístico (mesmos bytes).
- **Documento**: campos opcionais `filamento`, `slots`, `expostos`, `aparencia[id].slot` (com validação); `definirCorCorpo` agora preserva o slot (1 linha em `features/comandos.ts`).
- **Customizar por link**: nunca sobrescreve o projeto salvo (sem autosave nesse modo); só `https` (ou localhost); documento remoto validado por schema e rejeitado se tiver `__proto__`/`constructor`; nada é executado.
- Edições fora da posse: `examples/caixa-com-tampa.3dm.json` ganhou `expostos` (L, W, H, parede); `solido.ts`/`vista.ts` receberam os hooks citados.

## Pendências e riscos
- `W`/`LF` e todo o DOM de painéis foram verificados por JS, não por mouse. O overlay de inclinação não foi visto na tela.
- `valoresOriginais` do customizar usa `substitui` (zera o undo). `T.customizar.linkLocal` não é usado. O "exportar mesmo assim" do painel depende de `bloqueio` real; forçado só no teste.
- Cancelar o export reinicia o worker: a próxima prévia é fria (~40 ms no exemplo).
- `capturaIso` enquadra o volume inteiro da mesa; a peça pode ficar pequena na miniatura.
- Um 3MF só com corpos abertos exporta só com "mesmo assim". O slot AMS só entra no 3MF Bambu/Prusa (core ignora).
- O console mostrou `WebSocket ... 127.0.0.1:47800 failed`: é a ponte do F4 tentando conectar, não é daqui. `npm install` atualizou o lock (fontsource no app).
- O teste `sketch-solver` #10 (≤ 16 ms/iter) é flaky sob carga (F1).
