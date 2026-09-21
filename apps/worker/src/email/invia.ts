import { schemaJobEmail, type JobEmail } from '@gestilab/shared';

import { modelloInvito, type Messaggio } from './modelli/invito.js';
import type { Trasporto } from './trasporto.js';

function componi(job: JobEmail): Messaggio {
  switch (job.tipo) {
    case 'invito':
      return modelloInvito(job);
  }
}

/**
 * Invia un'email della coda. Il payload viene rivalidato qui anche se
 * apps/api lo ha già fatto prima di accodare: tra i due c'è Redis, e un
 * job scritto da altro (uno script, una versione precedente) non deve
 * poter far partire un messaggio malformato.
 */
export async function inviaEmail(trasporto: Trasporto, mittente: string, payload: unknown): Promise<{ a: string; oggetto: string }> {
  const job = schemaJobEmail.parse(payload);
  const messaggio = componi(job);
  await trasporto.sendMail({ from: mittente, to: job.a, subject: messaggio.oggetto, text: messaggio.testo, html: messaggio.html });
  return { a: job.a, oggetto: messaggio.oggetto };
}
