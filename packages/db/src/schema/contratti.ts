import { date, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { TIPI_CONTRATTO } from '@gestilab/shared';

import { fornitori } from './fornitori.js';
import { istituti } from './istituti.js';
import { policyIsolamentoTenant } from './_rls.js';

// docs/01-dominio.md — Gruppo B — contratti (assistenza, noleggio, garanzia
// estesa), legati a un fornitore.

export const contrattoTipo = pgEnum('contratto_tipo', TIPI_CONTRATTO);

export const contratti = pgTable(
  'contratti',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    istitutoId: uuid('istituto_id')
      .notNull()
      .references(() => istituti.id),
    fornitoreId: uuid('fornitore_id')
      .notNull()
      .references(() => fornitori.id),
    tipo: contrattoTipo('tipo').notNull(),
    riferimento: text('riferimento').notNull(),
    dataInizio: date('data_inizio').notNull(),
    dataFine: date('data_fine').notNull(),
    condizioni: text('condizioni'),
    comeRichiedereIntervento: text('come_richiedere_intervento'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabella) => [policyIsolamentoTenant(tabella.istitutoId)],
).enableRLS();
