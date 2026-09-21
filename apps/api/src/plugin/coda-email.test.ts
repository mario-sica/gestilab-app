import Fastify from 'fastify';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { CODA_EMAIL } from '@gestilab/shared';
import { afterEach, describe, expect, it } from 'vitest';

import { pluginCodaEmail } from './coda-email.js';

// Integrazione: Redis reale del profilo dev (stessa coda che consumerà
// apps/worker). Ogni test parte da una coda vuota e la svuota alla fine.
const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error('REDIS_URL non impostata: avvia "pnpm dev" prima di questo test.');
}

const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
const coda = new Queue(CODA_EMAIL, { connection });

afterEach(async () => {
  await coda.obliterate({ force: true });
});

describe('pluginCodaEmail', () => {
  it('accoda un job valido sulla coda "email" con il payload intatto', async () => {
    const app = Fastify({ logger: false });
    await app.register(pluginCodaEmail, { redisUrl });
    await app.ready();
    const job = {
      tipo: 'invito' as const,
      a: 'x@esempio.test',
      nome: 'X',
      istituto: 'I',
      link: 'http://demo.localhost:3000/invito/t',
      scadeIl: new Date().toISOString(),
    };

    await app.codaEmail.accoda(job);

    const inAttesa = await coda.getWaiting();
    expect(inAttesa).toHaveLength(1);
    expect(inAttesa[0]!.name).toBe('invito');
    expect(inAttesa[0]!.data).toEqual(job);
    expect(inAttesa[0]!.opts.attempts).toBe(3);
    await app.close();
  });

  it('rifiuta un job che non rispetta il contratto senza accodarlo', async () => {
    const app = Fastify({ logger: false });
    await app.register(pluginCodaEmail, { redisUrl });
    await app.ready();

    await expect(
      app.codaEmail.accoda({ tipo: 'invito', a: 'non-una-email', nome: '', istituto: '', link: 'x', scadeIl: 'ieri' } as never),
    ).rejects.toThrow();

    expect(await coda.getWaiting()).toHaveLength(0);
    await app.close();
  });
});
