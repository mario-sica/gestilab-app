import { boolean, date, index, jsonb, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { CATEGORIE_INVENTARIALI_ASSET, PROPRIETA_ASSET, STATI_ASSET } from '@gestilab/shared';

import { ambienti } from './ambienti.js';
import { contratti } from './contratti.js';
import { fornitori } from './fornitori.js';
import { istituti } from './istituti.js';
import { tipiAsset } from './tipi-asset.js';
import { policyIsolamentoTenant } from './_rls.js';

// docs/01-dominio.md — Gruppo B — asset: il bene fisico censito. Una delle
// sole due tabelle con soft delete (eliminato_il), l'altra è persone.
// codice_breve e qr_token sono qui come colonne NOT NULL perché il modello
// li richiede sempre, ma il loro ALGORITMO di generazione (senza caratteri
// ambigui, rotazione con 410, ecc.) è task 2.3, non questo: qui li scrive
// solo il seed, con una generazione minima.

export const assetCategoriaInventariale = pgEnum('asset_categoria_inventariale', CATEGORIE_INVENTARIALI_ASSET);
export const assetProprieta = pgEnum('asset_proprieta', PROPRIETA_ASSET);
export const assetStato = pgEnum('asset_stato', STATI_ASSET);

export const asset = pgTable(
  'asset',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    istitutoId: uuid('istituto_id')
      .notNull()
      .references(() => istituti.id),
    ambienteId: uuid('ambiente_id')
      .notNull()
      .references(() => ambienti.id),
    tipoAssetId: uuid('tipo_asset_id')
      .notNull()
      .references(() => tipiAsset.id),
    // Asset composito (postazione → PC + monitor); profondità massima 1
    // (docs/01): una regola applicativa, non imponibile con un semplice
    // check di schema — va rispettata dal servizio quando esisterà (Fase 2).
    parentAssetId: uuid('parent_asset_id').references((): AnyPgColumn => asset.id),
    etichetta: text('etichetta').notNull(),
    marca: text('marca'),
    modello: text('modello'),
    seriale: text('seriale'),
    numeroInventario: text('numero_inventario'),
    categoriaInventariale: assetCategoriaInventariale('categoria_inventariale'),
    proprieta: assetProprieta('proprieta').notNull(),
    fornitoreId: uuid('fornitore_id').references(() => fornitori.id),
    contrattoId: uuid('contratto_id').references(() => contratti.id),
    dataAcquisto: date('data_acquisto'),
    dataFineGaranzia: date('data_fine_garanzia'),
    valoreAcquisto: numeric('valore_acquisto', { precision: 12, scale: 2 }),
    stato: assetStato('stato').notNull().default('attivo'),
    codiceBreve: text('codice_breve').notNull(),
    qrToken: text('qr_token').notNull().unique(),
    attributi: jsonb('attributi'),
    paginaPubblicaAttiva: boolean('pagina_pubblica_attiva').notNull().default(true),
    dataDismissione: date('data_dismissione'),
    riferimentoVerbaleScarico: text('riferimento_verbale_scarico'),
    eliminatoIl: timestamp('eliminato_il', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabella) => [
    uniqueIndex('asset_istituto_id_etichetta_idx').on(tabella.istitutoId, tabella.etichetta),
    uniqueIndex('asset_istituto_id_codice_breve_idx').on(tabella.istitutoId, tabella.codiceBreve),
    index('asset_istituto_id_ambiente_id_idx').on(tabella.istitutoId, tabella.ambienteId),
    policyIsolamentoTenant(tabella.istitutoId),
  ],
).enableRLS();
