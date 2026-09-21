import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { CODA_EMAIL, schemaJobEmail, type JobEmail } from '@gestilab/shared';

export interface CodaEmail {
  accoda(job: JobEmail): Promise<void>;
}

declare module 'fastify' {
  interface FastifyInstance {
    codaEmail: CodaEmail;
  }
}

// Produttore della coda "email" (docs/02-architettura.md § Servizi: l'invio
// è lavoro di apps/worker, non della richiesta HTTP — un SMTP lento o giù
// non deve tenere in sospeso l'Admin che invita). Stesso Redis del rate
// limit; BullMQ vuole maxRetriesPerRequest: null sulla sua connessione.
//
// Il payload viene validato qui prima di accodare: un job che non rispetta
// il contratto è un bug del chiamante, meglio fallire subito nella
// richiesta che scoprirlo nel worker.
export const pluginCodaEmail = fp(async function pluginCodaEmail(app: FastifyInstance, opts: { redisUrl: string }) {
  const connection = new Redis(opts.redisUrl, { maxRetriesPerRequest: null });
  const coda = new Queue<JobEmail>(CODA_EMAIL, {
    connection,
    defaultJobOptions: {
      // Tre tentativi con attesa crescente (2 s, 4 s, 8 s): copre un
      // riavvio di Mailpit/SMTP, non un'indirizzo sbagliato — quello fallisce
      // tre volte e resta in "failed", visibile nelle metriche della coda.
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      // Il job completato non serve più: contiene un indirizzo email e un
      // link con token (docs/06 § 2.8), meglio che non resti in Redis.
      removeOnComplete: true,
      removeOnFail: 100,
    },
  });

  app.decorate('codaEmail', {
    async accoda(job: JobEmail): Promise<void> {
      const valido = schemaJobEmail.parse(job);
      await coda.add(valido.tipo, valido);
    },
  } satisfies CodaEmail);

  app.addHook('onClose', async () => {
    await coda.close();
    await connection.quit();
  });
});
