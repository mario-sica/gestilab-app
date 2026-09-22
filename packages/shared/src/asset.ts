// docs/01-dominio.md — Gruppo B: beni. Fonte unica per i valori enumerati
// di tipi_asset/asset/movimenti_asset/contratti — packages/db ne deriva
// gli enum Postgres, stessa scelta già fatta per RUOLI_UTENTE e
// QUALIFICHE_PERSONA: una lista sola, non due da tenere allineate.

export const CATEGORIE_ASSET = ['informatica', 'audiovideo', 'stampa', 'rete', 'scientifico', 'officina', 'arredo', 'altro'] as const;
export type CategoriaAsset = (typeof CATEGORIE_ASSET)[number];

export const CATEGORIE_INVENTARIALI_ASSET = ['I', 'III', 'non_inventariato'] as const;
export type CategoriaInventarialeAsset = (typeof CATEGORIE_INVENTARIALI_ASSET)[number];

export const PROPRIETA_ASSET = ['istituto', 'ente_locale', 'comodato', 'noleggio', 'altro'] as const;
export type ProprietaAsset = (typeof PROPRIETA_ASSET)[number];

export const STATI_ASSET = ['attivo', 'guasto', 'in_riparazione', 'in_prestito', 'in_magazzino', 'dismesso'] as const;
export type StatoAsset = (typeof STATI_ASSET)[number];

export const TIPI_MOVIMENTO_ASSET = [
  'trasferimento',
  'prestito',
  'rientro',
  'riparazione_esterna',
  'rientro_riparazione',
  'dismissione',
] as const;
export type TipoMovimentoAsset = (typeof TIPI_MOVIMENTO_ASSET)[number];

export const TIPI_CONTRATTO = ['assistenza', 'noleggio', 'garanzia_estesa'] as const;
export type TipoContratto = (typeof TIPI_CONTRATTO)[number];
