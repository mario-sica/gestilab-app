import Fastify from 'fastify';
import { ErroreDominio } from '@gestilab/shared';
import { describe, expect, it } from 'vitest';

import { pluginErrori } from './errori.js';

async function creaApp(): Promise<ReturnType<typeof Fastify>> {
  const app = Fastify({ logger: false });
  pluginErrori(app);
  app.get('/dominio', async () => {
    throw new ErroreDominio('TENANT_NON_TROVATO', 'Istituto non trovato.', 404);
  });
  app.get('/imprevisto', async () => {
    throw new Error('boom');
  });
  await app.ready();
  return app;
}

describe('pluginErrori', () => {
  it('un ErroreDominio risponde con codice e status suoi', async () => {
    const app = await creaApp();

    const risposta = await app.inject({ method: 'GET', url: '/dominio' });

    expect(risposta.statusCode).toBe(404);
    expect(risposta.json()).toEqual({
      errore: { codice: 'TENANT_NON_TROVATO', messaggio: 'Istituto non trovato.' },
    });
  });

  it('un errore non previsto risponde 500 senza dettagli interni', async () => {
    const app = await creaApp();

    const risposta = await app.inject({ method: 'GET', url: '/imprevisto' });

    expect(risposta.statusCode).toBe(500);
    expect(risposta.json()).toEqual({
      errore: { codice: 'ERRORE_INTERNO', messaggio: 'Si è verificato un errore interno.' },
    });
  });

  it('una rotta inesistente risponde 404 nello stesso formato', async () => {
    const app = await creaApp();

    const risposta = await app.inject({ method: 'GET', url: '/non-esiste' });

    expect(risposta.statusCode).toBe(404);
    expect(risposta.json()).toEqual({
      errore: { codice: 'RISORSA_NON_TROVATA', messaggio: 'Risorsa non trovata.' },
    });
  });
});
