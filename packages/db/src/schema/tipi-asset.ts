import { boolean, jsonb, pgEnum, pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { CATEGORIE_ASSET } from '@gestilab/shared';

import { istituti } from './istituti.js';

// docs/01-dominio.md — Gruppo B — tipi_asset: catalogo dei tipi di bene
// (PC, proiettore, ...). istituto_id nullable: null è il catalogo globale
// di sistema (precaricato una volta, uguale per ogni istituto), non null
// un tipo personalizzato di quel tenant. Per questo NON usa
// policyIsolamentoTenant (che nasconderebbe a tutti le righe globali): la
// policy qui ammette anche istituto_id IS NULL, oltre al proprio tenant.
//
// guida_rapida_default_id (docs/01) non ha ancora una references(): la
// tabella guide_rapide arriva con la Fase 4, non con questo task — colonna
// già presente per non aggiungere una migrazione dedicata più avanti, FK
// da collegare quando quella tabella esisterà.
export const tipoAssetCategoria = pgEnum('tipo_asset_categoria', CATEGORIE_ASSET);

export const tipiAsset = pgTable(
  'tipi_asset',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    istitutoId: uuid('istituto_id').references(() => istituti.id),
    nome: text('nome').notNull(),
    categoria: tipoAssetCategoria('categoria').notNull(),
    schemaAttributi: jsonb('schema_attributi'),
    guidaRapidaDefaultId: uuid('guida_rapida_default_id'),
    etichettabile: boolean('etichettabile').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabella) => [
    pgPolicy('tenant_isolation_o_catalogo_globale', {
      using: sql`${tabella.istitutoId} IS NULL OR ${tabella.istitutoId} = current_setting('app.tenant_id', true)::uuid`,
    }),
  ],
).enableRLS();
