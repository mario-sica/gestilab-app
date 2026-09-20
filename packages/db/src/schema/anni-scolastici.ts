import { boolean, date, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { istituti } from './istituti.js';
import { utenti } from './utenti.js';
import { policyIsolamentoTenant } from './_rls.js';

// docs/01-dominio.md — Gruppo A — anni_scolastici. Un solo corrente=true
// per istituto: indice unico parziale.

export const anniScolastici = pgTable(
  'anni_scolastici',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    istitutoId: uuid('istituto_id')
      .notNull()
      .references(() => istituti.id),
    codice: text('codice').notNull(),
    dataInizio: date('data_inizio').notNull(),
    dataFine: date('data_fine').notNull(),
    corrente: boolean('corrente').notNull().default(false),
    createdBy: uuid('created_by').references(() => utenti.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabella) => [
    uniqueIndex('anni_scolastici_istituto_id_codice_idx').on(tabella.istitutoId, tabella.codice),
    uniqueIndex('anni_scolastici_un_corrente_per_istituto_idx')
      .on(tabella.istitutoId)
      .where(sql`${tabella.corrente} = true`),
    policyIsolamentoTenant(tabella.istitutoId),
  ],
).enableRLS();
