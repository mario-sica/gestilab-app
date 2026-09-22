import type { Db } from '@gestilab/db';
import type { Asset, ListaAsset, ListaAssetQuery, ModificaAsset, NuovoAsset } from '@gestilab/shared';

import { creaAsset, eliminaAsset, elencaAsset, modificaAsset, trovaAsset } from './repository.js';

export interface DipendenzeTecnicoAsset {
  db: Db;
}

// Nessuna regola di dominio oltre a quelle già nel repository (perimetro
// affidamenti, generazione codici): un pass-through, come
// admin-impostazioni/servizio.ts per le sue rotte più semplici.
export async function elencaAssetTecnico(deps: DipendenzeTecnicoAsset, tenantId: string, utenteId: string, filtri: ListaAssetQuery): Promise<ListaAsset> {
  return elencaAsset(deps.db, tenantId, utenteId, filtri);
}

export async function trovaAssetTecnico(deps: DipendenzeTecnicoAsset, tenantId: string, utenteId: string, assetId: string): Promise<Asset> {
  return trovaAsset(deps.db, tenantId, utenteId, assetId);
}

export async function creaAssetTecnico(deps: DipendenzeTecnicoAsset, tenantId: string, utenteId: string, dati: NuovoAsset): Promise<Asset> {
  return creaAsset(deps.db, tenantId, utenteId, dati);
}

export async function modificaAssetTecnico(deps: DipendenzeTecnicoAsset, tenantId: string, utenteId: string, assetId: string, dati: ModificaAsset): Promise<Asset> {
  return modificaAsset(deps.db, tenantId, utenteId, assetId, dati);
}

export async function eliminaAssetTecnico(deps: DipendenzeTecnicoAsset, tenantId: string, utenteId: string, assetId: string): Promise<void> {
  return eliminaAsset(deps.db, tenantId, utenteId, assetId);
}
