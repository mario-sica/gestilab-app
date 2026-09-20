import { date, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { ambienti } from './ambienti.js';
import { anniScolastici } from './anni-scolastici.js';
import { istituti } from './istituti.js';
import { utenti } from './utenti.js';
import { policyIsolamentoTenant } from './_rls.js';

// docs/01-dominio.md — Gruppo A — affidamenti_ambienti. Mai cancellati: per
// chiudere un affidamento si valorizza data_fine, non si elimina la riga.
// Più AT per ambiente ammessi (nessun vincolo di unicità su ambiente_id).

export const affidamentiAmbienti = pgTable(
  'affidamenti_ambienti',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    istitutoId: uuid('istituto_id')
      .notNull()
      .references(() => istituti.id),
    utenteId: uuid('utente_id')
      .notNull()
      .references(() => utenti.id),
    ambienteId: uuid('ambiente_id')
      .notNull()
      .references(() => ambienti.id),
    annoScolasticoId: uuid('anno_scolastico_id')
      .notNull()
      .references(() => anniScolastici.id),
    dataInizio: date('data_inizio').notNull(),
    dataFine: date('data_fine'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabella) => [policyIsolamentoTenant(tabella.istitutoId)],
).enableRLS();
