import { boolean, index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { anniScolastici } from './anni-scolastici.js';
import { istituti } from './istituti.js';
import { policyIsolamentoTenant } from './_rls.js';

// docs/01-dominio.md — Gruppo A — persone (elenco segnalanti: docenti e
// altro personale, non gli utenti applicativi). Soft delete via
// eliminato_il (una delle sole due tabelle con soft delete, l'altra è
// asset). Indice trigram su nome+cognome per l'autocomplete di ricerca:
// richiede l'estensione pg_trgm, abilitata nella migrazione.

export const personaQualifica = pgEnum('persona_qualifica', [
  'docente',
  'collaboratore',
  'amministrativo',
  'altro',
]);

export const persone = pgTable(
  'persone',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    istitutoId: uuid('istituto_id')
      .notNull()
      .references(() => istituti.id),
    nome: text('nome').notNull(),
    cognome: text('cognome').notNull(),
    qualifica: personaQualifica('qualifica').notNull(),
    annoScolasticoId: uuid('anno_scolastico_id')
      .notNull()
      .references(() => anniScolastici.id),
    attivo: boolean('attivo').notNull().default(true),
    pinPersonaleHash: text('pin_personale_hash'),
    email: text('email'),
    eliminatoIl: timestamp('eliminato_il', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabella) => [
    index('persone_nome_cognome_trgm_idx')
      .using('gin', sql`(${tabella.nome} || ' ' || ${tabella.cognome}) gin_trgm_ops`),
    policyIsolamentoTenant(tabella.istitutoId),
  ],
).enableRLS();
