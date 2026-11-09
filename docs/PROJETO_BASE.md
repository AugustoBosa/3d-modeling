# 3d-modeling — Documento Base do Projeto

| | |
|---|---|
| **Status** | Rascunho v0.4 — rodadas 1–3 aplicadas (Q1–Q17 → D15–D31) |
| **Data** | 2026-11-08 |
| **Repositório (futuro)** | `github.com/AugustoBosa/3d-modeling` (público, MIT) |
| **Site (futuro)** | `https://augustobosa.github.io/3d-modeling/` |
| **Próximo passo** | Revisar este documento → gerar plano de execução em sessão nova, com contexto limpo |

**Como ler:** §1–§3 dizem o que é e para quê. §4 diz o que herdamos dos projetos anteriores. §5–§7 descrevem o programa em detalhe. §8–§9 trazem a pesquisa de mercado e as licenças. §10–§14 são desempenho, fases, DoD, testes e riscos. §15 lista o que ainda está aberto. Itens marcados **[VERIFICAR]** vêm de fonte secundária ou de estimativa e precisam de teste.

---

## Sumário

1. Visão e objetivos
2. Decisões já tomadas
3. Máquinas disponíveis (base do MVP)
4. Herança dos projetos anteriores
5. Arquitetura
6. Funcionalidades em detalhe
7. Mapa de atalhos e comandos (AutoCAD / Blender / Revit)
8. Pesquisa: projetos semelhantes
9. Licenças e dependências
10. Orçamentos de desempenho
11. Roadmap por fases
12. Definition of Done (DoD)
13. Testes e verificação
14. Riscos
15. Questões em aberto
16. Regras do projeto (CLAUDE.md, graphify, git)
17. Estrutura de pastas proposta
18. Fontes

---

## 1. Visão e objetivos

### 1.1 O que é

Uma ferramenta de **CAD paramétrico** que roda **no navegador**. Ela serve para modelar peças funcionais com **medidas exatas** e gerar arquivos prontos para **impressão 3D FDM** (STL e 3MF com perfil da impressora).

- Roda no GitHub Pages. Não tem servidor nem login.
- Tem um **servidor MCP** local. Com ele, o usuário modela por prompt no Claude Code. Exemplo: "usando o 3d modeling crie uma caixa de 80×50×30 mm com parede de 2 mm e tampa com encaixe".
- Os comandos e atalhos imitam **AutoCAD, Revit e Blender**, para aproveitar a memória muscular do usuário.

### 1.2 Problema que resolve

| Hoje | Com o 3d-modeling |
|---|---|
| Tinkercad é fácil, mas impreciso e só usa malha | Sketch com cotas e restrições → sólido paramétrico |
| Fusion e Onshape são potentes, mas pesados, com licença restrita ou documentos públicos | Ferramenta própria, aberta, leve, offline-friendly |
| Cada peça exige ajustar folgas na mão, por impressora | Perfis de impressora e calibração aplicados no modelo |
| Não dá para modelar por prompt com feedback visual | MCP com ferramentas tipadas + captura de tela para o agente conferir |

### 1.3 Objetivos (em ordem de prioridade)

1. **Precisão:** toda medida é editável e exata, em mm.
2. **Facilidade:** quem usa AutoCAD, Revit ou Blender opera sem ler manual.
3. **Imprimível por padrão:** o export só sai com malha fechada e dentro do volume da impressora, ou mostra aviso explícito.
4. **Prompt-first também:** tudo que a UI faz, o MCP também faz.
5. **Desempenho:** as premissas do modular terrain (§4.3) valem aqui.

### 1.4 Não-objetivos (MVP)

- Escultura e malha livre (modo Blender de edição de vértices).
- Fatiamento e G-code. O usuário continua usando Bambu Studio e PrusaSlicer.
- Contas, nuvem, colaboração e galeria.
- Modelagem completa no celular. No celular só visualiza, mede e exporta.
- STEP e fillet 3D real ficam para a fase OCCT (F7).

---

## 2. Decisões já tomadas

| # | Decisão | Escolha | Origem |
|---|---|---|---|
| D1 | Paradigma | **Paramétrico + sketch 2D** (sketch com cotas e restrições → extrude/revolve; histórico editável) | Usuário, 2026-11-08 |
| D2 | Saída MVP | **STL + 3MF com perfil da impressora**. Fatiar no slicer de sempre. G-code no futuro | Usuário |
| D3 | MCP | **Servidor MCP local (Node) + ponte WebSocket** com a aba aberta. Também roda **headless** e gera arquivos direto | Usuário |
| D4 | Público | **Uso pessoal, repo público, MIT**. Sem login. Projetos salvos localmente | Usuário |
| D5 | Kernel | **manifold-3d no MVP**. **OpenCascade (replicad) depois**, carregado sob demanda, para fillet 3D e STEP | Usuário |
| D6 | Mobile | **Desktop-first.** No celular: abrir, orbitar, medir, exportar | Usuário |
| D7 | Nome | **3d-modeling** | Usuário |
| D8 | Impressoras MVP | **Anycubic i3 Mega S** + **Bambu Lab P2S** | Usuário |
| D9 | Visual e desempenho | Herdar do modular terrain (RPG Block Builder) | Usuário |
| D10 | Grafo | graphify **sem LLM** (só AST), atualizado a cada commit por regra do projeto | Usuário |
| D11 | UX | Entre duas mecânicas parecidas, escolher a que imita AutoCAD, Revit ou Blender | Usuário |
| D12 | Stack | TypeScript + Vite + three.js + manifold-3d, o mesmo do terrain | Herança (proposta) |
| D13 | Eixo "para cima" | **Z para cima** (igual ao terrain, Blender, Revit e à vista de planta do AutoCAD) | Proposta |
| D14 | Unidade | **mm**. Exibição com 2 casas e entrada aceita expressões | Proposta |
| D15 | Navegação (Q1) | **Ajustável nas Preferências.** Padrão inicial = Blender (meio orbita, Shift+meio faz pan) | Usuário, rodada 1 |
| D16 | Tecla `E` (Q2) | **Por contexto:** no sketch, `E`+Enter = Apagar (AutoCAD); no sólido, `E`+Enter = Extrudar. Del/X apagam sempre | Usuário, rodada 1 |
| D17 | Desenho técnico (Q3) | Folhas exportáveis ficam na **F5**, fora do MVP. O MVP tem cotas 3D e painel de vistas 2D | Usuário, rodada 1 |
| D18 | Grafo no git (Q4) | **Versionar** `graphify-out/graph.json` + `GRAPH_REPORT.md` | Usuário, rodada 1 |
| D19 | MCP (Q5) | Pacote **`3d-modeling-mcp`**, porta **47800** (configurável por variável de ambiente `MODELING_MCP_PORT`) | Usuário, rodada 1 |
| D20 | Idioma (Q6) | **pt-BR**, com todos os textos centralizados em `packages/app/src/textos.ts` para tradução futura | Usuário, rodada 1 |
| D21 | Filamentos (Q7) | **PLA, PETG, TPU, ABS/ASA** já no MVP (§3.4) | Usuário, rodada 1 |
| D22 | Modo customizar (Q8) | **Entra no MVP** (F3, §6.16) | Usuário, rodada 1 |
| D23 | Multicor/AMS (Q9) | **Entra no MVP** (F3, §6.10): cor por corpo → slot do AMS no 3MF da P2S | Usuário, rodada 1 |
| D24 | Tema claro (Q10) | **Entra no MVP** (F0): tokens com tema escuro (padrão) e claro | Usuário, rodada 1 |
| D25 | Teclado (Q11) | **Regra de desambiguação da §7.3 aprovada.** Validar com uso real na F1. Preferência permite desligar as teclas imediatas | Usuário, rodada 2 |
| D26 | Filamento padrão (Q12) | **PLA** nas duas impressoras | Usuário, rodada 2 |
| D27 | Paleta do tema claro (Q13) | Desenhada na **F0** e aprovada por captura de tela | Usuário, rodada 2 |
| D28 | Origem do link do modo customizar (Q14) | **Qualquer URL https**, com aviso de origem antes de abrir. O `.3dm.json` é só dados, sem código executável, e é validado por schema | Usuário, rodada 2 |
| D29 | Escopo do MVP (Q15) | **Mantém tudo** (19–27 sessões). Se a F3 estourar, o **AMS é o primeiro a sair** do MVP | Usuário, rodada 2 |
| D31 | Restrições do sketch (Q17) | **Letra sozinha, estilo Onshape** (H, V, I, T, E, B, D), com seleção no sketch. A colisão com a linha de comando é resolvida pela mesma regra do G/R/S (§7.3, item 2b): a restrição é aplicada na hora, e se a próxima tecla for outra letra ela é desfeita e o texto vira comando (`T`→`R` = `TR`) | Usuário, rodada 3 |
| D30 | Atalhos (Q16) | Conferidos por agente nas docs oficiais (Autodesk, Blender, Onshape). Resultado na §7.5 | Usuário, rodada 2 |

---

## 3. Máquinas disponíveis (base do MVP)

### 3.1 Anycubic i3 Mega S

Fonte: config do PrusaSlicer 2.9.6 embutida em `3dprinter_plotter/arquivo/testes-fisicos/pen_holder_mega_s.gcode`.

| Campo | Valor |
|---|---|
| Firmware | Marlin (versão não documentada) |
| Cinemática | Cartesiana, extrusor **Bowden** |
| Volume | **210 × 210 × 205 mm** (`bed_shape 0x0,210x0,210x210,0x210`, `max_print_height 205`) |
| Bico | 0,4 mm |
| Filamento | PLA 1,75 mm, densidade 1,24 |
| Temperaturas | Bico 215/210 °C (1ª camada/demais) · Mesa 65/60 °C |
| Camada | 0,2 mm (mín. 0,07, máx. 0,36) |
| Largura de extrusão | 0,45 (perímetro/infill), 0,42 (1ª camada) |
| Padrão de peça | 3 perímetros, 5 topo, 4 base, 25% infill, sem suporte |
| Retração | 6 mm a 40 mm/s (Bowden) |
| Velocidades | 1ª camada 20, perímetro 50, infill 60, viagem 180 mm/s |
| Slicer | PrusaSlicer 2.9.6, perfil customizado (`PRINTER_MODEL_I3_MEGA_S`) |
| Nivelamento | Sem G29, só `G28` |
| Tolerância medida | Nenhuma calibração de encaixe registrada. Só a dica de **~1 mm de folga** no gancho de caneta (modelo Thingiverse 4795272) |
| Outro uso | Também é **plotter de caneta** (projeto `3dprinter_plotter`). Isso não entra neste escopo |

### 3.2 Bambu Lab P2S

Fonte: varejistas e reviews (ver §18). **[VERIFICAR]** na página oficial e no perfil do Bambu Studio.

| Campo | Valor |
|---|---|
| Firmware | Bambu (fechado) |
| Cinemática | **CoreXY**, fechada (com filtro de carvão, sem aquecimento ativo da câmara) |
| Volume | **256 × 256 × 256 mm** |
| Bico | 0,4 mm de fábrica. Aceita 0,2 / 0,6 / 0,8 |
| Temperaturas | Bico até 300 °C · Mesa até 110 °C |
| Mesa | PEI texturizada, chapa magnética removível |
| Multimaterial | Compatível com AMS (no combo) |
| Slicer | Bambu Studio (ou OrcaSlicer) |
| Tolerância medida | Nenhuma ainda. Calibrar na F6 |

### 3.3 Modelo de dados de impressora (MVP)

Cada impressora vira um JSON versionado em `packages/core/printers/`:

```jsonc
{
  "id": "anycubic-i3-mega-s",
  "nome": "Anycubic i3 Mega S",
  "volume": { "x": 210, "y": 210, "z": 205 },     // mm
  "formaMesa": "retangular",
  "bicos": [0.4],
  "bicoPadrao": 0.4,
  "filamentoPadrao": "pla",                        // D26
  "slicer": "prusaslicer",                          // define o "sabor" do 3MF
  "camada": { "padrao": 0.2, "min": 0.07, "max": 0.36 },
  "regras": {                                       // usadas na verificação de imprimibilidade
    "paredeMin": 0.8,          // 2 × largura de extrusão (0,4) [VERIFICAR]
    "detalheMin": 0.4,         // ≈ diâmetro do bico
    "overhangMax": 45,         // graus a partir da vertical
    "pontesMax": 10            // mm sem suporte [VERIFICAR]
  },
  "calibracao": null           // preenchido na F6 (ver §6.12)
}
```

> Regra: o volume e o bico vêm do perfil. As **folgas não** vêm do perfil: elas vêm da **calibração** (impressora + bico + filamento), que é um registro separado e referenciado pelo perfil (§6.12).

