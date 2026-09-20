import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';

import { creaClient } from './client.js';
import { withTenant } from './with-tenant.js';
import { istituti, persone } from './schema/index.js';

// Integrazione: richiede il servizio "db" del profilo dev con la migrazione
// 0002 (RLS) applicata e il seed dei due tenant demo già eseguiti
// (pnpm db:migrate && pnpm db:seed). docs/02-architettura.md § Isolamento a
// livello database — "Test obbligatorio": query cross-tenant -> nessuna riga.

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL non impostata: avvia "pnpm dev" prima di eseguire questo test.');
}

const db = creaClient(connectionString);

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
    const righe = await db.select().from(persone);
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
