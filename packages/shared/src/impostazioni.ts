import { z } from 'zod';

// docs/01-dominio.md — istituti.modalita_accesso_docente. Vive qui (non solo
// nell'enum Postgres di packages/db) perché apps/web lo mostra e lo
// validerà in un form; stessa scelta fatta per RUOLI_UTENTE.
export const MODALITA_ACCESSO_DOCENTE = ['solo_qr', 'pin_istituto', 'pin_personale', 'sso'] as const;
export type ModalitaAccessoDocente = (typeof MODALITA_ACCESSO_DOCENTE)[number];

// GET /api/v1/admin/impostazioni: stato, mai il PIN (che non è rileggibile —
// esiste solo l'hash). "pinImpostato" basta alla pagina per dire
// "impostato / mai generato".
export const schemaImpostazioni = z.object({
  modalitaAccessoDocente: z.enum(MODALITA_ACCESSO_DOCENTE),
  pinImpostato: z.boolean(),
});
export type Impostazioni = z.infer<typeof schemaImpostazioni>;

// POST /api/v1/admin/impostazioni/pin-docente: il PIN in chiaro, una volta.
export const schemaPinRigenerato = z.object({
  pin: z.string().regex(/^\d{6}$/),
  sessioniDocenteRevocate: z.number().int().nonnegative(),
});
export type PinRigenerato = z.infer<typeof schemaPinRigenerato>;
