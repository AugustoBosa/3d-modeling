# Relatório SPK — spikes de risco (onda A)

| Tarefa | Status | Check | Resultado |
|---|---|---|---|
| SPK-1 Solver (R1) | ✅ GO | `node --test spikes/solver/*.test.ts` | 21/21; 199 entidades: 0,11 ms/iter; pior caso 400 vars: 0,38 ms/iter (meta 16) |
| SPK-2 3MF (R2) | ✅ GO condicional | `node --test spikes/3mf/teste.mjs` | 7/7; gera `spikes/3mf/out/{mega-s,p2s-2cores}.3mf`; pré-seleção só confirma no H2 |
| SPK-3 WS (R4) | ✅ | `node --test spikes/ws/teste.mjs` | 6/6 (token ok, sem token 401, errado 401, Origin ruim 403, só 127.0.0.1) |

## Comandos
```
node --test spikes/solver/*.test.ts
node --test spikes/3mf/teste.mjs
node --test spikes/ws/teste.mjs      # ou: node spikes/ws/teste.mjs
node spikes/solver/bench.ts
```
Obs.: `node --test spikes/solver/` (diretório) falha no Node 25; use o glob. O plano cita `node spikes/ws/teste.mjs`: roda, pois o arquivo usa node:test.

## Checklist de verificação manual (R4, browser pane)
1. `MODELING_MCP_ORIGINS=https://example.com node spikes/ws/servidor.mjs` (anote o TOKEN).
2. Abrir https://example.com, colar o snippet de `spikes/ws/pagina-teste.md` com o token. Esperado: `RECEBIDO {"tipo":"pong"}`. Se bloquear: Local Network Access / mixed content (fallbacks no .md).
3. Snippet sem token: esperado `RECUSADO (ok)`.

## Pendências (H2 e outros)
- Abrir `mega-s.3mf` no PrusaSlicer e `p2s-2cores.3mf` no Bambu Studio (instruções no RESULTADO.md do 3mf).
- NAO CONFIRMADO no 3MF: id de perfil da Mega S (não existe no repo do PrusaSlicer), `printer_model` da P2S (placeholder "Bambu Lab P2S"), nível de `extruder` no Prusa, `<part>` mínimo no Bambu. Artigo dev.to lido só em trechos. `3mf.cpp` do Prusa mudou de caminho (agora `src/slic3r-shared/.../3mf_legacy.cpp`).
- Origem: o servidor só aceita Origin localhost/127.0.0.1/*.github.io (+ `MODELING_MCP_ORIGINS`). Decidir na F4a se o site publicado é `*.github.io` (cobre) ou domínio próprio.

## Decisões
- Solver escrito pelo manager (não por worker) por ser o item mais crítico; SPK-2 e SPK-3 por workers Haiku, revisados e checks rodados por mim.
- `spikes/package.json` próprio com `fflate` e `ws`; `npm install` feito em `spikes/`.
- Ajuste meu no servidor WS: variável `MODELING_MCP_ORIGINS` para o teste do R4.

## Promoção
- F1: `spikes/solver/solver.ts` -> `packages/core/src/sketch/solver.ts` (TS puro, sem DOM). Atenção ao item 1 do RESULTADO.md.
- F3a: `spikes/3mf/escrever3mf.mjs`. F4a: `spikes/ws/servidor.mjs`.

## Riscos novos
Tangência quase-singular (1e-4 mm); chaves do Bambu/Prusa não verificadas em slicer real.
