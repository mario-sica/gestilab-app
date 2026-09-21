import { CODA_EMAIL, leggiEnv } from '@gestilab/shared';
import { Queue, QueueEvents, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { inviaEmail } from './invia.js';
import { creaTrasporto } from './trasporto.js';

// Integrazione vera: SMTP di Mailpit (SMTP_URL) e la sua API HTTP per
// rileggere il messaggio — "flusso completo con mailpit" (task 1.3). In
// CI Mailpit è un servizio del job; MAILPIT_API_URL è una variabile solo
// di test, non parte di leggiEnv().
const env = leggiEnv();
const mailpitApi = process.env.MAILPIT_API_URL ?? 'http://mailpit:8025';

interface MessaggioMailpit {
  ID: string;
  Subject: string;
  To: { Address: string }[];
}

async function cercaInMailpit(destinatario: string, tentativi = 20): Promise<MessaggioMailpit | undefined> {
  for (let tentativo = 0; tentativo < tentativi; tentativo++) {
    const risposta = await fetch(`${mailpitApi}/api/v1/search?query=${encodeURIComponent(`to:${destinatario}`)}`);
    const corpo = (await risposta.json()) as { messages: MessaggioMailpit[] };
    if (corpo.messages.length > 0) {
      return corpo.messages[0];
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return undefined;
}

async function testoMessaggio(id: string): Promise<{ Text: string; HTML: string }> {
  return (await (await fetch(`${mailpitApi}/api/v1/message/${id}`)).json()) as { Text: string; HTML: string };
}

const trasporto = creaTrasporto(env.SMTP_URL);
afterAll(() => trasporto.close());
afterEach(async () => {
  await fetch(`${mailpitApi}/api/v1/messages`, { method: 'DELETE' });
});

function jobInvito(destinatario: string) {
  return {
    tipo: 'invito' as const,
    a: destinatario,
    nome: 'Anna',
    istituto: 'Liceo di Prova',
    link: 'http://prova.localhost:3000/invito/token-abc',
    scadeIl: '2030-06-15T10:00:00.000Z',
  };
}

describe('inviaEmail', () => {
  it('consegna a Mailpit un invito con oggetto, nome, istituto e link nel testo e nell’HTML', async () => {
    const destinatario = `invitata-${Date.now()}@esempio.test`;

    await inviaEmail(trasporto, env.EMAIL_MITTENTE, jobInvito(destinatario));

    const messaggio = await cercaInMailpit(destinatario);
    expect(messaggio).toBeDefined();
    expect(messaggio!.Subject).toBe('Invito a GestiLab — Liceo di Prova');
    expect(messaggio!.To[0]!.Address).toBe(destinatario);
    const { Text, HTML } = await testoMessaggio(messaggio!.ID);
    expect(Text).toContain('Ciao Anna');
    expect(Text).toContain('http://prova.localhost:3000/invito/token-abc');
    expect(Text).toContain('15 giugno 2030');
    expect(HTML).toContain('href="http://prova.localhost:3000/invito/token-abc"');
  });

  it('rifiuta un payload fuori contratto senza inviare nulla', async () => {
    await expect(inviaEmail(trasporto, env.EMAIL_MITTENTE, { tipo: 'invito', a: 'x' })).rejects.toThrow();
    expect(await cercaInMailpit('x', 2)).toBeUndefined();
  });
});

describe('coda email → worker → Mailpit', () => {
  it('un job accodato su "email" viene consumato e consegnato', async () => {
    const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
    const coda = new Queue(CODA_EMAIL, { connection });
    await coda.obliterate({ force: true });
    const destinatario = `dalla-coda-${Date.now()}@esempio.test`;
    const worker = new Worker(CODA_EMAIL, async (job) => void (await inviaEmail(trasporto, env.EMAIL_MITTENTE, job.data)), {
      connection,
    });
    // QueueEvents, non worker.on('completed'): in sviluppo il container
    // "worker" ascolta la stessa coda e potrebbe prendere lui il job — il
    // test verifica che il job accodato venga consegnato, da chiunque.
    const eventi = new QueueEvents(CODA_EMAIL, { connection: new Redis(env.REDIS_URL, { maxRetriesPerRequest: null }) });
    await eventi.waitUntilReady();

    const job = await coda.add('invito', jobInvito(destinatario));
    await job.waitUntilFinished(eventi, 10_000);

    const messaggio = await cercaInMailpit(destinatario);
    expect(messaggio?.Subject).toContain('Invito a GestiLab');

    await worker.close();
    await eventi.close();
    await coda.close();
    await connection.quit();
  });
});
