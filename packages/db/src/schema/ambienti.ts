import { boolean, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { istituti } from './istituti.js';
import { plessi } from './plessi.js';
import { utenti } from './utenti.js';
import { policyIsolamentoTenant } from './_rls.js';

// docs/01-dominio.md — Gruppo A — ambienti.

export const ambienteTipo = pgEnum('ambiente_tipo', [
  'laboratorio',
  'aula',
  'ufficio',
  'deposito',
  'palestra',
  'altro',
]);

export const ambienti = pgTable(
  'ambienti',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    istitutoId: uuid('istituto_id')
      .notNull()
      .references(() => istituti.id),
    plessoId: uuid('plesso_id')
      .notNull()
      .references(() => plessi.id),
    tipo: ambienteTipo('tipo').notNull(),
    nome: text('nome').notNull(),
    codiceBreve: text('codice_breve').notNull(),
    piano: integer('piano'),
    // AR01…AR38: codice area tecnica, testo libero (elenco chiuso gestito
    // a livello applicativo, non un enum Postgres: cambia più spesso).
    areaAt: text('area_at'),
    qrToken: text('qr_token').notNull().unique(),
    attivo: boolean('attivo').notNull().default(true),
    createdBy: uuid('created_by').references(() => utenti.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabella) => [policyIsolamentoTenant(tabella.istitutoId)],
).enableRLS();