### 3.4 Filamentos (MVP: PLA, PETG, TPU, ABS/ASA)

Cada filamento é um JSON em `packages/core/filaments/`. Os valores abaixo são **típicos de mercado [VERIFICAR]**, não medidos. As regras alimentam a verificação de imprimibilidade (§6.10) e as folgas padrão até existir calibração (§6.12).

| Filamento | Densidade (g/cm³) | Bico / mesa (°C) | Overhang máx. sugerido | Folga padrão de encaixe deslizante | Observações para o CAD | Mega S | P2S |
|---|---|---|---|---|---|---|---|
| **PLA** | 1,24 | 200–215 / 55–65 | 45° | 0,20 mm | Referência. Pouco encolhimento | ✅ | ✅ |
| **PETG** | 1,27 | 230–250 / 70–85 | 40° | 0,25 mm | Fios (stringing), cola na mesa; pontes piores que PLA | ✅ | ✅ |
| **TPU 95A** | 1,21 | 210–230 / 40–60 | 35° | 0,30 mm | Flexível: paredes ≥ 1,2 mm; evitar detalhes finos; Bowden (Mega S) imprime mal e devagar | ⚠️ aviso | ✅ (só fora do AMS **[VERIFICAR]**) |
| **ABS / ASA** | 1,04 / 1,07 | 240–260 / 90–110 | 45° | 0,25 mm | Encolhe ~0,5–0,8%: aplicar compensação XY; empena em peças grandes; precisa de câmara fechada | ⚠️ aviso (aberta) | ✅ (fechada) |

```jsonc
{ "id": "petg", "nome": "PETG", "densidade": 1.27,
  "temp": { "bico": [230, 250], "mesa": [70, 85] },
  "regras": { "overhangMax": 40, "paredeMin": 0.8, "encolhimentoXY": 0.0,
              "folgaPadrao": { "justo": 0.15, "deslizante": 0.25, "livre": 0.40 },
              "requerCamaraFechada": false, "flexivel": false },
  "compat": { "anycubic-i3-mega-s": "ok", "bambu-p2s": "ok" } }
```

- **Compatibilidade impressora × filamento** gera aviso (⚠️), não bloqueio.
- As folgas padrão do filamento valem até a calibração (F6) substituí-las por valores medidos.
- O filamento escolhido define a massa estimada, as regras de verificação e o filamento sugerido no 3MF.

---

## 4. Herança dos projetos anteriores

### 4.1 Do `modular_terrain_system` (RPG Block Builder) — **base visual, de desempenho e de processo**

**Stack herdada:**

| Camada | Tecnologia | Versão no terrain |
|---|---|---|
| Linguagem | TypeScript strict, ES2022, `moduleResolution: bundler` | 7.0.2 |
| Render | three.js (`OrbitControls`, `ViewHelper`, `CSS2DRenderer`, `toCreasedNormals`) | 0.187.0 |
| CSG | manifold-3d (WASM, Apache-2.0) | 3.5.4 |
| Redução de malha | meshoptimizer | 1.3.0 |
| Build | Vite (worker em formato `es`, por causa do top-level await do WASM) | 8.3.6 |
| CLI | tsx | 4.23.15 |
| UI | **Sem framework.** DOM à mão, `<details>` nativo | — |
| Deploy | `.github/workflows/pages.yml` (Node 22, `npm ci`, `build --base=./`, `deploy-pages@v4`) | — |

**Módulos reaproveitáveis** (caminhos relativos a `modular_terrain_system/web/src/`):

| Arquivo | Reuso no 3d-modeling |
|---|---|
| `vista.ts` | Base do viewport: renderer, câmera, luzes, gizmo, modos de vista (sólido, matcap, inclinação, normais), plano de corte, transparência, `dispose()` |
| `cotas.ts` | Cotas 3D (linhas + rótulos CSS2D, oclusão) → cotas do modelo e temporárias |
| `esquema.ts` | Desenho técnico SVG (planta, frontal, lateral, isométrica, hachura, tracejado) → folhas técnicas (F5) |
| `cliente.ts` + `gera.worker.ts` | Fila de workers com cancelamento → regeneração da árvore de features |
| `bloco.ts` → `fechada()`, `stl()` | Checagem de malha fechada e escrita de STL binário |
| `esferas.ts` | Ícones dos modos de sombreamento (canvas) |
| `main.ts` → `controle`, `grupo`, `secao`, `segmentos`, `campo`, `cartao`, `previa` | Helpers de UI. **Precisa extrair** antes de usar, porque mistura UI com orquestração |
| `index.html` `<style>` | CSS do tema escuro e do layout responsivo → vira `tokens.css` + `layout.css` |
| `cli.ts` | Padrão de geração headless com o mesmo código da web → base do modo headless do MCP |
| `ref_hashes.json` + `check_paredes.ts` | Padrão de teste: hash de STL de referência + checks sem framework |

### 4.2 Premissas visuais (valores reais do terrain)

**Tema:** o terrain só tem tema escuro. Aqui o **escuro é o padrão** e o **claro entra no MVP** (D24). Os tokens abaixo são os do tema escuro. O tema claro redefine os mesmos tokens em `:root[data-theme="light"]`, segue `prefers-color-scheme` e tem alternância manual (salva no localStorage). Proposta inicial do claro **[a desenhar na F0]**: fundo `#f4f5f7`, painel `#e9ebee`, texto `#1d1f22`, peça `#8f8a80`. Cores de eixo, cota e estado continuam iguais, com contraste conferido (WCAG AA).

**Tipografia:** `14px system-ui, sans-serif` (corpo) · 12 px (botões, rótulos) · 13 px `h3` em `#aab` · cotas 3D `11px sans-serif` (faixa 8–24 px) com `text-shadow: 0 0 3px #000`.

**Tokens de cor** (formalizar como variáveis CSS em `tokens.css`):

| Token proposto | Valor | Uso |
|---|---|---|
| `--bg` | `#1d1f22` | Fundo do app e da cena 3D |
| `--card` | `rgba(29,31,34,.92)` | Cards flutuantes sobre a vista |
| `--painel` | `#26292d` | Painéis laterais |
| `--borda` / `--borda-input` | `#444` / `#555` | Bordas |
| `--btn` / `--btn-txt` | `#3a3f45` / `#eee` | Botões e selects |
| `--ativo` / `--ativo-borda` | `#5a6b7d` / `#8aa` | Aba ou botão ativo |
| `--txt` / `--titulo` / `--nota` | `#ddd` / `#aab` / `#9a9` | Textos |
| `--aviso` / `--erro` | `#e9a35a` / `#ff5a4d` | Avisos e erros |
| `--ok` / `--atencao` | `#5fc16f` / `#e6c14a` | HUD de desempenho |
| `--peca` | `#b8b4ac` | Cor padrão do sólido |
| `--secao` | cor × 0,55 | Face cortada |
| `--aresta` | `#15171a` | Arestas (limiar 20°) |
| `--vertice` / `--destaque` | `#ffa31a` | Vértices, pré-seleção, snap |
| `--cota` | `#ffb000` | Cotas (3D e 2D) |
| `--eixo-x` / `-y` / `-z` | `#ff3653` / `#8adb00` / `#2c8fff` | Eixos, gizmo e planos |
| `--folha-bg` / `--folha-traco` | `#1b1d21` / `#e3e8ee` | Desenho técnico |
| `--simetria` | `#7d8590` | Eixos traço-ponto |

**Novos tokens** (o terrain não tem, o CAD precisa): `--selecao` (proposta `#4da3ff`), `--restricao-ok` (verde `#5fc16f`), `--restricao-sub` (sketch subdefinido, branco `#e3e8ee`), `--restricao-conflito` (`#ff5a4d`), `--grid-menor` / `--grid-maior` (cinzas sobre `--bg`), `--volume-impressora` (wireframe `#6f8fa8`, a cor de "grid" do terrain).

**Estilo de componentes:** `border-radius` 4 px (botão), 6 px (card), 8 px (dialog). `label` em grid `1fr 64px`. Seções em `<details>`. Cards sobre a vista com margem de 8 px e espaçamento de 6 px.

**Vista 3D:** `WebGLRenderer` com antialias e `localClippingEnabled`. DPR `min(devicePixelRatio, 2)` com teto do usuário (1×, 1,5×, 2×). Luzes: `HemisphereLight(#fff, #404040, 1.2)` + `DirectionalLight(#fff, 2)`. Câmera perspectiva FOV 35, com alternância para ortográfica (novo). Gizmo `ViewHelper` 128 px no canto inferior direito, com animação de 300 ms ao clicar num eixo. Material `MeshStandardMaterial` com roughness 0,9.

**Layout responsivo:** ≥ 1100 px: três colunas · até 1099 px: uma coluna, vista com 60 dvh · até 700 px: vista fixa com 42 dvh, alvos de toque maiores (fonte 16 px nos campos).

**Desenho técnico:** fundo `#1b1d21`, traço `#e3e8ee` 1,3 px, cotas `#ffb000` com halo, hachura 45° de 5 px, oculto tracejado, rodapé "cotas em mm · escala k:1". Projeção isométrica `x' = (x−y)·cos30°`, `y' = (x+y)·sen30° − z`.

### 4.3 Premissas de desempenho (do terrain)

1. **Orçamento de tempo, não de FPS.** Prévia com orçamento de **300 ms** (editável, 100–1500). HUD: verde até o orçamento, amarelo acima, vermelho acima de 1,5×.
2. **Debounce de 60 ms** nas atualizações.
3. **Geração pesada em Web Worker**, com fila e cancelamento (o pedido novo cancela o anterior). Só números e buffers transferidos entram e saem.
4. **Prévia ≠ export, mas o export é determinístico.** Hash de STL de referência no teste de regressão.
5. **Memória do WASM:** liberar sólidos intermediários do manifold depois de `getMesh` (lista `lixo`).
6. **`dispose()`** de geometria e material sempre que trocar.
7. **Custo da vista:** arestas e vértices desligados acima de 300 mil triângulos. Oclusão de cotas por caixa envolvente acima de 30 mil triângulos.
8. **Sem GPU para geometria:** a GPU não gera geometria, porque o float dela diverge da CPU.
9. Bundle do terrain: 823 kB JS + 541 kB WASM + 206 kB worker ("aceitável").

**Lacunas do terrain a corrigir aqui:** o CI não roda testes de malha · não há LICENSE · o `.gitignore` do graphify é contraditório (linha `graphify-out/` anula as exceções).

### 4.4 Do `3dprinter_plotter`

- **Dados da Mega S** (§3.1).
- **Padrão de projeto sem dependências:** JS puro, `node --test`, publicado no Pages.
- **Lição:** um perfil duplicado em dois lugares (`PERFIL_PADRAO` em `exportar.js` e `vpype.toml`) sai de sincronia. Aqui, **perfil de impressora tem fonte única** em `packages/core/printers/`.
- **Lição:** offset e calibração não medidos foram o "maior impacto real". Calibração precisa de fluxo próprio (F6), não de constante no código.

---

## 5. Arquitetura

### 5.1 Visão geral

```
┌──────────────────────────── Navegador (GitHub Pages) ────────────────────────────┐
│  app (UI, DOM à mão)                                                             │
│   ├─ viewport (three.js) ── cotas / gizmo / snap / seleção                       │
│   ├─ sketch editor ── solver de restrições (core)                                │
│   ├─ árvore de features + parâmetros                                             │
│   ├─ linha de comando (aliases AutoCAD)                                          │
│   └─ ponte MCP (WebSocket cliente → ws://127.0.0.1:PORTA, com token)            │
│        │                                                                          │
│  worker de geometria (core + manifold-3d WASM)  ←→  regeneração / export          │
└────────┼──────────────────────────────────────────────────────────────────────────┘
         │ WebSocket local (opcional)
┌────────┴──────────── Node local (npx 3d-modeling-mcp) ───────────────────────────┐
│  servidor MCP (stdio para o Claude Code)                                         │
│   ├─ modo ponte: repassa comandos para a aba aberta e recebe estado e capturas   │
│   └─ modo headless: usa o MESMO core + manifold em Node → grava .3dm.json/STL/3MF│
└───────────────────────────────────────────────────────────────────────────────────┘
```

**Princípio central:** existe um **único core** (`packages/core`), puro TypeScript sem DOM. Ele roda no worker do navegador e no Node (MCP headless e testes). A UI e o MCP só **editam o documento** e pedem **regeneração**. O padrão vem do terrain, onde `cli.ts` usa o mesmo código da web.

### 5.2 Documento do projeto (formato `.3dm.json`)

