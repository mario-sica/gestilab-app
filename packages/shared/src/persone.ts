import { z } from 'zod';

// Qualifiche dell'elenco segnalanti (docs/01-dominio.md — Gruppo A:
// persone, non utenti). Fonte unica: packages/db ne deriva l'enum
// Postgres (schema/persone.ts), stessa scelta già fatta per RUOLI_UTENTE
// — una lista sola, non due da tenere allineate.
export const QUALIFICHE_PERSONA = ['docente', 'collaboratore', 'amministrativo', 'altro'] as const;

export type QualificaPersona = (typeof QUALIFICHE_PERSONA)[number];

// GET /api/v1/docente/persone?query=… (task 1.5, autocomplete del login
// docente): pubblico, tenant-scoped, mai un dato più del necessario — solo
// ciò che serve a distinguere due persone con lo stesso nome nell'elenco.
export const schemaPersonaRicerca = z.object({
  id: z.string().uuid(),
  nome: z.string(),
  cognome: z.string(),
  qualifica: z.enum(QUALIFICHE_PERSONA),
});

export type PersonaRicerca = z.infer<typeof schemaPersonaRicerca>;
