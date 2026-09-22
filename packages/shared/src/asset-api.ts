import { z } from 'zod';

import { CATEGORIE_INVENTARIALI_ASSET, PROPRIETA_ASSET, STATI_ASSET } from './asset.js';

// GET/POST/PATCH /api/v1/tecnico/asset[/:id] (task 2.2). Contratto
// condiviso tra apps/api e apps/web, come ogni altro schema Zod
// (docs/CLAUDE.md regola 8).

// Campi comuni a creazione e modifica. ambiente_id non c'è: si cambia solo
// via movimento (docs/01-dominio.md, regola di dominio #1 — task 2.7), mai
// da questa PATCH. codice_breve/qr_token non ci sono: li genera il
// server (packages/db/src/codici-asset.ts), mai il client.
const campiComuniAsset = {
  tipoAssetId: z.string().uuid('Scegli un tipo di bene.'),
  etichetta: z.string().trim().min(1, 'Inserisci un’etichetta.').max(100, 'Massimo 100 caratteri.'),
  marca: z.string().trim().max(100).optional(),
  modello: z.string().trim().max(100).optional(),
  seriale: z.string().trim().max(100).optional(),
  numeroInventario: z.string().trim().max(100).optional(),
  categoriaInventariale: z.enum(CATEGORIE_INVENTARIALI_ASSET).optional(),
  proprieta: z.enum(PROPRIETA_ASSET, 'Scegli il tipo di proprietà.'),
  fornitoreId: z.string().uuid().optional(),
  contrattoId: z.string().uuid().optional(),
  dataAcquisto: z.string().date().optional(),
  dataFineGaranzia: z.string().date().optional(),
  valoreAcquisto: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Inserisci un importo valido.').optional(),
  attributi: z.record(z.string(), z.unknown()).optional(),
  paginaPubblicaAttiva: z.boolean().optional(),
  parentAssetId: z.string().uuid().optional(),
};

export const schemaNuovoAsset = z.object({
  ambienteId: z.string().uuid('Scegli un ambiente.'),
  ...campiComuniAsset,
});
export type NuovoAsset = z.infer<typeof schemaNuovoAsset>;

// Tutto opzionale (PATCH parziale) tranne quanto già escluso sopra; almeno
// un campo deve essere presente, altrimenti non c'è nulla da modificare.
// .strict(): un "ambienteId" nel corpo non viene silenziosamente ignorato
// (comportamento di default di Zod) ma rifiutato con 400 — cambiare
// ambiente passa solo da un movimento (task 2.7), mai da questa PATCH.
export const schemaModificaAsset = z
  .object({ ...campiComuniAsset, stato: z.enum(STATI_ASSET) })
  .partial()
  .strict()
  .refine((dati) => Object.keys(dati).length > 0, { message: 'Nessun campo da modificare.' });
export type ModificaAsset = z.infer<typeof schemaModificaAsset>;

export const schemaAsset = z.object({
  id: z.string().uuid(),
  ambienteId: z.string().uuid(),
  tipoAssetId: z.string().uuid(),
  parentAssetId: z.string().uuid().nullable(),
  etichetta: z.string(),
  marca: z.string().nullable(),
  modello: z.string().nullable(),
  seriale: z.string().nullable(),
  numeroInventario: z.string().nullable(),
  categoriaInventariale: z.enum(CATEGORIE_INVENTARIALI_ASSET).nullable(),
  proprieta: z.enum(PROPRIETA_ASSET),
  fornitoreId: z.string().uuid().nullable(),
  contrattoId: z.string().uuid().nullable(),
  dataAcquisto: z.string().nullable(),
  dataFineGaranzia: z.string().nullable(),
  valoreAcquisto: z.string().nullable(),
  stato: z.enum(STATI_ASSET),
  codiceBreve: z.string(),
  qrToken: z.string(),
  attributi: z.unknown().nullable(),
  paginaPubblicaAttiva: z.boolean(),
  dataDismissione: z.string().nullable(),
  riferimentoVerbaleScarico: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Asset = z.infer<typeof schemaAsset>;

// GET /api/v1/tecnico/asset — prima lista dell'API a definire la
// paginazione (docs/03-api.md § Paginazione, rimandata qui apposta): stile
// pagina/perPagina, non cursore — dataset di centinaia/poche migliaia di
// righe per istituto, non serve altro. Ordinata per etichetta (unique per
// istituto, stabile).
export const schemaListaAssetQuery = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  perPagina: z.coerce.number().int().min(1).max(100).default(50),
  ambienteId: z.string().uuid().optional(),
  stato: z.enum(STATI_ASSET).optional(),
  query: z.string().trim().min(1).max(100).optional(),
});
export type ListaAssetQuery = z.infer<typeof schemaListaAssetQuery>;

export const schemaListaAsset = z.object({
  dati: z.array(schemaAsset),
  totale: z.number().int(),
  pagina: z.number().int(),
  perPagina: z.number().int(),
});
export type ListaAsset = z.infer<typeof schemaListaAsset>;
