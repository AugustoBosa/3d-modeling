# Dependências de terceiros

Regra (PROJETO_BASE §9): só MIT, Apache-2.0, BSD ou ISC são copiados; LGPL só como dependência dinâmica; GPL e AGPL nunca.
Este arquivo é conferido contra os `package.json` a cada fase.

## No bundle publicado (runtime)

| Pacote | Versão | Licença | Uso | Link |
|---|---|---|---|---|
| fflate | ^0.8.3 | MIT | Zip do 3MF (`packages/core/src/export`, `importar`) | https://github.com/101arrowz/fflate |
| opentype.js | ^2.0.0 | MIT | Texto 3D (`packages/core/src/texto`); carregado sob demanda, fora do bundle inicial | https://github.com/opentypejs/opentype.js |
| @fontsource/roboto (fonte Roboto) | ^5 | OFL-1.1 (fonte livre; o pacote npm é só empacotamento) | Fonte padrão do comando TEXTO, carregada só quando o comando roda | https://fontsource.org/fonts/roboto |
| manifold-3d | ^3.5.4 | Apache-2.0 | Kernel de sólidos (WASM) em `packages/core/src/kernel`; no navegador roda no worker de geometria | https://github.com/elalish/manifold |
| three (inclui `examples/jsm`: OrbitControls, ViewHelper) | ^0.187.0 | MIT | Viewport 3D | https://github.com/mrdoob/three.js |

Transitivos de `three` presentes no `node_modules` mas **fora do bundle** (importados só por addons que o app não usa): `@dimforge/rapier3d-compat` (Apache-2.0), `@tweenjs/tween.js` (MIT), `meshoptimizer` (MIT).

## Só de desenvolvimento (não publicados)

| Pacote | Versão | Licença | Uso | Link |
|---|---|---|---|---|
| vite | ^8.3.6 | MIT | Dev server e build | https://github.com/vitejs/vite |
| typescript | ^7.0.2 | Apache-2.0 | Checagem de tipos (`tsc --noEmit`) | https://github.com/microsoft/TypeScript |
| @types/node | ^26.6.6 | MIT | Tipos do Node (testes com `node:test`) | https://github.com/DefinitelyTyped/DefinitelyTyped |
| @types/three | ^0.187.0 | MIT | Tipos do three | https://github.com/DefinitelyTyped/DefinitelyTyped |

Transitivos do `vite` usados só no build: `rolldown` e `@oxc-project/*` (MIT), `picocolors` (ISC), `source-map-js` (BSD-3-Clause), `fdir` (MIT), e **`lightningcss` (MPL-2.0)**. O `lightningcss` roda só na máquina de build, não é copiado nem modificado, e nada dele vai para o `dist`; MPL-2.0 não é GPL/AGPL.

## Código copiado de projetos do mesmo autor (MIT)

| Origem | Arquivos aqui |
|---|---|
| `modular_terrain_system` (MIT, © 2026 Augusto Bosa) | `packages/app/src/viewport/esferas.ts`; base de `viewport/vista.ts` (gizmo, animação de vista); helpers de `ui.ts`; CSS de cards e layout |

## Previstas (ainda não instaladas)

`earcut` (ISC), `opentype.js` (MIT). Entram com a fase que as usa; atualizar este arquivo no mesmo passo.

## `packages/mcp` (F4a, Node; não vai no bundle do app)

| Pacote | Versão | Licença | Uso |
|---|---|---|---|
| @modelcontextprotocol/sdk | ^1.32.2 | MIT | Servidor MCP stdio |
| ws | ^8.22.2 | MIT | WebSocket da ponte |
| zod | ^4.6.7 | MIT | Schemas das tools (já exigido pelo SDK; fora da lista §0.5, justificado) |
| @types/ws | ^8.18.2 | MIT | Tipos (dev) |