O documento guarda a **receita**, não a malha. A malha sempre é regenerada a partir da receita.

```jsonc
{
  "formato": "3d-modeling", "versao": 1, "unidade": "mm",
  "impressora": "bambu-p2s",                    // perfil ativo
  "parametros": {                               // estilo "User Parameters" do Fusion / parâmetros do Revit
    "L": { "expr": "80" }, "W": { "expr": "50" }, "parede": { "expr": "2" },
    "folga": { "expr": "calib.encaixe_deslizante" }   // vem da calibração (F6)
  },
  "features": [
    { "id": "sk1", "tipo": "sketch", "plano": { "base": "XY", "offset": 0 },
      "entidades": [ /* pontos, linhas, arcos, círculos */ ],
      "restricoes": [ /* coincidente, horizontal, distância = "L", ... */ ] },
    { "id": "ex1", "tipo": "extrude", "sketch": "sk1", "perfis": ["auto"],
      "distancia": "30", "direcao": "normal", "operacao": "nova" },
    { "id": "sh1", "tipo": "shell", "alvo": "ex1", "espessura": "parede", "abrir": ["topo"] }
  ],
  "marcadorHistorico": null,                    // rollback (estilo timeline do Fusion)
  "aparencia": { "ex1": { "cor": "#b8b4ac" } }
}
```

**Decisão importante — evitar o "problema de nomeação topológica":**
- O MVP usa kernel de malha (manifold), então faces não têm ID estável entre regenerações.
- Por isso, sketch em face **captura o plano** (origem + normal) no momento da criação, e não guarda o ID da face. Se a face mudar, o sketch fica no lugar e mostra aviso "plano de referência desatualizado → reancorar".
- Referências por aresta (fillet e chanfro em aresta específica) ficam para a F7 (OCCT/B-rep).

### 5.3 Kernel (MVP = manifold-3d)

| Operação | Como fazer com manifold | Fase |
|---|---|---|
| Perfis 2D | `CrossSection` (polígonos; arcos discretizados por tolerância cordal) | F1 |
| Extrude (simples, simétrico, até distância, com taper) | `CrossSection.extrude(h, nDiv, twist, scaleTop)` | F2 |
| Revolve | `CrossSection.revolve(segmentos, graus)` | F2 |
| Booleanas (unir, subtrair, interseção) | `add`, `subtract`, `intersect` | F2 |
| Primitivas (caixa, cilindro, esfera, cone, toro) | `cube`, `cylinder`, `sphere` + revolve | F2 |
| Padrão linear/circular, espelho | `translate` / `rotate` / `mirror` + `compose` | F2 |
| Fillet e chanfro **de canto do sketch** (arestas verticais) | Na geometria 2D, antes de extrudar | F1 |
| Chanfro e fillet de **borda topo/base** de extrusão | Extrusão em camadas com `CrossSection.offset` (aproximação discreta) **[VERIFICAR viabilidade]** | F2 |
| Shell de peça prismática | 2D: `offset` interno do perfil + extrusão menor + subtração | F2 |
| Shell genérico | Fica para OCCT | F7 |
| Furo (simples, escareado, rebaixado) | Revolve de perfil + subtração; diâmetro com compensação de calibração | F2 |
| Texto em relevo/baixo-relevo | opentype.js (MIT) → contornos → CrossSection → extrude | F3 |
| Corte por plano | `trimByPlane` / `split` | F2 |
| Fillet 3D em aresta qualquer, STEP | **replicad / OCCT sob demanda** | F7 |

Tolerância cordal padrão: 0,05 mm na prévia e 0,01 mm no export **[VERIFICAR custo]**.

### 5.4 Solver de restrições do sketch

- **Escolha:** solver **próprio, MIT**, Levenberg-Marquardt / Gauss-Newton sobre as variáveis (x,y dos pontos, raio).
  - O planegcs é LGPL e não cobre tangente e horizontal no README.
  - O libslvs (SolveSpace) é GPL-3 e está descartado.
- **Restrições do MVP:** coincidente, horizontal, vertical, paralela, perpendicular, tangente, igual, concêntrica, ponto-na-curva, simetria, fixa; dimensões de distância, distância horizontal/vertical, raio, diâmetro e ângulo.
- **Estado por cor:** subdefinido (branco), totalmente definido (verde), conflito (vermelho), como no Fusion e no SolidWorks.
- **Inferência automática ao desenhar** (como no Onshape e no AutoCAD): horizontal, vertical, coincidente e tangente, com **Shift para suprimir**.
- **Plano B:** se o solver próprio não ficar robusto até o fim da F1, trocar por planegcs como dependência dinâmica (o wasm fica separado, com aviso LGPL). O plano B fica registrado, mas não é implementado agora.

### 5.5 Workers e regeneração

- **Um worker de geometria** com `Fila` (reuso do `cliente.ts`). Cada edição: debounce de 60 ms → regenera **a partir da primeira feature alterada** (cache por feature, chave = hash das entradas).
- **Prévia** com tolerância cordal maior. O **export** usa tolerância fina, em worker separado, com botão Cancelar (padrão do terrain).
- O solver do sketch roda **na thread principal** enquanto o usuário arrasta (precisa de < 16 ms). Se passar disso, vai para o worker.

### 5.6 Persistência

- **Autosave** no IndexedDB a cada mudança (debounce de 1 s), com lista de projetos recentes.
- **Salvar/abrir arquivo** `.3dm.json` (download e File System Access API quando houver).
- **Undo/redo:** pilha de **comandos** sobre o documento (não snapshots de malha). Ctrl+Z / Ctrl+Y (Ctrl+Shift+Z também).
- O terrain decidiu "nada é salvo". Aqui é diferente, porque é um CAD.

### 5.7 MCP

**Pacote:** `packages/mcp`, executável com `npx 3d-modeling-mcp`. Servidor MCP via **stdio** para Claude Code e Claude Desktop.

**Dois modos:**

| Modo | Quando | Como |
|---|---|---|
| **Ponte (ao vivo)** | Aba do app aberta e conectada | O servidor abre WebSocket em `127.0.0.1:47800` (D19; muda com `MODELING_MCP_PORT`). O app conecta, com o **token** exibido pelo MCP e colado uma vez no app (ou via `#token=` na URL de `open_app`). O usuário vê o modelo mudar em tempo real |
| **Headless** | Sem aba aberta | O servidor usa o **mesmo core + manifold em Node**. Grava `.3dm.json`, STL e 3MF numa pasta. A captura de tela usa renderização offscreen **[VERIFICAR: three em Node precisa de headless-gl ou Playwright; alternativa: desenhos SVG do esquema.ts como "captura"]** |

**Segurança (lições do Blender MCP, que não tem auth):** escutar só em `127.0.0.1` · token por sessão no handshake · comandos tipados e validados por schema · sem `eval` de código arbitrário no MVP.

**Ferramentas (granulares + em lote, padrão do talk-to-figma):**

| Ferramenta | Faz |
|---|---|
| `projeto_novo`, `projeto_abrir`, `projeto_salvar` | Ciclo de vida do documento |
| `impressora_definir(id)`, `impressoras_listar` | Perfil ativo |
| `parametro_definir(nome, expr)` | Parâmetros e expressões |
| `sketch_criar(plano, offset)` | Cria um sketch |
| `sketch_adicionar(sketch, entidades[])` | Linhas, retângulos, círculos, arcos, polígonos (em lote) |
| `sketch_restringir(sketch, restricoes[])` | Restrições e cotas (em lote) |
| `extrudar`, `revolver`, `booleana`, `shell`, `furo`, `padrao`, `espelhar`, `fillet_sketch`, `chanfro` | Features |
| `primitiva(tipo, dims, posicao)` | Atalho rápido para caixa, cilindro, esfera etc. |
| `feature_editar(id, campos)`, `feature_apagar(id)`, `features_listar` | Edição da árvore |
| `modelo_info` | Bbox, volume, massa estimada (densidade do filamento), nº de triângulos, malha fechada |
| `verificar_impressao` | Cabe no volume? overhangs? paredes finas? (§6.10) |
| `captura(vistas=["iso","frente","topo","direita"])` | PNG das vistas para o agente **conferir o próprio trabalho** (lição do openscad-mcp de alexlenk) |
| `exportar(formato: stl\|3mf, caminho)` | Arquivo final |
| `desfazer`, `refazer` | Pilha de comandos |

**Recursos MCP:** `docs://api` (referência compacta das ferramentas com exemplos, para evitar alucinação de API), `printers://lista`, `projeto://atual`.

**Fluxo-exemplo** — "crie uma caixa 80×50×30 com parede 2 e tampa com encaixe":
1. `parametro_definir` L=80, W=50, H=30, parede=2.
2. `sketch_criar(XY)` → `sketch_adicionar(retângulo centrado L×W)` → `extrudar(H)` → `shell(parede, abrir topo)`.
3. Tampa: novo sketch → extrude 2 mm + aba com `folga = calib.encaixe_deslizante`.
4. `verificar_impressao` → `captura` → o agente confere → `exportar(3mf)`.

---

## 6. Funcionalidades em detalhe

Legenda de fase: **[F1]** etc., conforme §11. **MVP = F0–F4.**

### 6.1 Layout da tela [F0]

Herda o layout de três colunas do terrain e acrescenta o que um CAD precisa.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Barra superior: ☰ Arquivo · abas de ferramenta [Sketch][Sólido][Inspecionar] │
│                 [Imprimir] · impressora ativa ▾ · Desfazer/Refazer           │
├────────────┬───────────────────────────────────────────────┬─────────────────┤
│ ESQUERDA   │                 VIEWPORT 3D                   │ DIREITA         │
│ 300 px     │  card Vista (topo-esq)    card Aparência(dir) │ 340 px, recolhe │
│ Navegador  │                                               │ Propriedades    │
│ do projeto │      [volume da impressora em wireframe]      │ (Tipo/Instância │
│ (Revit):   │                                               │  estilo Revit)  │
│ ▸ Parâm.   │                                               │ ─────────────── │
│ ▸ Features │  card Desempenho (baixo-esq)   gizmo (baixo-d)│ Desenho técnico │
│   (árvore/ │                                               │ (esquema.ts)    │
│   timeline)│                                               │                 │
├────────────┴───────────────────────────────────────────────┴─────────────────┤
│ Linha de comando (AutoCAD): > _   [histórico de 3 linhas, expansível com F2] │
├──────────────────────────────────────────────────────────────────────────────┤
│ Barra de status: X 12.50  Y 30.00 │ GRID F7 │ SNAP F9 │ ORTHO F8 │ OSNAP F3 │ │
│                  DYN F12 │ unidade mm │ HUD 120 ms ●                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Esquerda — Navegador do projeto** (Project Browser do Revit + timeline do Fusion): parâmetros, árvore de features com ícone por tipo, olho de visibilidade (reuso dos ícones do terrain), arrastar o **marcador de histórico** para rollback, e clique duplo para editar.
- **Direita — Propriedades** (painel N do Blender / Properties do Revit): campos da feature ou entidade selecionada. **Tipo vs Instância** (Revit): parâmetros do projeto vs da feature. Abaixo fica o desenho técnico 2D, recolhível (botão vertical do terrain).
- **Cards sobre a vista** (padrão `cartao()` do terrain): Vista (Home, olhos), Aparência (modos de sombreamento, arestas, transparência), Corte (eixo, posição), Cotas, Desempenho.
- **Responsivo:** < 1100 px vira uma coluna. < 700 px vira só visualização (D6): árvore e propriedades só para leitura, medir e exportar.

### 6.2 Navegação no viewport [F0]

| Ação | Mouse | Teclado | Origem |
|---|---|---|---|
| Orbitar | Botão do meio | Numpad 2/4/6/8 | Blender |
| Pan | Shift + meio | Ctrl + Numpad | Blender padrão; preset AutoCAD = meio sozinho (D15) |
| Zoom | Roda (no cursor) | Numpad +/− | Ambos |
| Enquadrar tudo | Duplo clique do meio | **Home** · `Z`→`E` (Zoom Extents) | Blender + AutoCAD |
| Enquadrar seleção | — | Numpad **.** | Blender |
| Vistas | Gizmo (ViewHelper) | Numpad 1 frente · 3 direita · 7 topo · Ctrl+ inverte · 9 oposta | Blender |
| Perspectiva/ortográfica | — | Numpad **5** | Blender |
| Plano de corte (section box) | card Corte | `SB` + Enter | Revit (reuso do corte do terrain) |
| Olhar para o plano do sketch | — | `Shift+7` (alinha a vista com o plano ativo) | Blender/Fusion |

