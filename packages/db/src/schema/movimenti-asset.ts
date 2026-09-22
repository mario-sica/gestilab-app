import { date, index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { TIPI_MOVIMENTO_ASSET } from '@gestilab/shared';

import { ambienti } from './ambienti.js';
import { asset } from './asset.js';
import { istituti } from './istituti.js';
import { utenti } from './utenti.js';
import { policyIsolamentoTenant } from './_rls.js';

// docs/01-dominio.md — Gruppo B — movimenti_asset: storico degli
// spostamenti/prestiti/riparazioni di un asset. Append-only per regola di
// dominio ("Regole di dominio da testare" #1: un asset non cambia
// ambiente senza un movimento corrispondente) — enforcement applicativo
// (il repository di task 2.7 scrive movimento e asset.ambiente_id/stato
// nella stessa transazione), non ancora una revoca UPDATE/DELETE a
// livello DB come per interventi (task 3.1): non richiesto da questo
// task, si aggiungerebbe allo stesso modo se servisse.
export const movimentoAssetTipo = pgEnum('movimento_asset_tipo', TIPI_MOVIMENTO_ASSET);

export const movimentiAsset = pgTable(
  'movimenti_asset',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    istitutoId: uuid('istituto_id')
      .notNull()
      .references(() => istituti.id),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => asset.id),
    tipo: movimentoAssetTipo('tipo').notNull(),
    daAmbienteId: uuid('da_ambiente_id').references(() => ambienti.id),
    aAmbienteId: uuid('a_ambiente_id').references(() => ambienti.id),
    affidatarioTesto: text('affidatario_testo'),
    data: date('data').notNull(),
    dataPrevistaRientro: date('data_prevista_rientro'),
    utenteId: uuid('utente_id')
      .notNull()
      .references(() => utenti.id),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabella) => [
    index('movimenti_asset_istituto_id_asset_id_idx').on(tabella.istitutoId, tabella.assetId),
    policyIsolamentoTenant(tabella.istitutoId),
  ],
).enableRLS();
