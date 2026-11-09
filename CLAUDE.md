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