- Orbit em torno do ponto sob o cursor (pivot dinâmico).
- Animação de 300 ms nas trocas de vista (padrão do terrain).
- **Grid de piso** (o terrain não tem): grid menor de 1 mm e maior de 10 mm, adaptativo ao zoom. O **volume da impressora** aparece em wireframe com a mesa sombreada.

### 6.3 Seleção [F1]

- Clique seleciona e **Shift+clique** adiciona ou remove (Blender e AutoCAD).
- **Janela** (arrastar da esquerda para a direita, contida) vs **cruzamento** (da direita para a esquerda, toca), como no AutoCAD, com cor azul e verde.
- Pré-seleção com destaque `--destaque` ao passar o mouse.
- **A** seleciona tudo, **Alt+A** limpa (Blender). **Esc** limpa a seleção ou cancela o comando (AutoCAD).
- Filtro de seleção: pontos, arestas e entidades no sketch; corpos e features no modo sólido.
- **H** esconde, **Alt+H** mostra tudo, **Shift+H** isola (Blender; equivalente ao HI do Revit).

### 6.4 Linha de comando [F1]

Ponto central da memória muscular do AutoCAD.

- Sempre visível, na parte de baixo. **Digitar em qualquer lugar** do viewport escreve na linha (exceto as teclas imediatas do §7.3).
- **Enter ou Espaço** executa. **Enter ou Espaço vazio repete o último comando.** **Esc** cancela.
- Autocompletar com lista de sugestões (como o AutoComplete do AutoCAD 2015+).
- **Prompts com opções entre colchetes**, clicáveis: `Especifique o raio ou [Diâmetro]:`.
- **Entrada de coordenadas** (AutoCAD):
  - Absoluta `x,y`
  - Relativa `@dx,dy`
  - Polar `@d<ângulo`
  - Comprimento direto: digita o número com a direção do cursor (Direct Distance Entry)
- **Expressões** em qualquer campo numérico: `80/2+parede`, `L-2*parede`, `25.4*2` (polegada → mm).
- **F2** expande o histórico.

### 6.5 Sketch 2D [F1]

**Entrar e sair:**
- Escolher o plano: XY, XZ, YZ, plano com offset ou face plana (captura o plano, §5.2).
- **Tab** entra e sai do modo sketch (Blender: Tab = modo edição). Duplo clique numa feature sketch na árvore também entra.
- A vista se alinha ao plano (opcional; padrão ligado).

**Ferramentas de desenho:**

| Ferramenta | Alias | Opções |
|---|---|---|
| Linha / polilinha | `L`, `PL` | Encadeada; `F`echar; `D`esfazer segmento |
| Retângulo | `REC` | 2 cantos · centro · 3 pontos (rotacionado); `F`illet / `C`hanfro nos cantos ao criar |
| Círculo | `C` | Centro-raio · centro-diâmetro · 2P · 3P · TTR |
| Arco | `A` | 3P · centro-início-fim · tangente ao fim da linha |
| Polígono | `POL` | N lados, inscrito ou circunscrito |
| Slot (oblongo) | `SLOT` | Centro-a-centro + largura (comum em peça impressa) |
| Elipse | `EL` | [F2+] |
| Ponto | `PO` | Para referência |
| Linha de construção | `XL` | Não gera perfil (tracejada) |
| Texto | `T` | [F3] (gera contorno para extrude) |

**Ferramentas de edição:**

| Ferramenta | Alias | Nota |
|---|---|---|
| Aparar | `TR` | Clique no trecho a remover (modo rápido do AutoCAD) |
| Estender | `EX` | |
| Offset | `O` | Distância + lado; usa Clipper2 (BSL-1.0) ou offset do manifold `CrossSection` |
| Fillet 2D | `F` | Raio; raio 0 = canto vivo |
| Chanfro 2D | `CHA` | Distância ou distância+ângulo |
| Mover / Copiar / Girar / Escala / Espelhar | `M`, `CO`, `RO`, `SC`, `MI` | Também por G/R/S (§7.3) |
| Array retangular/polar | `AR` | |
| Apagar | `E`, Del, `X` | X apaga com confirmação, como no Blender |
| Converter em construção | `Q` | Liga ou desliga |

**Auxílios de precisão (barra de status, teclas F do AutoCAD):**

| Auxílio | Tecla | Comportamento |
|---|---|---|
| **OSNAP** | F3 | Extremidade, ponto médio, centro, quadrante, interseção, perpendicular, tangente, mais próximo. Marcadores com o formato do AutoCAD (quadrado, triângulo, círculo, X). **Tab** alterna entre snaps sobrepostos |
| **OTRACK** | F11 | Linhas de alinhamento pontilhadas a partir de pontos de snap |
| **GRID** | F7 | Mostra o grid do plano |
| **SNAP** | F9 | Cursor preso no grid (passo configurável, padrão 1 mm) |
| **ORTHO** | F8 | Só horizontal e vertical. **Shift segurado inverte** (como no AutoCAD) |
| **POLAR** | F10 | Ângulos incrementais (15°, 30°, 45°, 90°) |
| **DYN** | F12 | Entrada dinâmica: caixinhas de comprimento e ângulo junto ao cursor; **Tab** alterna entre os campos |

**Restrições (§5.4):**
- Barra de restrições no modo sketch.
- Atalhos de letra sozinha estilo Onshape quando há seleção no sketch (D31): `H` horizontal, `V` vertical, `I` coincidente, `T` tangente, `E` igual, `B` paralela, `D` cota. A restrição é aplicada na hora (com destaque e ícone). Se a próxima tecla for outra letra, ela é desfeita e as letras viram comando (§7.3, item 2b). Exemplos: `T` `R` = aparar e `E` `X` = estender.
  - Ver conflito com H = esconder em §7.3. Dentro do sketch, a regra do sketch vence.
- **Cotas:**
  - `DIM` cota inteligente: detecta linear, alinhada, raio, diâmetro ou ângulo pelo que foi clicado.
  - O valor é editado **inline** e aceita expressão e parâmetro (`=L`).
  - Cota **acionadora** (dirige a geometria) vs **de referência** (só mostra, entre parênteses), como no Fusion e no SolidWorks.
- **Cotas temporárias (Revit):** ao selecionar uma entidade, aparecem as cotas até as referências mais próximas, em cinza. Um clique no número edita e move a entidade. Clicar no **ícone de cadeado** transforma a cota temporária em permanente.
- **Detecção de perfis:** regiões fechadas ficam sombreadas em tom leve. Erros mostram marcador vermelho: contorno aberto (com indicação das pontas soltas) e autointerseção.

### 6.6 Features 3D [F2]

Todas abrem um **painel de feature** na direita, com **prévia ao vivo** (orçamento de 300 ms), **manipuladores na vista** (seta de arrastar para distância, como no Fusion e no Onshape) e campo numérico com expressão. **Enter** confirma e **Esc** cancela.

| Feature | Alias | Parâmetros | Operação |
|---|---|---|---|
| **Extrudar** | `EXT` (`EXTRUDE`), `E` no modo sólido (Blender: E = extrude) | Distância · simétrica · duas distâncias · até o plano · taper (ângulo) | Nova / Unir / Subtrair / Interseção (padrão inteligente: subtrai se começa em face e vai para dentro) |
| **Revolver** | `REV` | Eixo (linha do sketch ou eixo global) · ângulo · simétrico | Idem |
| **Booleana** | `UNI`, `SU`, `IN` (AutoCAD: UNION, SUBTRACT, INTERSECT) | Alvo + ferramentas · manter ferramentas | |
| **Primitivas** | `BOX`, `CYL`, `SPH`, `CONE`, `TOR` · **Shift+A** abre menu de adicionar (Blender) | Dimensões + posição (com snap em face e grid) | Nova / Unir / Subtrair |
| **Shell** | `SHELL` | Espessura · faces abertas (topo, base, laterais em prismas) | MVP só prismático (§5.3) |
| **Furo** | `HOLE` | Simples / escareado / rebaixado · diâmetro · profundidade ou passante · **compensação de calibração** aplicada (F6) · presets M2–M8 e furo de **inserto roscado de latão** | Subtrair |
| **Chanfro / Fillet de borda** | `CHA` / `F` no modo sólido | Borda topo/base de uma extrusão · distância/raio | Ver §5.3 [VERIFICAR] |
| **Padrão** | `AR` | Linear (dir, n, passo) · circular (eixo, n, ângulo) | |
| **Espelhar** | `MI` | Plano XY/XZ/YZ ou plano de sketch | |
| **Corte por plano** | `SLICE` | Plano · manter um lado ou ambos (dividir peça grande para imprimir) | |
| **Mover/Girar corpo** | G/R/S, `M`, `RO` | Transformação registrada como feature (paramétrica) | |
| **Texto 3D** | `TEXT` | Fonte, tamanho, profundidade, em face plana (F3) | Unir / Subtrair |

**Corpos múltiplos:** cada "Nova" cria um corpo. O export pode ser **por corpo** (arquivos separados ou objetos separados no 3MF).

### 6.7 Parâmetros e expressões [F2]

- Tabela de parâmetros no navegador do projeto: nome, expressão, valor calculado, unidade e comentário.
- Expressões com `+ − * / ( )`, `min`, `max`, `round`, `floor`, `ceil`, `sqrt`, `sin`/`cos`/`tan` em graus, `pi`.
  - **Avaliador próprio**, sem `eval`. Um parser pequeno de expressões, com teste.
- **Parâmetros de sistema** só para leitura:
  - `bico`, `camada`, `volume.x/y/z`, da impressora ativa
  - `calib.*` (F6): `furo_comp`, `encaixe_justo`, `encaixe_deslizante`, `encaixe_livre`
- Mudar um parâmetro regenera tudo que depende dele.
- Detecção de ciclo com mensagem clara.

### 6.8 Transformações estilo Blender [F2]

- Com seleção no modo sólido:
  - **G** move, **R** gira, **S** escala
  - Depois **X/Y/Z** trava o eixo, **Shift+X/Y/Z** trava o plano, e **digitar número** dá o valor exato
  - **Enter** ou clique confirma; **Esc** ou botão direito cancela
- **Ctrl** segurado durante G/R/S = snap (incrementos e OSNAP).
- **Shift+D** duplica e entra em G (Blender). `CO` faz o mesmo (AutoCAD).
- Toda transformação vira feature (paramétrica, editável na árvore).
- Gizmo de manipulação visível (setas e anéis) para quem prefere mouse: **W** liga e desliga (Fusion/Unity) **[VERIFICAR conflito]**.

### 6.9 Medição, cotas 3D e desenho técnico

- **Medir** [F2]: `DI` (AutoCAD DIST) / `MEA`, distância ponto a ponto, aresta, ângulo, raio, área de face e volume. Snap em vértices, arestas e centros. Os resultados ficam como cotas temporárias até Esc.
- **Cotas 3D persistentes** [F2]: reuso do `cotas.ts`. Mostrar as cotas acionadoras do sketch no 3D (opção) + bbox geral (L × W × H), padrão do terrain.
- **Desenho técnico** [F5]: reuso do `esquema.ts`.
  - Folha com vistas planta, frontal, lateral e isométrica, a partir do modelo.
  - Cotas automáticas da bbox, cotas manuais, hachura em corte e carimbo (nome, data, escala, impressora, material).
  - Export **SVG e PDF**, e **DXF** [F5+].

### 6.10 Impressão [F3]

**Perfil ativo:** seletor na barra superior. Ao trocar:
- O volume em wireframe atualiza.
- Os parâmetros de sistema mudam.
- A verificação reavalia.

**Verificação de imprimibilidade** (card "Imprimir" + painel):

| Checagem | Como | Severidade |
|---|---|---|
| Malha fechada | `fechada()` do terrain (cada aresta orientada aparece uma vez, a inversa também, sem triângulo de área zero) | Bloqueia o export (com "exportar mesmo assim") |
| Cabe no volume | Bbox de cada corpo vs `volume` (com orientação atual) | Erro + sugestão de "cortar por plano" |
| Overhang | **Modo Inclinação do terrain** (verde → amarelo → laranja → vermelho), com limiar `overhangMax` do perfil | Aviso visual na vista |
| Parede fina | Amostragem por raio na normal invertida **[VERIFICAR custo; F3+]** | Aviso com destaque |
| Detalhe menor que o bico | Arestas/features < `detalheMin` | Aviso |
| Base de apoio | Área de contato com a mesa (faces com normal −Z em z=0) | Aviso se < X mm² |

**Orientação:**
- **"Apoiar na face"**: clicar numa face gira a peça para a face ficar na mesa (Bambu Studio "Lay on face" / Prusa "Place on face"). `LF` + Enter.
- **Soltar na mesa**: z mínimo = 0, sempre por padrão.
- **Centralizar na mesa.**

**Export:**

