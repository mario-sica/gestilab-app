import Fastify from 'fastify';
import { creaClient } from '@gestilab/db';
import { describe, expect, it } from 'vitest';

import { pluginErrori } from './errori.js';
import { pluginTenant } from './tenant.js';

// Integrazione: richiede il servizio "db" del profilo dev, con il seed
// applicato (pnpm db:seed) — usa il tenant "dellaquila" (docs/04-...:
// "Integrazione | Vitest + Postgres in container").
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL non impostata: avvia "pnpm dev" prima di eseguire questo test.');
}

const db = creaClient(connectionString);

async function creaApp(): Promise<ReturnType<typeof Fastify>> {
  const app = Fastify({ logger: false });
  pluginErrori(app);
  await app.register(pluginTenant, { db });
  app.get('/protetta', async (request) => ({ tenantId: request.tenantId }));
  await app.ready();
  return app;
}

describe('pluginTenant', () => {
  it('senza header X-Tenant-Slug risponde 400', async () => {
    const app = await creaApp();

    const risposta = await app.inject({ method: 'GET', url: '/protetta' });

    expect(risposta.statusCode).toBe(400);
    expect(risposta.json().errore.codice).toBe('TENANT_MANCANTE');
  });

  it('con uno slug riservato risponde 404, non rivela nulla', async () => {
    const app = await creaApp();

    const risposta = await app.inject({
      method: 'GET',
      url: '/protetta',
      headers: { 'x-tenant-slug': 'www' },
    });

    expect(risposta.statusCode).toBe(404);
    expect(risposta.json().errore.codice).toBe('TENANT_NON_TROVATO');
  });

  it('con uno slug sconosciuto risponde 404', async () => {
    const app = await creaApp();

    const risposta = await app.inject({
      method: 'GET',
      url: '/protetta',
      headers: { 'x-tenant-slug': 'pippo-non-esiste' },
    });

    expect(risposta.statusCode).toBe(404);
    expect(risposta.json().errore.codice).toBe('TENANT_NON_TROVATO');
  });

  it('con lo slug di un istituto attivo, decora la request con tenantId', async () => {
    const app = await creaApp();

    const risposta = await app.inject({
      method: 'GET',
      url: '/protetta',
      headers: { 'x-tenant-slug': 'dellaquila' },
    });

    expect(risposta.statusCode).toBe(200);
    expect(risposta.json().tenantId).toEqual(expect.any(String));
  });
});
