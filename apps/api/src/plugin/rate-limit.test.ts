import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { ErroreDominio } from '@gestilab/shared';
import { Redis } from 'ioredis';
import { describe, expect, it } from 'vitest';

import { pluginErrori } from './errori.js';

// Integrazione: richiede il servizio "redis" del profilo dev in esecuzione.
// Non riusa pluginRateLimit (soglia 100/min, troppo lenta da esaurire in un
// test): stessa configurazione — store Redis, stesso formato di errore —
// con una soglia bassa per verificare il comportamento in pochi millisecondi.
const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error('REDIS_URL non impostata: avvia "pnpm dev" prima di eseguire questo test.');
}

describe('rate limit (store Redis)', () => {
  it('oltre la soglia risponde 429 nel formato di errore del progetto', async () => {
    // Chiave univoca per esecuzione: senza, due run del test entro lo stesso
    // minuto condividerebbero il contatore Redis del run precedente (stesso
    // IP 127.0.0.1 via inject) e il test diventerebbe intermittente.
    const chiaveTest = `test:${crypto.randomUUID()}`;

    const app = Fastify({ logger: false });
    pluginErrori(app);
    await app.register(rateLimit, {
      max: 2,
      timeWindow: '1 minute',
      keyGenerator: () => chiaveTest,
      redis: new Redis(redisUrl, { enableAutoPipelining: true }),
      errorResponseBuilder: () =>
        new ErroreDominio('TROPPE_RICHIESTE', 'Troppe richieste, riprova più tardi.', 429),
    });
    app.get('/limitata', async () => ({ ok: true }));
    await app.ready();

    await app.inject({ method: 'GET', url: '/limitata' });
    await app.inject({ method: 'GET', url: '/limitata' });
    const terza = await app.inject({ method: 'GET', url: '/limitata' });

    expect(terza.statusCode).toBe(429);
    expect(terza.json()).toEqual({
      errore: { codice: 'TROPPE_RICHIESTE', messaggio: 'Troppe richieste, riprova più tardi.' },
    });
  });
});
