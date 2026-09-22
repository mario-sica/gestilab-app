import { eq, type SQL } from 'drizzle-orm';
import { withTenant, type Db } from '@gestilab/db';
import { ambienti, asset, tipiAsset } from '@gestilab/db/schema';
import type { AssetPubblico } from '@gestilab/shared';

// Unico posto del modulo che parla con Drizzle. qr_token è unico globale
// (docs/01-dominio.md), ma la query gira comunque dentro withTenant(tenantId):
// se il token appartenesse a un altro istituto la riga sarebbe già invisibile
// per RLS, prima ancora di guardare pagina_pubblica_attiva — nessun filtro
// istituto_id scritto a mano (regola 1).
async function trovaPerCondizione(db: Db, tenantId: string, condizione: SQL): Promise<AssetPubblico | null> {
  return withTenant(db, tenantId, async (tx) => {
    const [riga] = await tx
      .select({
        etichetta: asset.etichetta,
        marca: asset.marca,
        modello: asset.modello,
        stato: asset.stato,
        paginaPubblicaAttiva: asset.paginaPubblicaAttiva,
        eliminatoIl: asset.eliminatoIl,
        tipoAsset: tipiAsset.nome,
        categoria: tipiAsset.categoria,
        ambiente: ambienti.nome,
      })
      .from(asset)
      .innerJoin(tipiAsset, eq(tipiAsset.id, asset.tipoAssetId))
      .innerJoin(ambienti, eq(ambienti.id, asset.ambienteId))
      .where(condizione);

    // Stesso esito (null, quindi 404 ASSET_NON_TROVATO più avanti) per
    // "non esiste", "eliminato" e "pagina pubblica disattivata": la
    // pagina pubblica non deve distinguere questi casi, docs/06-sicurezza-
    // gdpr.md § 2.3 — "fuori perimetro non rivela l'esistenza", stessa
    // idea applicata qui alla visibilità pubblica di un asset.
    if (!riga || riga.eliminatoIl || !riga.paginaPubblicaAttiva) {
      return null;
    }

    return {
      etichetta: riga.etichetta,
      tipoAsset: riga.tipoAsset,
      categoria: riga.categoria,
      marca: riga.marca,
      modello: riga.modello,
      ambiente: riga.ambiente,
      stato: riga.stato,
    };
  });
}

export async function trovaAssetPubblicoDaQrToken(db: Db, tenantId: string, token: string): Promise<AssetPubblico | null> {
  return trovaPerCondizione(db, tenantId, eq(asset.qrToken, token));
}

export async function trovaAssetPubblicoDaCodiceBreve(db: Db, tenantId: string, codice: string): Promise<AssetPubblico | null> {
  return trovaPerCondizione(db, tenantId, eq(asset.codiceBreve, codice));
}
