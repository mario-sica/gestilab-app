import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { istituti } from './istituti.js';
import { policyIsolamentoTenant } from './_rls.js';

// docs/01-dominio.md — Gruppo B — fornitori.

export const fornitori = pgTable(
  'fornitori',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    istitutoId: uuid('istituto_id')
      .notNull()
      .references(() => istituti.id),
    nome: text('nome').notNull(),
    telefono: text('telefono'),
    email: text('email'),
    portaleAssistenza: text('portale_assistenza'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabella) => [policyIsolamentoTenant(tabella.istitutoId)],
).enableRLS();
