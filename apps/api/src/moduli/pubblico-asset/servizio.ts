import type { Db } from '@gestilab/db';
import { ErroreDominio, type AssetPubblico } from '@gestilab/shared';

import { trovaAssetPubblicoDaCodiceBreve, trovaAssetPubblicoDaQrToken } from './repository.js';

export interface DipendenzePubblicoAsset {
  db: Db;
}

const ERRORE_NON_TROVATO = new ErroreDominio('ASSET_NON_TROVATO', 'Nessun bene trovato con questo codice.', 404);

export async function risolviDaQrToken(deps: DipendenzePubblicoAsset, tenantId: string, token: string): Promise<AssetPubblico> {
  const trovato = await trovaAssetPubblicoDaQrToken(deps.db, tenantId, token);
  if (!trovato) {
    throw ERRORE_NON_TROVATO;
  }
  return trovato;
}

export async function risolviDaCodiceBreve(deps: DipendenzePubblicoAsset, tenantId: string, codice: string): Promise<AssetPubblico> {
  // L'alfabeto di generazione (packages/db/src/codici-asset.ts) è tutto
  // maiuscolo: normalizza chi digita in minuscolo da mobile.
  const trovato = await trovaAssetPubblicoDaCodiceBreve(deps.db, tenantId, codice.toUpperCase());
  if (!trovato) {
    throw ERRORE_NON_TROVATO;
  }
  return trovato;
}