| Formato | Conteúdo | Fase |
|---|---|---|
| **STL binário** | Por corpo ou tudo junto. Reuso do `stl()` do terrain | F3 |
| **3MF core** | `[Content_Types].xml`, `_rels/.rels`, `3D/3dmodel.model` (mm). Objetos separados por corpo, cor por corpo. Zip com **fflate (MIT)** | F3 |
| **3MF "sabor Prusa"** (Mega S) | + `Metadata/Slic3r_PE.config` com `printer_settings_id`, `print_settings_id`, `filament_settings_id` e camada | F3 — **[VERIFICAR com spike: abrir no PrusaSlicer]** |
| **3MF "sabor Bambu/Orca"** (P2S) | + `Metadata/project_settings.config` (JSON) e `Metadata/model_settings.config` (plate e instâncias) | F3 — **[VERIFICAR com spike: abrir no Bambu Studio com P2S pré-selecionada]** |
| **Miniatura** | `Metadata/thumbnail.png` (render da vista iso) | F3 |
| **Multicor / AMS** (P2S) | Cada corpo tem uma cor e um **slot de filamento** (1–4, ou mais com AMS extra). No 3MF Bambu/Orca: `extruder` por objeto em `model_settings.config` e as cores de filamento (`filament_colour`) em `project_settings.config`. Na Mega S (um só extrusor) o slot é ignorado e só a cor vai no 3MF | F3 — **[VERIFICAR no mesmo spike do 3MF]** |
| STEP | Via OCCT | F7 |
| G-code | Fora do escopo (talvez Kiri:Moto, MIT, no futuro) | — |

**Nome do arquivo:** `<projeto>-<corpo>-<impressora>.3mf` (padrão do terrain, que põe metadados no nome).

### 6.11 Importar [F3]

- **STL / 3MF / OBJ** como **corpo de malha de referência** ou para booleanas (three loaders + manifold). Útil para furar e encaixar peças baixadas.
- **SVG → sketch** (paths → entidades; arcos e béziers discretizados), útil para logos e contornos.
- **DXF → sketch** [F5+] (dxf-parser, MIT **[VERIFICAR licença]**). Ponte direta com o AutoCAD.
- **Imagem de referência** no plano do sketch (canvas) para decalcar [F5+].

### 6.12 Calibração [F6]

**Gerador de peças de calibração** (modelos paramétricos internos, exportados como 3MF com o perfil):
1. **Teste de furos:** placa com furos de 3, 5, 8 e 10 mm e pinos correspondentes. O usuário mede com paquímetro e digita.
2. **Teste de encaixe:** pinos e furos com folgas de 0,0 a 0,6 mm em passos de 0,1. O usuário marca "justo", "deslizante" e "livre".
3. **Cubo XY / CaliCross:** encolhimento XY em %.

**Registro de calibração** (por **impressora + bico + filamento**):

```jsonc
{ "impressora": "bambu-p2s", "bico": 0.4, "filamento": "PLA genérico",
  "data": "2026-12-01", "metodo": "teste-furos-v1",
  "furo_comp": 0.15,            // mm somados ao raio dos furos
  "contorno_comp": -0.05,       // mm no contorno externo
  "encolhimento_xy": 0.2,       // %
  "encaixe_justo": 0.10, "encaixe_deslizante": 0.20, "encaixe_livre": 0.35 }
```

**Aplicação:** a feature `furo` e as dimensões marcadas como "encaixe" leem `calib.*`. Uma chave global "aplicar compensação no export" fica ligada por padrão, e o modelo nominal continua limpo.

### 6.13 Perfis genéricos de impressora [F6]

Upload de perfil para extrair volume, bico e forma da mesa:

| Formato | Campos lidos |
|---|---|
| OrcaSlicer/Bambu JSON | `printable_area`, `printable_height`, `nozzle_diameter`, `inherits` |
| PrusaSlicer `.ini` (bundle) | `bed_shape`, `max_print_height`, `nozzle_diameter` |
| Cura `.def.json` | `machine_width/depth/height`, `machine_nozzle_size` |
| Klipper `printer.cfg` | `[stepper_x/y/z] position_min/max`, `[extruder] nozzle_diameter` |
| Marlin M503 (colar texto) | Só informativo (steps/mm, feedrates) |

Também dá para criar o perfil na mão por um formulário. Perfis ficam no IndexedDB e podem ser exportados e importados como JSON.

### 6.14 Aparência e materiais [F2]

- Cor por corpo (paleta pequena + seletor nativo `<input type="color">`). Vai para o 3MF como cor do objeto.
- **"Material" = filamento** (§3.4: PLA, PETG, TPU, ABS/ASA): define a densidade (massa estimada), as regras de verificação e, no 3MF, o filamento sugerido.
- **Slot do AMS por corpo** (P2S): painel de propriedades do corpo mostra cor + slot. A tabela de slots do projeto (slot → filamento + cor) fica no navegador do projeto.
- Modos de vista do terrain: sólido, matcap, inclinação (overhang), normais, arestas, transparência.

### 6.15 Undo, histórico e erros [F0–F2]

- **Toda** ação (UI ou MCP) é um comando com `fazer`/`desfazer`, e o MCP vê o mesmo histórico.
- **Feature que falha** na regeneração fica vermelha na árvore com a mensagem ("perfil aberto", "booleana vazia"). As seguintes ficam suspensas. O modelo até a última feature válida continua visível (comportamento do Fusion).
- Erros com o tom do ADHD mode do projeto: causa + correção, sem "Ops!".

### 6.16 Modo customizar [F3]

Inspirado no Thingiverse Customizer e no MakerWorld Parametric Model Maker, mas **sem servidor**.

- Qualquer parâmetro do projeto pode ser marcado como **"exposto"**, com rótulo, faixa (mín/máx/passo), tipo (número, lista de opções, sim/não) e grupo.
- **Modo customizar** esconde sketch, árvore e linha de comando. Mostra só a vista 3D, o formulário dos parâmetros expostos, a impressora/filamento e o botão Exportar.
- Link compartilhável: `…/3d-modeling/#customizar&projeto=<url do .3dm.json>` (qualquer URL https, D28: mostra a origem e pede confirmação antes de abrir; o arquivo é validado por schema e nunca executa código). Os valores escolhidos podem ir na URL (`&L=90&W=40`).
- Funciona também no **celular** (é o caso de uso mobile natural: ajustar medida e exportar).
- O MCP ganha `parametros_expostos` e aceita valores no `exportar`.

### 6.17 Ajuda e descoberta [F1+]

- Tooltip de cada botão com **nome + alias AutoCAD + atalho Blender** (ex.: "Linha — `L` · Shift+A › Sketch").
- **F1** abre um cartão de atalhos pesquisável.
- **Busca de comando** com Ctrl+K / F3 do Blender **[conflito F3 = OSNAP; usar Ctrl+K]**.
- Primeiro uso: um projeto-exemplo carregado (caixa com tampa paramétrica) em vez de tutorial.

---

## 7. Mapa de atalhos e comandos

### 7.1 Aliases de comando (linha de comando, Enter/Espaço executa)

| Alias | Comando | Origem |
|---|---|---|
| `L` / `PL` | Linha / Polilinha | AutoCAD |
| `REC` | Retângulo | AutoCAD |
| `C` / `A` | Círculo / Arco | AutoCAD |
| `POL` / `EL` / `SLOT` | Polígono / Elipse / Oblongo | AutoCAD |
| `TR` / `EX` / `O` | Aparar / Estender / Offset | AutoCAD |
| `F` / `CHA` | Fillet / Chanfro | AutoCAD |
| `M` / `CO` / `RO` / `SC` / `MI` / `AR` | Mover / Copiar / Girar / Escala / Espelhar / Array | AutoCAD |
| `E` | Apagar (no sketch) · Extrudar (no modo sólido, com seleção de perfil) | AutoCAD / Blender (D16) |
| `EXT` / `REV` | Extrudar / Revolver | AutoCAD (EXTRUDE/REVOLVE) |
| `UNI` / `SU` / `IN` | União / Subtração / Interseção | AutoCAD |
| `BOX` / `CYL` / `SPH` / `CONE` / `TOR` | Primitivas | AutoCAD |
| `SHELL` / `HOLE` / `SLICE` | Casca / Furo / Corte | AutoCAD (SHELL/SLICE) |
| `DIM` / `DI` | Cota / Medir distância | AutoCAD |
| `Z` → `E` | Zoom Extents | AutoCAD |
| `SB` | Section box (corte) | Revit |
| `LF` | Apoiar na face | Bambu/Prusa |
| `U` | Desfazer (além de Ctrl+Z) | AutoCAD |

### 7.2 Teclas de função (estado, barra de status)

F1 ajuda · F2 histórico de comandos · F3 OSNAP · F7 GRID · F8 ORTHO · F9 SNAP · F10 POLAR · F11 OTRACK · F12 DYN — todas como no AutoCAD.

### 7.3 Teclas imediatas (sem Enter)

| Tecla | Ação | Origem |
|---|---|---|
| **Tab** | Entra/sai do modo sketch (fora de comando). Durante um comando com DYN: alterna campo | Blender / AutoCAD |
| **G / R / S** com seleção | Mover / girar / escalar, com regra de desambiguação (abaixo) | Blender |
| **X/Y/Z** durante G/R/S | Trava o eixo · Shift = plano | Blender |
| **Shift+A** | Menu Adicionar (primitivas e sketch) | Blender |
| **Shift+D** | Duplicar + mover | Blender |
| **H / Alt+H / Shift+H** | Esconder / mostrar tudo / isolar (fora do sketch) | Blender |
| **H V I T E B D** (no sketch, com seleção) | Restrições | Onshape |
| **A / Alt+A** | Selecionar tudo / nada (fora de comando) | Blender |
| **Numpad 1/3/7/5/.** | Vistas / perspectiva-orto / enquadrar seleção | Blender |
| **Home** | Enquadrar tudo | Blender/terrain |
| **N** | Mostra/esconde painel de propriedades | Blender |
| **Del / X** | Apagar (X confirma) | Blender |
| **Esc** | Cancela comando / limpa seleção | AutoCAD |
| **Enter / Espaço** vazio | Repete o último comando | AutoCAD |
| **Ctrl+Z / Ctrl+Y / Ctrl+S / Ctrl+K** | Desfazer / refazer / salvar / busca de comando | Universal |

**Regra de desambiguação teclado (AutoCAD × Blender)** — proposta:
1. Sem seleção, **toda letra vai para a linha de comando** e executa no Enter/Espaço (AutoCAD puro).
2. Com seleção e linha de comando vazia, **G, R ou S iniciam a transformação na hora** (Blender).
   - Se a próxima tecla for **X, Y, Z, número, Enter ou Esc**, continua como transformação.
   - Se for **outra letra**, a transformação é cancelada e o texto vira comando. Exemplo: `R` `E` `C` → `REC`. `R` `O` → `RO` (que também gira, então o resultado é o mesmo). `S` `C` → `SC`.
   - **2b. No sketch, com seleção e linha de comando vazia** (D31): **H, V, I, T, E, B** aplicam a restrição na hora, e **D** inicia a cota.
     - Se a próxima tecla for **outra letra**, a restrição é desfeita (sem deixar entrada no undo) e as duas letras viram texto de comando: `T`+`R` → `TR`, `E`+`X` → `EX`, `D`+`I` → `DI`.
     - Enter, Esc, clique ou qualquer tecla que não seja letra confirma a restrição.
     - Letras que não são de restrição, como `L`, `C`, `A` e `O`, vão direto para a linha de comando.
3. Tab, Shift+A, Shift+D, numpad, F-keys e Ctrl+ são sempre imediatos.
4. Há uma opção em Preferências: "teclas imediatas Blender: ligado / desligado".

**Status (D25):** regra aprovada, validar com uso real na F1 (critério de aceite da F1).

### 7.4 Mouse

| Ação | Padrão | Alternativa (Preferências) |
|---|---|---|
| Orbitar | Meio | Botão direito (estilo Onshape) |
| Pan | Shift+meio (padrão Blender, D15) | Meio sozinho (estilo AutoCAD 2D) |
| Zoom | Roda, no cursor | — |
| Menu de contexto | Botão direito | Inclui "Repetir último", "Cancelar", opções do comando (AutoCAD) |
| Confirmar ponto | Esquerdo | — |

Preferências → **Navegação** tem presets: **Blender** (padrão), **AutoCAD**, **Onshape/Fusion**. Cada gesto também pode ser trocado um a um.

### 7.5 Conferência dos atalhos (rodada 2, D30)

