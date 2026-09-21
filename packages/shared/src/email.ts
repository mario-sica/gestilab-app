import { z } from 'zod';

// Contratto tra chi accoda un'email (apps/api) e chi la invia
// (apps/worker, BullMQ — docs/02-architettura.md § Servizi). Il payload è
// validato con Zod da entrambe le parti: l'API prima di accodare, il worker
// prima di inviare, così un job malformato viene rifiutato e loggato, mai
// spedito a metà.
//
// Solo i dati necessari al modello, mai oggetti di dominio interi: il job
// viaggia in Redis e resta nei log della coda, quindi contiene il minimo
// (docs/06-sicurezza-gdpr.md § 2.8).
export const CODA_EMAIL = 'email';

export const schemaJobEmailInvito = z.object({
  tipo: z.literal('invito'),
  a: z.string().email(),
  nome: z.string().min(1),
  istituto: z.string().min(1),
  link: z.string().url(),
  scadeIl: z.string().datetime(),
});

export const schemaJobEmail = z.discriminatedUnion('tipo', [schemaJobEmailInvito]);

export type JobEmail = z.infer<typeof schemaJobEmail>;
export type JobEmailInvito = z.infer<typeof schemaJobEmailInvito>;
