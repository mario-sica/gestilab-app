import { describe, expect, it } from 'vitest';

import { costruisciApp } from './app.js';

// Integrazione: richiede il servizio "redis" del profilo dev in esecuzione
// (usato dal plugin rate-limit).
const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error('REDIS_URL non impostata: avvia "pnpm dev" prima di eseguire questo test.');
}

describe('app', () => {
  it('/api/v1/salute risponde ok', async () => {
    const app = await costruisciApp({ LOG_LEVEL: 'error', REDIS_URL: redisUrl });

    const risposta = await app.inject({ method: 'GET', url: '/api/v1/salute' });

    expect(risposta.statusCode).toBe(200);
    expect(risposta.json()).toEqual({ stato: 'ok' });
  });

  it('genera uno spec OpenAPI valido su /documentazione/json', async () => {
    const app = await costruisciApp({ LOG_LEVEL: 'error', REDIS_URL: redisUrl });

    const risposta = await app.inject({ method: 'GET', url: '/documentazione/json' });

    expect(risposta.statusCode).toBe(200);
    const spec = risposta.json();
    expect(spec.openapi).toBeDefined();
    expect(spec.info.title).toBe('GestiLab API');
    expect(spec.paths['/api/v1/salute']).toBeDefined();
  });
});