Um agente conferiu os atalhos nas docs oficiais (Autodesk, Blender, Onshape, Fusion) em 2026-11-08. Legenda: ✅ confirmado na fonte · ⚠️ corrigido · ❔ não encontrado na fonte (vem do conhecimento do modelo, continua a confirmar).

| Grupo | Resultado |
|---|---|
| **AutoCAD — teclas F** | ✅ F1 ajuda, F2 histórico, F3 OSNAP, F7 GRID, F8 ORTHO, F9 SNAP, F10 POLAR, F11 OTRACK, F12 DYN (com Tab entre campos). ✅ **F8 e F10 são mutuamente exclusivos**: ligar um desliga o outro, e o app copia esse comportamento. ✅ **Shift segurado inverte o ORTHO** temporariamente (override temporário, `TEMPOVERRIDES`) |
| **AutoCAD — aliases** | ✅ L, Z, `CP`/`CO` = COPY. ✅ Formato `ALIAS, *COMANDO` do acad.pgp com "última definição vale", que é o modelo do arquivo de aliases editável (§7.6). ❔ Os demais (PL, REC, C, A, TR, EX, O, F, CHA, M, RO, SC, MI, AR, E, EXT, REV, UNI, SU, IN, DI, U, XL, PO, T): o acad.pgp padrão não foi aberto. Para conferir, use `(findfile "acad.pgp")` na sua instalação. ❔ Enter/Espaço repete o último comando e a entrada `@dx,dy` / `@d<ang` não foram achados nas páginas abertas, mas são comportamento padrão conhecido do AutoCAD |
| **Blender** | ✅ Meio orbita, Shift+meio faz pan. ✅ Numpad 1/3/7 = frente/direita/topo e Ctrl+Numpad = vista oposta. ✅ H / Alt+H / A / Alt+A / N / Tab / X (com confirmação) / F3 (busca). ✅ **Acento grave (`` ` ``) = pie de vistas**, que o app adota. ⚠️ **Numpad 9** não aparece na doc. A vista oposta fica em **Ctrl+Numpad** (Numpad 9 é mantido, pois existe no Blender 2.8+ como "vista oposta", mas é ❔). ❔ Numpad 5, Numpad `.`, Home, G/R/S, Shift+X/Y/Z, Shift+A, Shift+D, Shift+H, Ctrl durante transformação: páginas truncadas |
| **Onshape (sketch)** | ✅ H, V, I, T, E, B, D, L, C (círculo por centro). ✅ **Shift suprime inferência**. ⚠️ **`r` = retângulo por centro; `g` = retângulo por canto**. ⚠️ **`a` = arco de 3 pontos**. ✅ Outras: Shift+O concêntrica, Shift+L perpendicular, Shift+M ponto médio, Shift+Q simetria, `m` aparar, `x` estender, `o` offset, Shift+/ mapa de atalhos |
| **Fusion (comparação)** | ✅ L linha, R retângulo 2 pontos, ⚠️ **C = círculo por diâmetro** (não por raio), D cota, E extrudar, Q press-pull, T aparar, O offset, X construção, P projetar |
| **Revit** | ❔ VV, HI, EQ, cadeado, section box: os atalhos estão em PDF/XLS que não foi aberto. ✅ **Atalhos do Revit são sequências de 2+ teclas, reatribuíveis**. ✅ Cota temporária vira permanente ao clicar no símbolo e some ao desselecionar. ❔ "Clicar no valor para editar" não foi confirmado na fonte, mas é comportamento conhecido |

**Conflitos encontrados e resolução no app:**

| Tecla | Sentidos nas referências | Resolução |
|---|---|---|
| `E` | AutoCAD ERASE · Fusion Extrude · Onshape Equal | D16 (contexto + Enter). No sketch com seleção, `E` = igual (D31); `E`+`X` vira `EX` |
| `R` | AutoCAD REDRAW · Onshape/Fusion retângulo · Blender Rotate | Regra §7.3: com seleção, Rotate imediato; outra letra vira comando (`REC`) |
| `C` | AutoCAD CIRCLE (raio) · Fusion círculo (diâmetro) | `C` = círculo centro-raio (AutoCAD); opção `D` no prompt muda para diâmetro |
| `T` | AutoCAD MTEXT · Onshape Tangent · Fusion Trim | Sem seleção, `T`+Enter = texto (AutoCAD). No sketch com seleção, `T` = tangente (D31). `T`+`R` = aparar |
| `H` | Blender Hide · Onshape Horizontal | Fora do sketch = Hide (Blender); no sketch com seleção = horizontal (D31) |
| `X` | Blender Delete · Onshape Extend · Fusion Construction · AutoCAD EXPLODE | `X` = apagar com confirmação (Blender); estender = `EX`; construção = `Q` |
| `F3` | AutoCAD OSNAP · Blender busca | F3 = OSNAP (AutoCAD); busca = Ctrl+K e acento grave para o pie de vistas |
| `Tab` | AutoCAD campo DYN · Blender modo edição | Dentro de comando = campo DYN; fora = entrar/sair do sketch (já na §7.3) |
| `Shift` | AutoCAD inverte ORTHO · Onshape suprime inferência · Blender Shift+letra | Shift **segurado** = override temporário (ORTHO e inferência). Shift+**letra** = ação Blender (Shift+A/D/H) e restrições extras do Onshape (Shift+O concêntrica, Shift+L perpendicular, Shift+M ponto médio, Shift+Q simetria) |

### 7.6 Arquivo de aliases editável

Igual ao acad.pgp: `Preferências → Aliases` mostra uma tabela `ALIAS → comando`, exportável e importável como texto (`L, *LINHA`), em que a última definição vale. Assim o usuário traz os próprios aliases do AutoCAD. **Teste de regressão** cobre cada tecla da tabela de conflitos acima.

---

## 8. Pesquisa: projetos semelhantes

Os dados vêm de buscas na web de 2026-11-08. Muitos dados vêm de agregadores; licenças e preços estão marcados quando não foram conferidos na fonte primária.

### 8.1 Panorama

| Ferramenta | Tipo | Pontos fortes | Limitações | Licença | Kernel | Lição para nós |
|---|---|---|---|---|---|---|
| **Tinkercad** | Web, blocos | Facílimo: soma e subtração de formas | Impreciso, pesa com modelos grandes, só malha | Proprietário, grátis | Malha | Copiar: primitivas com snap na mesa, "furo" como tipo de sólido. Evitar: sem cotas reais |
| **Onshape** | Web, paramétrico | B-rep completo, colaborativo, atalhos de restrição (H/V/I/T/E/B/D) | Documentos públicos no plano grátis; curva de aprendizado | Proprietário | Parasolid | Copiar: letras de restrição, Shift suprime inferência, árvore de features |
| **Fusion (pessoal)** | Desktop/web | Timeline, parâmetros de usuário, cores de sketch definido | Uso não comercial, limite de 10 docs, export restrito | Proprietário | ShapeManager | Copiar: timeline com rollback, tabela de parâmetros, feature que falha fica vermelha e não quebra tudo |
| **SketchUp Web** | Web | Push/Pull intuitivo, fita métrica, digitar medida depois do gesto | Não comercial, STL limitado, sólidos frágeis | Proprietário | Malha | Copiar: digitar o valor logo após o gesto (VCB). Evitar: geometria não-manifold |
| **Shapr3D** | iPad/desktop | Muito fácil, Parasolid, STEP | Pago (~US$ 299/ano) | Proprietário | Parasolid | Copiar: manipuladores diretos na vista |
| **Plasticity** | Desktop | NURBS direto, atalhos estilo Blender | Sem histórico paramétrico | Perpétua paga | Parasolid | Copiar: G/R/S estilo Blender num CAD |
| **Womp** | Web | Verificação de imprimibilidade em tempo real | Freemium; precisão limitada | Proprietário | SDF/malha | Copiar: avisos de impressão ao vivo |
| **Vectary / Spline** | Web | Visual bonito | Export limitado ou com marca d'água | Proprietário | Malha | Evitar: export atrás de paywall |
| **OpenSCAD** | Desktop, código | Paramétrico por script; base dos customizers | Precisa programar; sem sketch interativo | GPL-2 | CGAL/Manifold | Copiar: modelo = receita textual (bom para LLM) |
| **OpenSCAD Playground** | Web (WASM) | OpenSCAD no navegador | Lento; licença herdada | GPL (provável) | Manifold | Prova que WASM + Pages funciona |
| **CadQuery / build123d** | Python | API fluente, STEP | Não roda no navegador | Apache-2.0 | OCCT | Copiar: estilo de API para o MCP (fluente, legível) |
| **JSCAD** | Web, código JS | 100% navegador, MIT | Ecossistema estagnado | MIT | Malha | Referência de código liberada |
| **Replicad** | Lib TS | OCCT no navegador, API boa | WASM pesado | MIT | OCCT | **Candidato da F7** |
| **CascadeStudio** | Web, código | OCCT + editor no navegador | Sem manutenção clara | MIT (OCJS LGPL) | OCCT | Referência |
| **Chili3D** | Web, CAD B-rep | Stack parecida (TS + three + OCCT), UI de CAD de verdade | AGPL-3.0 | AGPL | OCCT | **Só referência de UX, não copiar código** |
| **SolveSpace** | Desktop (web experimental) | Solver de restrições excelente, leve | GPL-3 | GPL | Próprio | Referência de UX de restrições |
| **BlocksCAD** | Web, blocos | Ensino | Antigo | GPL-3 | OpenSCAD | Ideia: modo blocos (fora do escopo) |
| **Zoo.dev (KittyCAD)** | Web + API texto→CAD | Gera B-rep e STEP a partir de texto | Pago por minuto; nuvem | Proprietário (app open-source parcial **[VERIFICAR]**) | Próprio | Copiar: CAD como código (KCL) + IA. Evitar: dependência de nuvem paga |
| **MakerWorld Parametric / Thingiverse Customizer** | Web, formulário | Variáveis do script viram formulário | Roda no servidor deles; frágil | Proprietário | OpenSCAD | Copiar: parâmetros do projeto viram formulário simples ("modo customizar") |
| **Kiri:Moto** | Web, slicer | Fatiador no navegador, offline (PWA) | Interface própria | MIT | — | Possível G-code futuro |
| **FreeCAD** | Desktop | Paramétrico completo, Sketcher maduro | UX difícil, problema de nomeação topológica | LGPL | OCCT | Evitar: UX confusa; aprender com o Sketcher |

### 8.2 MCPs de CAD existentes

| Projeto | Arquitetura | Lição |
|---|---|---|
| **ahujasid/blender-mcp** (MIT, ~33k ⭐) | Addon Blender com socket TCP 9876 + servidor MCP Python; tem `execute_blender_code` | Funciona e é popular, mas **sem auth** e com execução arbitrária: não repetir |
| **grab/cursor-talk-to-figma-mcp** (MIT) | MCP TS + relay WebSocket + plugin; conexão por canal | **Modelo mais próximo do nosso**: tools granulares + em lote, canal/token |
| **alexlenk/openscad-mcp-server** | LLM escreve OpenSCAD, renderiza e devolve 8 ângulos | **Copiar: loop de feedback visual** (`captura`) |
| **quellant / jkoets openscad-mcp** | Render e export STL/3MF/AMF | Export direto pelo agente |
| **FreeCAD MCPs** (neka-nat, theosib, spkane) | Addon na porta 9876, Docker | Padrão "app + ponte" já é comum |
| **cadquery-mcp** | Roda script e renderiza SVG | Captura SVG serve como fallback headless |

### 8.3 Copiar (ranqueado por impacto na facilidade de uso)

1. **Linha de comando com aliases e entrada de coordenadas do AutoCAD** (memória muscular direta do usuário).
2. **Cotas editáveis inline e cotas temporárias do Revit** (precisão sem formulário).
3. **Timeline/árvore com rollback e erro isolado por feature** (Fusion).
4. **Atalhos de restrição por letra + Shift suprime inferência** (Onshape).
5. **G/R/S + eixo + número** (Blender/Plasticity).

Também copiar: digitar medida logo após o gesto (SketchUp), avisos de impressão ao vivo (Womp), parâmetros que viram formulário (Customizer), loop visual do MCP (alexlenk) e "apoiar na face" (slicers).

### 8.4 Evitar

1. Export atrás de paywall ou marca d'água.
2. Geometria não-manifold silenciosa (SketchUp): aqui o export checa `fechada()`.
3. Depender de servidor externo para gerar geometria (MakerWorld, Zoo).
4. MCP sem autenticação e com `eval` (Blender MCP).
5. Copiar código GPL/AGPL (Chili3D, SolveSpace, BlocksCAD, OpenSCAD) num projeto MIT.

Também evitar: UX de FreeCAD (modos demais, workbenches) e carregar um WASM pesado (OCCT) na abertura.

### 8.5 Repositórios para inspiração e reuso

| Repo | Licença | Uso permitido | Para quê |
|---|---|---|---|
| [elalish/manifold](https://github.com/elalish/manifold) | Apache-2.0 | **Dependência** | Kernel do MVP |
| [mrdoob/three.js](https://github.com/mrdoob/three.js) | MIT | **Dependência** | Render |
| [sgenoud/replicad](https://github.com/sgenoud/replicad) | MIT **[VERIFICAR LICENSE]** | **Dependência (F7)** | B-rep, fillet, STEP |
| [donalffons/opencascade.js](https://github.com/donalffons/opencascade.js) | LGPL-2.1 | Dependência dinâmica, sem modificar | Base do replicad |
| [jscad/OpenJSCAD.org](https://github.com/jscad/OpenJSCAD.org) | MIT | **Copiar trechos** com aviso | Referência de API e export 3MF |
| [zalo/CascadeStudio](https://github.com/zalo/CascadeStudio) | MIT | Copiar trechos com aviso | Integração OCCT em worker |
| [gkjohnson/three-bvh-csg](https://github.com/gkjohnson/three-bvh-csg) | MIT | Dependência | Alternativa de CSG na prévia (se precisar) |
| [gkjohnson/three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) | MIT **[VERIFICAR]** | Dependência | Raycast rápido (seleção, parede fina) |
| [mapbox/earcut](https://github.com/mapbox/earcut) | ISC | Dependência | Triangulação 2D (preenchimento de perfis) |
| [AngusJohnson/Clipper2](https://github.com/AngusJohnson/Clipper2) | BSL-1.0 | Dependência (port JS **[VERIFICAR licença do port]**) | Offset e booleanas 2D |
| [microsoft/maker.js](https://github.com/microsoft/maker.js) | Apache-2.0 | Referência/copiar | Geometria 2D, DXF/SVG |
| [101arrowz/fflate](https://github.com/101arrowz/fflate) | MIT **[VERIFICAR]** | Dependência | Zip do 3MF |
| [opentypejs/opentype.js](https://github.com/opentypejs/opentype.js) | MIT **[VERIFICAR]** | Dependência | Texto 3D |
| [GridSpace/grid-apps](https://github.com/GridSpace/grid-apps) (Kiri:Moto) | MIT | Futuro | Fatiador web |
| [grab/cursor-talk-to-figma-mcp](https://github.com/grab/cursor-talk-to-figma-mcp) | MIT | Copiar padrão | Ponte MCP ↔ WebSocket |
| [ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp) | MIT | Referência | Design de tools |
| [3MFConsortium/spec_core](https://github.com/3MFConsortium/spec_core) | BSD-2 | Referência | Especificação 3MF |
| [xiangechen/chili3d](https://github.com/xiangechen/chili3d) | AGPL-3.0 | **Só olhar UX** | CAD web B-rep |
| [solvespace/solvespace](https://github.com/solvespace/solvespace) | GPL-3 | **Só olhar UX** | Solver/restrições |
| [FreeCAD/FreeCAD](https://github.com/FreeCAD/FreeCAD) | LGPL | Só referência | Sketcher |
| `@salusoft89/planegcs` | LGPL-2.0+ | Plano B do solver (dinâmico) | Solver de restrições |
| [modular_terrain_system](../../modular_terrain_system) (próprio) | Sem LICENSE (do próprio usuário) | **Copiar livremente** | §4.1 |

---

## 9. Licenças e dependências

- **Licença do projeto:** MIT (arquivo `LICENSE` desde o primeiro commit; o terrain não tem).
- **Regra:**
  - Copiar código só de MIT, Apache-2.0, BSD ou ISC, com aviso.
  - LGPL só como dependência dinâmica e não modificada (wasm separado), com aviso em `THIRD_PARTY.md`.
  - **GPL e AGPL nunca entram.**
- **`THIRD_PARTY.md`** lista cada dependência, a licença e o link.
- **Dependências do MVP** (alvo: poucas): `three`, `manifold-3d`, `fflate`, `earcut` (se o manifold não cobrir), `opentype.js` (F3), `@modelcontextprotocol/sdk` + `ws` (só no pacote MCP). Dev: `vite`, `typescript`, `tsx`.
- Nada de framework de UI, de estado ou de testes no MVP (padrão do terrain e do plotter). Testes com `node --test`.

---

## 10. Orçamentos de desempenho

| Métrica | Orçamento | Como medir |
|---|---|---|
| Carga inicial (transfer, gzip) | **≤ 1,5 MB** (JS + WASM manifold), sem OCCT | Build + `vite build --report`/tamanho de `dist` |
| Tempo até interativo (desktop médio) | ≤ 2 s em conexão boa | Lighthouse / Performance panel |
| Regeneração após editar uma cota (peça típica ≤ 30 features) | **≤ 300 ms** (orçamento do terrain) | HUD de desempenho |
| Solver de sketch durante arrasto (≤ 200 entidades) | ≤ 16 ms por iteração | Medição interna |
| Orbitar (≤ 500 mil triângulos) | 60 FPS em GPU integrada | Contador no HUD (opcional) |
| Export STL/3MF de peça típica | ≤ 2 s, com Cancelar | HUD |
| OCCT (F7) | Só carrega quando o usuário pede fillet 3D/STEP; aviso de "carregando ~10–15 MB" | — |
| Memória | Sem crescimento após 100 regenerações (liberar manifold) | Heap snapshot |

Premissas herdadas (§4.3) valem integralmente: worker + fila com cancelamento, debounce de 60 ms, `dispose()`, DPR ≤ 2, arestas off > 300 mil triângulos, sem GPU para geometria.

---

## 11. Roadmap por fases

As estimativas são em **sessões de trabalho com agente** (≈ 2–4 h cada) e são **chutes iniciais**, para revisar no plano de execução.

| Fase | Entrega visível | Escopo | Estimativa |
|---|---|---|---|
| **F0 Fundação** | Site no Pages com viewport, grid, volume da Mega S/P2S, layout vazio | Repo + MIT + Vite/TS + workspaces (`core`, `app`, `mcp`) + `pages.yml` com testes + graphify (hook versionado) + `tokens.css` (tema escuro + claro) + `textos.ts` (pt-BR centralizado) + preferências de navegação + layout de 3 colunas + viewport (reuso `vista.ts`) + navegação Blender + linha de comando (casca) + barra de status + documento `.3dm.json` + undo/redo + autosave IndexedDB | 2–3 |
| **F1 Sketch 2D** | Desenhar e cotar um perfil com restrições | Planos, ferramentas de desenho e edição, OSNAP/ORTHO/GRID/SNAP/DYN, solver próprio, cotas inline e temporárias, detecção de perfil, fillet/chanfro 2D, aliases | 4–6 |
| **F2 Sólidos** | Caixa com furos, padrão e tampa, editável por parâmetro | Extrude/revolve/booleanas/primitivas/shell prismático/furo/padrão/espelho/corte, árvore com rollback, parâmetros e expressões, G/R/S, medir, cotas 3D, worker com cache por feature | 4–6 |
| **F3 Impressão** | Exporta 3MF que abre no Bambu Studio (P2S) e PrusaSlicer (Mega S) | Perfis das 2 impressoras + 4 filamentos, verificação de imprimibilidade, apoiar na face, STL, 3MF core + sabores (com **spike** primeiro), multicor/AMS, miniatura, import STL/SVG, texto 3D, **modo customizar** | 5–7 |
| **F4 MCP** | "crie uma caixa 80×50×30…" no Claude Code gera o modelo ao vivo e o 3MF | Core em Node, servidor MCP stdio, ponte WS com token, ~20 tools, `captura`, recurso `docs://api`, modo headless | 3–4 |
| **= MVP** | | F0–F4 | **19–27 sessões** (subiu de 16–23 na rodada 1: tema claro, 4 filamentos, AMS, modo customizar) |
| F5 Desenho técnico | Folha SVG/PDF com vistas e cotas | Reuso `esquema.ts`, carimbo, export SVG/PDF, DXF import/export | 2–3 |
| F6 Calibração e perfis | Peça de teste → digita medidas → folgas aplicadas | Gerador de testes, registro de calibração, `calib.*`, upload de perfis Orca/Prusa/Cura/Klipper | 2–3 |
| F7 B-rep (OCCT) | Fillet em qualquer aresta e STEP | replicad sob demanda, seleção de arestas, export/import STEP | 4–6 |
| F8+ | Ideias | G-code (Kiri:Moto), PWA offline, inglês (i18n), seletor de idioma | — |

**Ordem de risco:** fazer o spike do **3MF com perfil** (F3) e o do **solver** (F1) cedo, porque são as duas maiores incertezas técnicas.

---

## 12. Definition of Done (DoD)

### 12.1 DoD global (vale para toda entrega)

1. `npm run build` passa (`tsc --noEmit` strict + `vite build`).
2. `npm test` passa: testes do core (`node --test`) + hashes de referência dos modelos-exemplo + `fechada()` em todos os exemplos.
3. **CI roda os testes antes do deploy.** O deploy só acontece se os testes passam (correção da lacuna do terrain).
4. **Grafo graphify atualizado no mesmo commit** (hook pre-commit; ver §16).
5. Verificado no navegador:
   - Desktop: o fluxo da entrega funciona de ponta a ponta.
   - **375 px**: a tela abre sem quebrar e a vista orbita.
6. Orçamentos de §10 não pioraram (HUD e tamanho do bundle anotados no PR/commit).
7. Toda ação nova da UI tem equivalente no MCP, ou está registrada como pendência explícita.
8. Docs atualizados: este documento (se mudou decisão) + `RETOMAR.md` (estado atual, padrão do terrain).
9. Sem dependência nova com licença fora da regra de §9. `THIRD_PARTY.md` atualizado.
10. Commit e push só quando o usuário pede (regra do usuário).

### 12.2 DoD por fase (critérios de aceite)

| Fase | Aceite |
|---|---|
| F0 | Site publicado abre em < 2 s. Grid e volume das 2 impressoras corretos (210×210×205 e 256×256×256). Home, numpad 1/3/7/5 e gizmo funcionam. Ctrl+Z/Y funciona num comando-teste. Recarregar recupera o projeto (IndexedDB). Hook do graphify roda num commit de teste. Alternar tema claro/escuro funciona e respeita `prefers-color-scheme`. Preset de navegação AutoCAD troca o pan para o botão do meio. Nenhum texto de UI fora de `textos.ts`. |
| F1 | Desenhar retângulo 80×50 com `REC` + `@80,50`. Cotar com `DIM` e mudar para `=L`. Sketch fica **verde** quando totalmente definido. Restrições H/V/I/T/E/B/D (letra sozinha, D31) funcionam, e `TR`/`EX`/`DI` digitados com seleção no sketch viram comando sem deixar restrição aplicada. Regra de teclado da §7.3 testada com uso real (D25): REC, RO, SC e G/R/S+eixo funcionam sem conflito. TR/EX/O/F funcionam. Solver resolve 200 entidades em ≤ 16 ms. Teste: 20 sketches de referência convergem. |
| F2 | Projeto-exemplo "caixa com tampa" 100% paramétrico. Mudar `L` regenera em ≤ 300 ms. Feature com erro fica vermelha sem quebrar as anteriores. G/R/S + eixo + número funcionam. Medir dá valores com 0,01 mm de precisão. |
| F3 | 3MF da P2S abre no Bambu Studio **com a P2S selecionada** (ou limitação documentada se o spike mostrar que é impossível). 3MF da Mega S abre no PrusaSlicer com o perfil. STL abre em qualquer slicer. Export bloqueia malha aberta. Peça maior que o volume mostra erro. Modo overhang funciona. **Uma peça real impressa em cada impressora** com medidas conferidas (±0,2 mm). Trocar o filamento muda massa e avisos (TPU na Mega S e ABS em impressora aberta avisam). Projeto com 2 corpos em slots diferentes abre no Bambu Studio com as cores e slots certos. Modo customizar abre por link, muda um parâmetro e exporta, inclusive em 375 px. |
| F4 | No Claude Code: `"usando o 3d modeling crie uma caixa 80×50×30 com parede 2"` → modelo aparece na aba aberta, o agente chama `captura` e `verificar_impressao`, e `exportar` grava o 3MF. Sem aba aberta, o modo headless gera o mesmo 3MF (hash idêntico ao da web). Conexão sem token é recusada. |
| F5 | Folha A4 com 4 vistas e cotas da bbox exporta SVG e PDF legíveis. |
| F6 | Fluxo de calibração completo numa impressora. `furo` de 5 mm nominal sai com a compensação. Peça de encaixe impressa encaixa como esperado. |
| F7 | Fillet de 2 mm numa aresta qualquer. STEP abre no Fusion/FreeCAD. O carregamento inicial do site não mudou (OCCT só sob demanda). |

---

## 13. Testes e verificação

- **Core (Node, `node --test`):**
  - Solver (casos de convergência e conflito)
  - Parser de expressões
  - Cada feature (volume e bbox esperados)
  - `fechada()`
  - Writers STL/3MF (estrutura do zip, XML válido)
  - Leitores de perfil
- **Regressão geométrica:** `ref_hashes.json` com hash do STL de cada projeto-exemplo (padrão do terrain).
- **MCP:** teste de integração headless (script chama as tools e compara o hash com a web).
- **Navegador:** verificação manual guiada por checklist (Browser pane / Playwright), em desktop e 375 px.
- **Impressão real:** uma peça de verificação por impressora a cada fase que mexe em export ou calibração.
- **CI:** `npm ci` → `npm test` → `npm run build` → deploy.

---

## 14. Riscos

| # | Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|---|
| R1 | Solver próprio não converge bem em sketches complexos | Média | Alto | Spike cedo na F1; plano B planegcs (LGPL dinâmico) |
| R2 | 3MF não pré-seleciona impressora no Bambu Studio/Prusa | Média | Médio | Spike no início da F3; fallback: 3MF core + instrução de perfil |
| R3 | Chanfro/fillet de borda com manifold fica feio ou lento | Média | Médio | Limitar ao 2D no MVP; fillet real na F7 |
| R4 | Navegador bloqueia `ws://127.0.0.1` vindo de página https (Local Network Access do Chrome, Safari) | Média | Alto | Testar na F0. Fallbacks: aceitar o prompt de permissão do Chrome · rodar o app local (`npm run dev`) · modo headless |
| R5 | Conflitos de atalho AutoCAD × Blender confundem | Média | Médio | Regra do §7.3 + opção para desligar as teclas imediatas + teste com o usuário na F1 |
| R6 | Captura de tela no modo headless (three em Node) | Alta | Baixo | Usar SVG do `esquema.ts` como captura headless; PNG só no modo ponte |
| R7 | Escopo cresce (é um CAD) | Alta | Alto | MVP fechado em F0–F4; o resto entra por decisão explícita. Válvula definida (D29): se a F3 estourar, o AMS sai primeiro |
| R8 | Nomeação topológica (sketch em face) | Alta | Médio | Captura de plano (§5.2); referências de aresta só na F7 |
| R9 | Specs da P2S de fonte secundária | Baixa | Baixo | Conferir no perfil oficial do Bambu Studio na F0 |

---

## 15. Questões

### 15.1 Resolvidas na rodada 1 (2026-11-08)

Q1–Q10 viraram as decisões **D15–D24** (§2):
- Q1 pan ajustável, padrão Blender
- Q2 `E` por contexto
- Q3 folhas na F5
- Q4 grafo versionado
- Q5 `3d-modeling-mcp` na porta 47800
- Q6 pt-BR centralizado
- Q7 PLA/PETG/TPU/ABS-ASA
- Q8 modo customizar no MVP
- Q9 AMS no MVP
- Q10 tema claro no MVP

### 15.2 Resolvidas na rodada 2 (2026-11-08)

Q11–Q16 viraram as decisões **D25–D30** (§2):
- Q11 regra de teclado aprovada, validar na F1
- Q12 PLA padrão nas duas
- Q13 tema claro desenhado na F0
- Q14 customizar aceita qualquer URL https
- Q15 escopo mantido, com o AMS como válvula
- Q16 atalhos conferidos por agente nas docs oficiais (§7.5)

### 15.3 Resolvida na rodada 3

Q17: as restrições do sketch ficam com letra sozinha, sem Shift (D31).

### 15.4 Abertas

| # | Pergunta | Proposta atual |
|---|---|---|
| Q18 | Conferir aliases do AutoCAD no acad.pgp da sua instalação e os atalhos do Revit no PDF oficial? | Você roda `(findfile "acad.pgp")` e manda o arquivo, ou fica para a F1 |

---

## 16. Regras do projeto

### 16.1 Graphify (sem LLM, a cada commit)

Mesmo mecanismo do terrain, corrigindo as falhas encontradas.

- **Hook versionado:** pasta `.githooks/` no repo + `git config core.hooksPath .githooks`. Um script `npm run setup` faz isso. No terrain os hooks não iam para o git e um clone novo ficava sem eles.
- **`.githooks/pre-commit`:**
  - Roda `graphify update . --force` (só AST, sem LLM), com `PYTHONHASHSEED=0` para o resultado ser reprodutível.
  - Depois faz `git add graphify-out/graph.json graphify-out/GRAPH_REPORT.md`.
- **`.gitignore`:** `graphify-out/*` + `!graphify-out/graph.json` + `!graphify-out/GRAPH_REPORT.md`. **Sem** a linha `graphify-out/`, que no terrain anulava as exceções.
- **CI (opcional, F0):** um job que roda `graphify update` e falha se o grafo commitado estiver desatualizado. Isso torna a regra verificável, não só um hook local **[VERIFICAR se graphify instala fácil no runner]**.
- Proibido `--no-verify`.

### 16.2 CLAUDE.md do projeto (proposta)

```markdown
# 3d-modeling
- Leia docs/PROJETO_BASE.md (visão, decisões) e RETOMAR.md (estado atual) antes de agir.
- Perguntas sobre o código: graphify primeiro (graphify-out/GRAPH_REPORT.md).
- Grafo atualizado no pre-commit (.githooks, só AST). Nunca --no-verify. Clone novo: npm run setup.
- Core (packages/core) sem DOM; roda no worker e no Node. UI e MCP só editam o documento.
- Toda ação da UI tem tool MCP equivalente (ou pendência registrada).
- Licenças: só MIT/Apache/BSD/ISC copiados; LGPL só dinâmico; GPL/AGPL nunca. Atualizar THIRD_PARTY.md.
- Orçamentos de desempenho: docs/PROJETO_BASE.md §10. Medir antes de dizer "pronto".
- Verificar no navegador (desktop + 375 px) antes de publicar.
- Commit/push só quando o usuário pedir.
```

### 16.3 Regras do usuário (herdadas)

pt-BR · modo ADHD (ação primeiro, passos numerados) · `ponytail` + `karpathy-guidelines` em código · sem Artifacts sem pedido · commit e push só sob pedido · verificar no navegador, inclusive em 375 px · worktrees só em `<repo>/.claude/worktrees/`.

---

## 17. Estrutura de pastas proposta

```
3d-modeling/
├─ packages/
│  ├─ core/            # TS puro: documento, comandos, solver, features, kernel (manifold), writers STL/3MF, perfis
│  │  ├─ printers/     # anycubic-i3-mega-s.json, bambu-p2s.json
│  │  └─ test/         # node --test + ref_hashes.json
│  ├─ app/             # Vite: index.html, tokens.css, layout, viewport, sketch UI, linha de comando, ponte MCP
│  └─ mcp/             # servidor MCP (stdio) + WebSocket local + modo headless
├─ examples/           # projetos-exemplo .3dm.json (caixa com tampa, suporte, etc.)
├─ docs/
│  └─ PROJETO_BASE.md  # este documento
├─ .githooks/          # pre-commit (graphify)
├─ .github/workflows/pages.yml
├─ graphify-out/       # graph.json + GRAPH_REPORT.md versionados
├─ CLAUDE.md · RETOMAR.md · README.md · LICENSE (MIT) · THIRD_PARTY.md
└─ package.json        # npm workspaces
```

---

## 18. Fontes

**Projetos locais analisados:**
- `C:\Users\augus\Desktop\augusto\projects\3dprinter_plotter` — `README.md`, `arquivo/estudo-plotter.md`, `arquivo/testes-fisicos/pen_holder_mega_s.gcode` (config PrusaSlicer), `arquivo/vpype.toml`, `src/exportar.js`
- `C:\Users\augus\Desktop\augusto\projects\modular_terrain_system` — `web/index.html`, `web/src/vista.ts`, `sistema.ts`, `bloco.ts`, `cotas.ts`, `esquema.ts`, `cliente.ts`, `gera.worker.ts`, `RETOMAR.md`, `docs/PLANO_UI.md`, `docs/MIGRACAO.md`, `CLAUDE.md`, `.github/workflows/pages.yml`, `.git/hooks/*`

**Bambu Lab P2S:** [Micro Center](https://www.microcenter.com/quickview/705069/bambu-lab-p2s-3d-printer) · [Makerpoint](https://www.makerpoint.nl/en-gb/3d-printing/3d-printers/bambu-lab-all/bambu-lab-p2s-210000007716) · [3DPros](https://3dpros.com/printers/bambu-lab-p2s) · [printer-hub review](https://printer-hub.ru/en/posts/bambu-lab-p2s-review) · [LDLC](https://www.ldlc.com/en/product/PB00723339.html)

**Ferramentas e repos:** [Onshape shortcuts](https://cad.onshape.com/help/Content/shortcut_keys.htm) · [Onshape free export](https://forum.onshape.com/discussion/10703/export-in-free-version) · [Fusion pessoal](https://www.autodesk.com/products/fusion-360/blog/changes-to-fusion-360-for-personal-use/) · [Womp](https://womp.com/solutions/designers/) · [Spline pricing](https://spline.design/pricing) · [Zoo FAQ](https://docs.zoo.dev/docs/faq) · [MakerWorld Parametric (All3DP)](https://all3dp.com/4/bambu-labs-parametric-model-maker-brings-openscad-to-makerworld/) · [Thingiverse Customizer](https://www.thingiverse.com/apps/customizer/) · [Kiri:Moto FAQ](https://docs.grid.space/kiri-moto/faq) · [OpenSCAD](https://en.wikipedia.org/wiki/OpenSCAD) · [openscad-playground](https://github.com/openscad/openscad-playground) · [CadQuery](https://github.com/CadQuery/cadquery) · [build123d](https://github.com/gumyr/build123d) · [JSCAD](https://github.com/jscad/OpenJSCAD.org) · [replicad](https://github.com/sgenoud/replicad) · [manifold](https://github.com/elalish/manifold) · [opencascade.js](https://ocjs.org/docs/about) · [Chili3D](https://github.com/xiangechen/chili3d) · [CascadeStudio](https://github.com/zalo/CascadeStudio) · [SolveSpace](https://github.com/solvespace/solvespace) · [planegcs](https://cdn.jsdelivr.net/npm/@salusoft89/planegcs@1.1.7/README.md) · [three-bvh-csg](https://github.com/gkjohnson/three-bvh-csg) · [Clipper2](https://github.com/AngusJohnson/Clipper2) · [earcut](https://github.com/mapbox/earcut) · [maker.js](https://github.com/microsoft/maker.js)

**3MF e slicers:** [3MF spec core](https://github.com/3MFConsortium/spec_core) · [PrusaSlicer 3mf.cpp](https://github.com/prusa3d/PrusaSlicer/blob/master/src/libslic3r/Format/3mf.cpp) · [Inside a Bambu/Orca 3MF](https://dev.to/joyfunc/whats-actually-inside-a-bambuorca-3mf-24p0) · [three-3mf-exporter](https://cdn.jsdelivr.net/npm/three-3mf-exporter@0.0.4/package.json) · [Orca profiles](https://www.orcaslicer.com/wiki/developer_reference/how_to_create_profiles) · [Orca tolerance calib](https://www.orcaslicer.com/wiki/calibration/tolerance-calib) · [CaliCross](https://makerworld.com/en/models/15531) · [Klipper Config Reference](https://raw.githubusercontent.com/Klipper3d/klipper/master/docs/Config_Reference.md)

**MCP:** [blender-mcp](https://github.com/ahujasid/blender-mcp) · [talk-to-figma-mcp](https://github.com/grab/cursor-talk-to-figma-mcp) · [openscad-mcp-server (alexlenk)](https://pypi.org/project/openscad-mcp-server/) · [quellant/openscad-mcp](https://github.com/quellant/openscad-mcp) · [jkoets/OpenSCAD-MCP](https://github.com/jkoets/OpenSCAD-MCP) · [theosib/FreeCAD-MCP-Server](https://github.com/theosib/FreeCAD-MCP-Server) · [cadquery-mcp](https://pypi.org/project/cadquery-mcp/)

**Lacunas de pesquisa:** atalhos de AutoCAD, Revit e Blender vêm do conhecimento do modelo, sem conferência em fonte. As licenças marcadas [VERIFICAR] ainda não foram lidas no arquivo LICENSE. Não foi testado empiricamente se o 3MF pré-seleciona o perfil.
