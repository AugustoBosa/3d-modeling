# RETOMAR — 3d-modeling

**Última atualização:** 2026-11-09 · **Fase atual:** MVP (F0–F4) implementado, validado e publicado · **Repo:** https://github.com/AugustoBosa/3d-modeling (público) · **Site:** https://augustobosa.github.io/3d-modeling/ · **Detalhes:** `docs/orq/STATUS.md`

## Como rodar

`npm install` · `npm run setup` (hook do graphify; já feito neste clone) · `npm run dev` (5173) · `npm test` (768 testes) · `npm run build`.
MCP no Claude Code: ver `README.md` (`claude mcp add 3dm -- node <caminho>/packages/mcp/bin/3d-modeling-mcp.mjs`).

## O que existe

| Fase | Entrega |
|---|---|
| F0 | Casca, viewport (2 impressoras), linha de comando, tema, presets, IndexedDB, CI do Pages |
| F1 | Sketch com solver (200 entidades em ~6 ms), restrições por letra (§7.3), cotas com expressão, edição AutoCAD |
| F2 | Features paramétricas (extrude, revolve, primitivas, booleanas, shell, furo, padrão, chanfro/fillet de borda), G/R/S e gizmo `W`, medir, exemplo "caixa com tampa" |
| F3 | Painel Imprimir (filamento, massa, avisos, overhang, apoiar na face), STL/3MF com perfil, AMS e miniatura, importar STL/3MF/OBJ/SVG, `TEXTO`, modo customizar por link, recentes |
| F4 | MCP stdio com 45 tools, headless (mesmo hash do app) e ponte ao vivo com a aba (`http://127.0.0.1:47800/#token=…`), captura PNG |

Relatórios por fase: `docs/orq/relatorio-*.md`. Paridade UI × MCP: `docs/orq/paridade-mcp.md`.

## Pendências do usuário (H)

| # | O quê |
|---|---|
| H1 | ✅ 2026-11-09: repo criado, push feito, Pages via GitHub Actions no ar |
| H2 | Abrir `packages/core/test/saida/caixa-com-tampa-bambu-p2s.3mf` no Bambu Studio (P2S, slots 1 e 2) e `caixa-com-tampa-anycubic-i3-mega-s.3mf` no PrusaSlicer |
| H3 | Imprimir uma peça em cada impressora e medir (±0,2 mm) |
| H4 | Usar de verdade: teclado §7.3, clique em `LF`, arrastar arquivo para importar, Salvar como/Abrir (File System Access), toque no celular |
| H5 | `claude auth login`, registrar o MCP e pedir: "usando o 3d modeling crie uma caixa 80×50×30 com parede 2" |
| H6 | Q18: conferir aliases do `acad.pgp` |
| H7 | No Chrome, abrir o site do Pages com o MCP rodando e aceitar "acessar dispositivos da rede local" (R4). Sem isso, usar o link `http://127.0.0.1:47800` que o MCP imprime |

## Lacunas conhecidas (não bloqueiam o MVP)

- MCP: `sketch_adicionar` não cria oblongo/elipse nem arco tangente; slot por corpo exige cor. Lista completa no fim da `paridade-mcp.md`.
- UI: entrar no sketch por duplo clique na árvore; corte pelas faces.
- Fillet/chanfro só em borda topo/base do extrude (aresta qualquer = F7, OCCT).

## Próximas fases (§11 do `PROJETO_BASE.md`, ainda sem plano)

F5 desenho técnico (folha SVG/PDF) · F6 calibração e perfis · F7 B-rep (OCCT, fillet em aresta, STEP) · F8+ ideias.

## Regras do usuário

- Resposta em pt-BR; modo ADHD (ação primeiro, passos numerados).
- `ponytail` + `karpathy-guidelines` em código.
- Não criar Artifacts sem pedido. Commit e push só quando o usuário pedir.
- Verificar no navegador, também em 375 px.
- Worktrees só dentro de `<repo>/.claude/worktrees/`.
