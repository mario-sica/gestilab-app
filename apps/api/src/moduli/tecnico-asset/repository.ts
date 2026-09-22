import { and, asc, count, eq, ilike, inArray, isNull } from 'drizzle-orm';
import { generaCodiceBreve, generaQrToken, withTenant, type Db } from '@gestilab/db';
import { affidamentiAmbienti, anniScolastici, asset } from '@gestilab/db/schema';
import { ErroreDominio, type Asset, type ListaAsset, type ListaAssetQuery, type ModificaAsset, type NuovoAsset } from '@gestilab/shared';

// Unico posto del modulo che parla con Drizzle (docs/04-convenzioni-codice.md
// § moduli). Ogni funzione apre il proprio withTenant: RLS + app.tenant_id,
// mai un filtro istituto_id scritto a mano (regola 1).

const ERRORE_ASSET_NON_TROVATO = new ErroreDominio('ASSET_NON_TROVATO', 'Asset non trovato.', 404);
const TENTATIVI_CODICI = 5;

/**
 * Perimetro dell'AT (docs/06-sicurezza-gdpr.md § 2.3): gli ambienti a lui
 * affidati nell'anno scolastico corrente, con un affidamento ancora aperto
 * (data_fine nulla — un affidamento chiuso non è mai cancellato, solo
 * valorizzato, "Regole di dominio da testare" #7). Ricalcolato a ogni
 * chiamata, mai salvato: un affidamento può cambiare tra una richiesta e
 * l'altra.
 */
async function ambientiAffidati(tx: Parameters<Parameters<Db['transaction']>[0]>[0], utenteId: string): Promise<string[]> {
  const [anno] = await tx.select({ id: anniScolastici.id }).from(anniScolastici).where(eq(anniScolastici.corrente, true));
  if (!anno) {
    return [];
  }
  const righe = await tx
    .select({ id: affidamentiAmbienti.ambienteId })
    .from(affidamentiAmbienti)
    .where(and(eq(affidamentiAmbienti.utenteId, utenteId), eq(affidamentiAmbienti.annoScolasticoId, anno.id), isNull(affidamentiAmbienti.dataFine)));
  return righe.map((riga) => riga.id);
}

function serializza(riga: typeof asset.$inferSelect): Asset {
  return {
    id: riga.id,
    ambienteId: riga.ambienteId,
    tipoAssetId: riga.tipoAssetId,
    parentAssetId: riga.parentAssetId,
    etichetta: riga.etichetta,
    marca: riga.marca,
    modello: riga.modello,
    seriale: riga.seriale,
    numeroInventario: riga.numeroInventario,
    categoriaInventariale: riga.categoriaInventariale,
    proprieta: riga.proprieta,
    fornitoreId: riga.fornitoreId,
    contrattoId: riga.contrattoId,
    dataAcquisto: riga.dataAcquisto,
    dataFineGaranzia: riga.dataFineGaranzia,
    valoreAcquisto: riga.valoreAcquisto,
    stato: riga.stato,
    codiceBreve: riga.codiceBreve,
    qrToken: riga.qrToken,
    attributi: riga.attributi,
    paginaPubblicaAttiva: riga.paginaPubblicaAttiva,
    dataDismissione: riga.dataDismissione,
    riferimentoVerbaleScarico: riga.riferimentoVerbaleScarico,
    createdAt: riga.createdAt.toISOString(),
    updatedAt: riga.updatedAt.toISOString(),
  };
}

// drizzle-orm ≥ 0.45 incapsula l'errore del driver in DrizzleQueryError, con
// l'originale (postgres-js, che porta "code"/"constraint_name") in `cause`.
function vincoloViolato(errore: unknown): string | null {
  for (const candidato of [errore, errore instanceof Error ? errore.cause : undefined]) {
    if (typeof candidato === 'object' && candidato !== null && 'code' in candidato && candidato.code === '23505' && 'constraint_name' in candidato) {
      return String(candidato.constraint_name);
    }
  }
  return null;
}

export async function elencaAsset(db: Db, tenantId: string, utenteId: string, filtri: ListaAssetQuery): Promise<ListaAsset> {
  return withTenant(db, tenantId, async (tx) => {
    const ambienti = await ambientiAffidati(tx, utenteId);
    if (ambienti.length === 0) {
      return { dati: [], totale: 0, pagina: filtri.pagina, perPagina: filtri.perPagina };
    }

    const condizioni = [inArray(asset.ambienteId, ambienti), isNull(asset.eliminatoIl)];
    if (filtri.ambienteId) {
      condizioni.push(eq(asset.ambienteId, filtri.ambienteId));
    }
    if (filtri.stato) {
      condizioni.push(eq(asset.stato, filtri.stato));
    }
    if (filtri.query) {
      condizioni.push(ilike(asset.etichetta, `%${filtri.query}%`));
    }
    const dove = and(...condizioni);

    const [riga] = await tx.select({ totale: count() }).from(asset).where(dove);
    const righe = await tx
      .select()
      .from(asset)
      .where(dove)
      .orderBy(asc(asset.etichetta))
      .limit(filtri.perPagina)
      .offset((filtri.pagina - 1) * filtri.perPagina);

    return { dati: righe.map(serializza), totale: riga?.totale ?? 0, pagina: filtri.pagina, perPagina: filtri.perPagina };
  });
}

export async function trovaAsset(db: Db, tenantId: string, utenteId: string, assetId: string): Promise<Asset> {
  return withTenant(db, tenantId, async (tx) => {
    const ambienti = await ambientiAffidati(tx, utenteId);
    if (ambienti.length === 0) {
      throw ERRORE_ASSET_NON_TROVATO;
    }
    const [riga] = await tx
      .select()
      .from(asset)
      .where(and(eq(asset.id, assetId), inArray(asset.ambienteId, ambienti), isNull(asset.eliminatoIl)));
    if (!riga) {
      throw ERRORE_ASSET_NON_TROVATO;
    }
    return serializza(riga);
  });
}

