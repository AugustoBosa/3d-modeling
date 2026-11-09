# Relatório F4b-r3 — tools do F3b

Sem commit/push. `npm run build` ok; `npm test`: 768 testes, 0 falhas. Total: 45 tools.

| Tarefa | Estado | Check |
|---|---|---|
| 1 `filamento_definir`, `slots_definir` (`cor_definir` já cobre cor+slot por corpo, não duplicado) | ✅ | `tools-f3b.test.ts` |
| 2 `apoiar_na_face(corpo, normal)` | ✅ | `tools-f3b.test.ts` (face +X vira base; normal sem face lista as disponíveis) |
| 3 `importar_svg` (texto ou caminho dentro de MODELING_MCP_DIR, sem traversal) | ✅ | `tools-f3b2.test.ts` |
| 4 `texto_3d` (Roboto de `node_modules/@fontsource/roboto`) | ✅ | `tools-f3b2.test.ts` |
| 5 expor parâmetro | ✅ já existia: `parametros_expostos` define/remove/lista | `tools-extra2.test.ts` |
| 6 `paridade-mcp.md` | ✅ | leitura |

Workers Haiku: 2 (f3b: filamento/slots/apoiar; f3b2: svg/texto). Eu registrei em `tools.ts` e a doc.

Verificação: `npm run build && npm test`.

Decisões: `apoiar_na_face` escolhe o maior triângulo a até 10° da normal pedida (a face pedida vai para baixo). `filamentoDe` de tools-modelo é privada, então a validação foi duplicada num helper local. Fonte lida por caminho relativo ao monorepo (funciona com node_modules hoisted). Sem mudança fora de `packages/mcp` e docs.

Pendências: ver "Lacunas restantes" em `paridade-mcp.md`. Sem teste novo em modo ponte (o despacho genérico já cobre tools que mudam o documento). Sem checklist de navegador.
