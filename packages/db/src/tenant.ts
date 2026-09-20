import { and, eq } from 'drizzle-orm';

import type { Db } from './client.js';
import { istituti } from './schema/istituti.js';

/**
 * Unica query di lookup tenant-da-slug (docs/02-architettura.md §
 * Risoluzione del tenant): usata sia dal middleware Next.js (task 0.6) sia
 * dal plugin tenant di Fastify (task 0.7), per non far divergere la
 * definizione di "tenant risolvibile" tra i due. Un istituto sospeso o
 * cessato non è risolvibile: niente cache qui dentro, è responsabilità di
 * chi chiama (il middleware web la aggiunge, l'API per ora no).
 */
export async function trovaIstitutoAttivoDaSlug(db: Db, slug: string): Promise<{ id: string } | null> {
  const righe = await db
    .select({ id: istituti.id })
    .from(istituti)
    .where(and(eq(istituti.slug, slug), eq(istituti.stato, 'attivo')));

  return righe[0] ?? null;
}