/**
 * Se parent_asset_id è indicato: deve esistere (nello stesso istituto,
 * verificato da RLS) e non avere a sua volta un parent — "asset composito
 * ... profondità massima 1" (docs/01-dominio.md). Non richiede che il
 * parent sia nel perimetro dell'AT: un padre in un altro laboratorio non
 * ha senso operativamente, ma non è questa la regola che docs/01 pone;
 * tenerlo semplice finché un task reale non chiede il vincolo in più.
 */
async function validaParent(tx: Parameters<Parameters<Db['transaction']>[0]>[0], parentAssetId: string): Promise<void> {
  const [parent] = await tx
    .select({ id: asset.id, parentAssetId: asset.parentAssetId })
    .from(asset)
    .where(and(eq(asset.id, parentAssetId), isNull(asset.eliminatoIl)));
  if (!parent) {
    throw new ErroreDominio('ASSET_NON_TROVATO', 'Asset padre non trovato.', 404);
  }
  if (parent.parentAssetId) {
    throw new ErroreDominio('RICHIESTA_NON_VALIDA', 'Un asset composito non può avere più di un livello.', 400);
  }
}

export async function creaAsset(db: Db, tenantId: string, utenteId: string, dati: NuovoAsset): Promise<Asset> {
  return withTenant(db, tenantId, async (tx) => {
    const ambienti = await ambientiAffidati(tx, utenteId);
    if (!ambienti.includes(dati.ambienteId)) {
      throw ERRORE_ASSET_NON_TROVATO;
    }
    if (dati.parentAssetId) {
      await validaParent(tx, dati.parentAssetId);
    }

    let codiceBreve = generaCodiceBreve();
    let qrToken = generaQrToken();
    for (let tentativo = 1; tentativo <= TENTATIVI_CODICI; tentativo++) {
      try {
        const [riga] = await tx
          .insert(asset)
          .values({
            istitutoId: tenantId,
            ambienteId: dati.ambienteId,
            tipoAssetId: dati.tipoAssetId,
            parentAssetId: dati.parentAssetId,
            etichetta: dati.etichetta,
            marca: dati.marca,
            modello: dati.modello,
            seriale: dati.seriale,
            numeroInventario: dati.numeroInventario,
            categoriaInventariale: dati.categoriaInventariale,
            proprieta: dati.proprieta,
            fornitoreId: dati.fornitoreId,
            contrattoId: dati.contrattoId,
            dataAcquisto: dati.dataAcquisto,
            dataFineGaranzia: dati.dataFineGaranzia,
            valoreAcquisto: dati.valoreAcquisto,
            attributi: dati.attributi,
            paginaPubblicaAttiva: dati.paginaPubblicaAttiva,
            codiceBreve,
            qrToken,
          })
          .returning();
        return serializza(riga!);
      } catch (errore) {
        const vincolo = vincoloViolato(errore);
        if (vincolo === 'asset_istituto_id_etichetta_idx') {
          throw new ErroreDominio('ETICHETTA_GIA_PRESENTE', 'Esiste già un asset con questa etichetta.', 409);
        }
        if (vincolo === 'asset_istituto_id_codice_breve_idx' || vincolo === 'asset_qr_token_unique') {
          codiceBreve = generaCodiceBreve();
          qrToken = generaQrToken();
          continue;
        }
        throw errore;
      }
    }
    throw new Error(`Impossibile generare codice_breve/qr_token univoci dopo ${TENTATIVI_CODICI} tentativi.`);
  });
}

export async function modificaAsset(db: Db, tenantId: string, utenteId: string, assetId: string, dati: ModificaAsset): Promise<Asset> {
  return withTenant(db, tenantId, async (tx) => {
    const ambienti = await ambientiAffidati(tx, utenteId);
    if (ambienti.length === 0) {
      throw ERRORE_ASSET_NON_TROVATO;
    }
    if (dati.parentAssetId) {
      await validaParent(tx, dati.parentAssetId);
    }

    try {
      const [riga] = await tx
        .update(asset)
        .set({ ...dati, updatedAt: new Date() })
        .where(and(eq(asset.id, assetId), inArray(asset.ambienteId, ambienti), isNull(asset.eliminatoIl)))
        .returning();
      if (!riga) {
        throw ERRORE_ASSET_NON_TROVATO;
      }
      return serializza(riga);
    } catch (errore) {
      if (errore instanceof ErroreDominio) {
        throw errore;
      }
      if (vincoloViolato(errore) === 'asset_istituto_id_etichetta_idx') {
        throw new ErroreDominio('ETICHETTA_GIA_PRESENTE', 'Esiste già un asset con questa etichetta.', 409);
      }
      throw errore;
    }
  });
}

export async function eliminaAsset(db: Db, tenantId: string, utenteId: string, assetId: string): Promise<void> {
  await withTenant(db, tenantId, async (tx) => {
    const ambienti = await ambientiAffidati(tx, utenteId);
    if (ambienti.length === 0) {
      throw ERRORE_ASSET_NON_TROVATO;
    }
    const [riga] = await tx
      .update(asset)
      .set({ eliminatoIl: new Date(), updatedAt: new Date() })
      .where(and(eq(asset.id, assetId), inArray(asset.ambienteId, ambienti), isNull(asset.eliminatoIl)))
      .returning({ id: asset.id });
    if (!riga) {
      throw ERRORE_ASSET_NON_TROVATO;
    }
  });
}
