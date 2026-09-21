import { describe, expect, it } from 'vitest';

import { costruisciApp } from './app.js';

import { leggiEnv } from '@gestilab/shared';

// Integrazione: richiede "redis" e "db" del profilo dev in esecuzione
// (rate limit, coda email, connessione dei moduli). L'ambiente completo
// viene da leggiEnv(), come in server.ts.
const env = leggiEnv();

describe('app', () => {
  it('/api/v1/salute risponde ok', async () => {
    const app = await costruisciApp({ ...env, LOG_LEVEL: 'error' });

    const risposta = await app.inject({ method: 'GET', url: '/api/v1/salute' });

    expect(risposta.statusCode).toBe(200);
    expect(risposta.json()).toEqual({ stato: 'ok' });
  });

  it('genera uno spec OpenAPI valido su /documentazione/json', async () => {
    const app = await costruisciApp({ ...env, LOG_LEVEL: 'error' });

    const risposta = await app.inject({ method: 'GET', url: '/documentazione/json' });

    expect(risposta.statusCode).toBe(200);
    const spec = risposta.json();
    expect(spec.openapi).toBeDefined();
    expect(spec.info.title).toBe('GestiLab API');
    expect(spec.paths['/api/v1/salute']).toBeDefined();
  });
});
