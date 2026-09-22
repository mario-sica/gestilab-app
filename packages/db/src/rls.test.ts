import { eq, isNull } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';

import { creaClient } from './client.js';
import { withTenant } from './with-tenant.js';
import { asset, istituti, persone, tipiAsset } from './schema/index.js';

// Integrazione: richiede il servizio "db" del profilo dev con la migrazione
// 0002 (RLS) applicata e il seed dei due tenant demo già eseguiti
// (pnpm db:migrate && pnpm db:seed). docs/02-architettura.md § Isolamento a
// livello database — "Test obbligatorio": query cross-tenant -> nessuna riga.

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL non impostata: avvia "pnpm dev" prima di eseguire questo test.');
}

const db = creaClient(connectionString);

// "app.tenant_id" è un GUC di sessione: su una connessione mai toccata da
// withTenant vale NULL (nessun errore nel cast a uuid), ma dopo un solo
// SET LOCAL + commit resta '' per il resto di quella connessione (non
// torna a NULL) — e '' non è castabile a uuid, quindi la STESSA query
// senza contesto va in errore invece di restituire zero righe, a seconda
// di quale connessione del pool riceve. Ogni test "senza contesto" apre
// perciò una connessione propria, mai usata prima, per essere
// deterministico indipendentemente dall'ordine di esecuzione degli altri.
async function selezionaSenzaContesto<T>(fn: (client: ReturnType<typeof creaClient>) => Promise<T>): Promise<T> {
  const client = creaClient(connectionString!);
  try {
    return await fn(client);
  } finally {
    await client.$client.end();
  }
}

let dellaquilaId: string;
let demoId: string;

beforeAll(async () => {
  const righe = await db
    .select({ id: istituti.id, slug: istituti.slug })
    .from(istituti)
    .where(eq(istituti.slug, 'dellaquila'));
  const dellaquila = righe[0];
  const [demo] = await db.select({ id: istituti.id }).from(istituti).where(eq(istituti.slug, 'demo'));
  if (!dellaquila || !demo) {
    throw new Error('Tenant demo mancanti: esegui "pnpm db:seed" prima di questo test.');
  }
  dellaquilaId = dellaquila.id;
  demoId = demo.id;
});

describe('RLS — isolamento tenant su persone', () => {
  it('senza contesto tenant (fuori da withTenant) non vede nessuna riga', async () => {
    const righe = await selezionaSenzaContesto((client) => client.select().from(persone));
    expect(righe).toHaveLength(0);
  });

  it('con contesto tenant vede solo le righe del proprio istituto', async () => {
    const righeDellaquila = await withTenant(db, dellaquilaId, (tx) => tx.select().from(persone));
    const righeDemo = await withTenant(db, demoId, (tx) => tx.select().from(persone));

    expect(righeDellaquila.length).toBeGreaterThan(0);
    expect(righeDemo.length).toBeGreaterThan(0);
    expect(righeDellaquila.every((riga) => riga.istitutoId === dellaquilaId)).toBe(true);
    expect(righeDemo.every((riga) => riga.istitutoId === demoId)).toBe(true);
  });

  it('nessuna query vede righe di un altro istituto, nemmeno con id indovinato', async () => {
    const [personaDemo] = await withTenant(db, demoId, (tx) => tx.select().from(persone).limit(1));
    if (!personaDemo) {
      throw new Error('Nessuna persona seminata per "demo".');
    }

    const risultato = await withTenant(db, dellaquilaId, (tx) =>
      tx.select().from(persone).where(eq(persone.id, personaDemo.id)),
    );

    expect(risultato).toHaveLength(0);
  });
});

// docs/01-dominio.md — Gruppo B, task 2.1: stessa garanzia RLS di persone,
// verificata di nuovo qui perché asset è la prima tabella "di censimento"
// con cui l'AT lavorerà (Fase 2) — un buco qui è più costoso da scoprire
// tardi che uno su persone.
describe('RLS — isolamento tenant su asset', () => {
  it('senza contesto tenant non vede nessuna riga', async () => {
    const righe = await selezionaSenzaContesto((client) => client.select().from(asset));
    expect(righe).toHaveLength(0);
  });

  it('con contesto tenant vede solo gli asset del proprio istituto (almeno i 30 del seed)', async () => {
    // >= e non === 30: da task 2.2 esiste un vero endpoint di creazione, e
    // questo database dev è persistente — una verifica manuale o una suite
    // e2e può aggiungere righe legittime tra un run e l'altro (già successo
    // una volta). Quello che conta qui è l'isolamento RLS, non il conteggio
    // esatto del seed.
    const righeDellaquila = await withTenant(db, dellaquilaId, (tx) => tx.select().from(asset));
    const righeDemo = await withTenant(db, demoId, (tx) => tx.select().from(asset));

    expect(righeDellaquila.length).toBeGreaterThanOrEqual(30);
    expect(righeDemo.length).toBeGreaterThanOrEqual(30);
    expect(righeDellaquila.every((riga) => riga.istitutoId === dellaquilaId)).toBe(true);
    expect(righeDemo.every((riga) => riga.istitutoId === demoId)).toBe(true);
  });

  it('nessuna query vede un asset di un altro istituto, nemmeno con id indovinato', async () => {
    const [assetDemo] = await withTenant(db, demoId, (tx) => tx.select().from(asset).limit(1));
    if (!assetDemo) {
      throw new Error('Nessun asset seminato per "demo".');
    }

    const risultato = await withTenant(db, dellaquilaId, (tx) => tx.select().from(asset).where(eq(asset.id, assetDemo.id)));

    expect(risultato).toHaveLength(0);
  });
});

// tipi_asset è la tabella con la regola di RLS diversa (task 2.1): le righe
// globali (istituto_id NULL, il catalogo di sistema) devono restare
// visibili da ogni contesto — e persino senza contesto tenant, a
// differenza di ogni altra tabella di questo file.
describe('RLS — tipi_asset: catalogo globale visibile da ogni istituto', () => {
  it('il catalogo globale è visibile anche senza contesto tenant', async () => {
    const righe = await selezionaSenzaContesto((client) => client.select().from(tipiAsset).where(isNull(tipiAsset.istitutoId)));
    expect(righe.length).toBeGreaterThan(0);
  });

  it('il catalogo globale è visibile allo stesso modo da istituti diversi', async () => {
    const catalogoDellaquila = await withTenant(db, dellaquilaId, (tx) => tx.select({ id: tipiAsset.id }).from(tipiAsset).where(isNull(tipiAsset.istitutoId)));
    const catalogoDemo = await withTenant(db, demoId, (tx) => tx.select({ id: tipiAsset.id }).from(tipiAsset).where(isNull(tipiAsset.istitutoId)));

    expect(catalogoDellaquila.length).toBeGreaterThan(0);
    expect(new Set(catalogoDellaquila.map((r) => r.id))).toEqual(new Set(catalogoDemo.map((r) => r.id)));
  });
});
