import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';

// origens extras exatas, separadas por virgula (so para teste do R4)
const EXTRAS = (process.env.MODELING_MCP_ORIGINS || '').split(',').filter(Boolean);
const ORIGENS_OK = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/([a-z0-9-]+\.)+github\.io$/i,
];

// ponytail: comparar digests SHA-256 evita vazar o tamanho do token no timingSafeEqual.
const digest = (s) => createHash('sha256').update(s).digest();

function tokenDoPedido(req) {
  const proto = (req.headers['sec-websocket-protocol'] ?? '')
    .split(',')
    .map((p) => p.trim())
    .find((p) => p.startsWith('token.'));
  if (proto) return proto.slice('token.'.length);
  return new URL(req.url, 'http://127.0.0.1').searchParams.get('token') ?? '';
}

export function iniciar({
  porta = Number(process.env.MODELING_MCP_PORT) || 47800,
  token = randomUUID() + randomUUID(),
} = {}) {
  const esperado = digest(token);

  const wss = new WebSocketServer({
    host: '127.0.0.1',
    port: porta,
    handleProtocols: (protocolos) => [...protocolos].find((p) => p.startsWith('token.')) ?? false,
    verifyClient: ({ origin, req }, cb) => {
      if (origin && !ORIGENS_OK.some((r) => r.test(origin)) && !EXTRAS.includes(origin)) return cb(false, 403, 'origem nao permitida');
      if (!timingSafeEqual(digest(tokenDoPedido(req)), esperado)) return cb(false, 401, 'token invalido');
      cb(true);
    },
  });

  wss.on('connection', (ws) => {
    ws.on('message', (dados) => {
      let msg;
      try {
        msg = JSON.parse(String(dados));
      } catch {
        return;
      }
      if (msg?.tipo === 'ping') ws.send(JSON.stringify({ tipo: 'pong' }));
    });
  });

  return new Promise((resolve, reject) => {
    wss.once('error', reject);
    wss.once('listening', () => {
      wss.off('error', reject);
      wss.on('error', reject);
      resolve({
        token,
        porta: wss.address().port,
        wss,
        fechar: () =>
          new Promise((ok) => {
            for (const c of wss.clients) c.terminate();
            wss.close(() => ok());
          }),
      });
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const s = await iniciar();
  console.log(`MCP ponte em ws://127.0.0.1:${s.porta}`);
  console.log(`TOKEN: ${s.token}`);
}
