import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { istituti } from './istituti.js';
import { utenti } from './utenti.js';
import { policyIsolamentoTenant } from './_rls.js';

// docs/01-dominio.md — Gruppo A — plessi.

export const plessi = pgTable(
  'plessi',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    istitutoId: uuid('istituto_id')
      .notNull()
      .references(() => istituti.id),
    nome: text('nome').notNull(),
    indirizzo: text('indirizzo'),
    codiceMeccanograficoPlesso: text('codice_meccanografico_plesso'),
    createdBy: uuid('created_by').references(() => utenti.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabella) => [policyIsolamentoTenant(tabella.istitutoId)],
).enableRLS();
