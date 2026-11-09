import { test } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { iniciar } from './servidor.mjs';

async function comServidor(fn) {
  const s = await iniciar({ porta: 0 });
  try {
    await fn(s);
  } finally {
    await s.fechar();
  }
}

const url = (s) => `ws://127.0.0.1:${s.porta}`;

// Espera o upgrade ser recusado e devolve o statusCode da resposta HTTP.
function statusRecusado(ws) {
  return new Promise((ok, erro) => {
    ws.on('error', () => {});
    ws.once('open', () => erro(new Error('conexao aberta sem deveria')));
    ws.once('unexpected-response', (_req, res) => {
      res.resume();
      ok(res.statusCode);
    });
  });
}

test('(a) token certo no subprotocolo abre e recebe pong', () =>
  comServidor(async (s) => {
    const ws = new WebSocket(url(s), ['token.' + s.token]);
    try {
      await new Promise((ok, erro) => {
        ws.once('open', ok);
        ws.once('error', erro);
      });
      const resposta = new Promise((ok) => ws.once('message', (d) => ok(JSON.parse(String(d)))));
      ws.send(JSON.stringify({ tipo: 'ping' }));
      assert.deepEqual(await resposta, { tipo: 'pong' });
    } finally {
      ws.terminate();
    }
  }));

test('(a2) token certo na query ?token= abre', () =>
  comServidor(async (s) => {
    const ws = new WebSocket(`${url(s)}/?token=${s.token}`);
    try {
      await new Promise((ok, erro) => {
        ws.once('open', ok);
        ws.once('error', erro);
      });
    } finally {
      ws.terminate();
    }
  }));

test('(b) sem token recebe 401', () =>
  comServidor(async (s) => {
    const ws = new WebSocket(url(s));
    try {
      assert.equal(await statusRecusado(ws), 401);
    } finally {
      ws.terminate();
    }
  }));

test('(c) token errado recebe 401', () =>
  comServidor(async (s) => {
    const ws = new WebSocket(url(s), ['token.errado']);
    try {
      assert.equal(await statusRecusado(ws), 401);
    } finally {
      ws.terminate();
    }
  }));

test('(d) Origin nao permitida recebe 403 mesmo com token certo', () =>
  comServidor(async (s) => {
    const ws = new WebSocket(url(s), ['token.' + s.token], { origin: 'https://evil.example' });
    try {
      assert.equal(await statusRecusado(ws), 403);
    } finally {
      ws.terminate();
    }
  }));

test('(e) servidor escuta so em 127.0.0.1', () =>
  comServidor(async (s) => {
    assert.equal(s.wss.address().address, '127.0.0.1');
  }));
