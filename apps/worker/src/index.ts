import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { CODA_EMAIL, leggiEnv } from '@gestilab/shared';

import { inviaEmail } from './email/invia.js';
import { creaTrasporto } from './email/trasporto.js';
import { creaLogger } from './logger.js';

// Consumatore della coda "email" (docs/02-architettura.md § Servizi:
// worker = stessa immagine di apps/api, entrypoint diverso). Un solo
// processo, concorrenza bassa: gli SMTP transazionali gratuiti limitano il
// ritmo, e nessuna email di GestiLab è urgente al secondo.
const env = leggiEnv();
const log = creaLogger(env.LOG_LEVEL);
const trasporto = creaTrasporto(env.SMTP_URL);
const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

const worker = new Worker(
  CODA_EMAIL,
  async (job) => {
    const esito = await inviaEmail(trasporto, env.EMAIL_MITTENTE, job.data);
    log.info({ jobId: job.id, tipo: job.name, oggetto: esito.oggetto }, 'email inviata');
  },
  { connection, concurrency: 2 },
);

worker.on('failed', (job, errore) => {
  log.error({ jobId: job?.id, tipo: job?.name, tentativo: job?.attemptsMade, errore: errore.message }, 'email non inviata');
});
worker.on('error', (errore) => {
  log.error({ errore: errore.message }, 'errore del worker');
});

log.info({ coda: CODA_EMAIL }, 'worker in ascolto');

// Arresto pulito su SIGTERM/SIGINT (docker compose stop): finisce il job in
// corso, poi chiude Redis e SMTP.
async function arresta(segnale: string): Promise<void> {
  log.info({ segnale }, 'arresto del worker');
  await worker.close();
  await connection.quit();
  trasporto.close();
}
process.on('SIGTERM', () => void arresta('SIGTERM'));
process.on('SIGINT', () => void arresta('SIGINT'));
