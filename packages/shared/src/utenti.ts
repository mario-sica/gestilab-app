import { z } from 'zod';

import { RUOLI_UTENTE } from './ruoli.js';

// Dati per invitare un nuovo utente (RF-A2). Condiviso tra apps/api (corpo
// di POST /api/v1/admin/utenti/inviti) e la futura pagina /admin/utenti di
// apps/web (docs/CLAUDE.md regola 8: uno schema solo). trim + lowercase
// sull'email prima dell'unicità per istituto, così "Mario@x.it" e
// "mario@x.it" non diventano due utenti.
export const schemaNuovoInvitoUtente = z.object({
  email: z.string().trim().toLowerCase().email(),
  nome: z.string().trim().min(1).max(100),
  cognome: z.string().trim().min(1).max(100),
  ruolo: z.enum(RUOLI_UTENTE),
});

export type NuovoInvitoUtente = z.infer<typeof schemaNuovoInvitoUtente>;

// Riga dell'elenco utenti (GET /api/v1/admin/utenti): mai password_hash né
// segreti, solo ciò che la pagina /admin/utenti mostra. "invitato" = ha
// ancora la password da impostare (password_hash NULL).
export const schemaUtenteElenco = z.object({
  id: z.string().uuid(),
  email: z.string(),
  nome: z.string(),
  cognome: z.string(),
  ruolo: z.enum(RUOLI_UTENTE),
  attivo: z.boolean(),
  passwordImpostata: z.boolean(),
  ultimoAccesso: z.string().nullable(),
});

export type UtenteElenco = z.infer<typeof schemaUtenteElenco>;
