# 3d-modeling

CAD paramétrico no navegador para impressão 3D (Anycubic i3 Mega S e Bambu Lab P2S). Sem servidor.
Visão e decisões: `docs/PROJETO_BASE.md`. Estado: `RETOMAR.md`.

```
npm install
npm run setup   # ativa o hook do graphify (.githooks)
npm run dev     # http://localhost:5173
npm test        # node --test (Node 25, sem tsx)
npm run build   # tsc strict + vite build
```

Pacotes: `packages/core` (TS puro, sem DOM) · `packages/app` (Vite, DOM à mão) · `packages/mcp` (F4).

## MCP (Claude Code)

Depois do `npm run build`: `claude mcp add 3dm -- node <caminho>/packages/mcp/bin/3d-modeling-mcp.mjs`.
O servidor serve o app em `http://127.0.0.1:47800/#token=…` (o link sai no stderr). Com a aba aberta, as tools editam o projeto da aba ao vivo; sem aba, rodam headless.
Variáveis: `MODELING_MCP_DIR` (pasta dos `.3dm.json`, padrão `./3dm-projetos`), `MODELING_MCP_PORT`, `MODELING_MCP_PONTE=0` (desliga a ponte).
Licença MIT. Dependências em `THIRD_PARTY.md`.
