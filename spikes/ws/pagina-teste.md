# Teste da ponte MCP (WebSocket) a partir de uma página https

Objetivo: provar que uma página https (ex.: https://example.com) consegue abrir `ws://127.0.0.1` com o token da sessão, e que sem token a conexão é recusada.

## 1. Subir o servidor

Na raiz do projeto:

```
node spikes/ws/servidor.mjs
```

Para testar a partir de https://example.com (origem fora da lista): `MODELING_MCP_ORIGINS=https://example.com node spikes/ws/servidor.mjs` (PowerShell: `$env:MODELING_MCP_ORIGINS='https://example.com'; node spikes/ws/servidor.mjs`).

A porta padrão é 47800. Para outra porta, defina a variável antes:

```
set MODELING_MCP_PORT=47801 && node spikes/ws/servidor.mjs     (cmd)
$env:MODELING_MCP_PORT=47801; node spikes/ws/servidor.mjs      (PowerShell)
```

O terminal mostra:

```
MCP ponte em ws://127.0.0.1:47800
TOKEN: <token>
```

Copie o `TOKEN`. Ele muda a cada execução.

## 2. Teste com token (deve funcionar)

Abra a página https no Chrome, abra o console (F12 > Console), cole o snippet e troque `COLE_O_TOKEN` pelo token:

```js
const t='COLE_O_TOKEN'; const w=new WebSocket('ws://127.0.0.1:47800',['token.'+t]); w.onopen=()=>w.send(JSON.stringify({tipo:'ping'})); w.onmessage=e=>console.log('RECEBIDO',e.data); w.onerror=()=>console.log('ERRO (bloqueado?)'); w.onclose=e=>console.log('FECHOU',e.code)
```

Resultado esperado: `RECEBIDO {"tipo":"pong"}`. Isso comprova o R4 (página https conversa com a ponte local).

Se aparecer `ERRO (bloqueado?)` ou nada chegar:

- Local Network Access: o Chrome pode pedir permissão para acessar a rede local. Aceite o prompt e rode o snippet de novo.
- Mixed content: confira se a página é mesmo https e se o endereço é `ws://127.0.0.1` (localhost é tratado como seguro pelo Chrome).
- Origin: o servidor recusa origens fora de `localhost`, `127.0.0.1` e `*.github.io`. Uma página em https://example.com envia `Origin: https://example.com` e recebe 403. Para testar de outra página https, suba o servidor com `MODELING_MCP_ORIGINS=https://example.com` (origens exatas, separadas por vírgula); sem isso o 403 é o comportamento correto.
- Fallbacks: rodar o app local (`http://localhost`), ou usar o Chrome em modo headless para isolar o problema.

## 3. Teste sem token (deve ser recusado)

Mesmo console, sem token:

```js
const w=new WebSocket('ws://127.0.0.1:47800'); w.onopen=()=>console.log('ABRIU (nao deveria)'); w.onerror=()=>console.log('RECUSADO (ok)'); w.onclose=e=>console.log('FECHOU',e.code)
```

Resultado esperado: `RECUSADO (ok)` e nenhum `ABRIU`. O servidor responde 401 no handshake.
