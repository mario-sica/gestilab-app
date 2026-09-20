import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { creaClient } from './client.js';
import { withTenant } from './with-tenant.js';

// Integrazione: richiede il servizio "db" del profilo dev in esecuzione
// (docs/04-convenzioni-codice.md: "Integrazione | Vitest + Postgres in
// container"). Serve anche che la migrazione 0000 sia già applicata
// (pnpm db:migrate), altrimenti i ruoli app_user/gestilab_app non esistono.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    'DATABASE_URL non impostata: avvia "pnpm dev" (serve il servizio "db") prima di eseguire questo test.',
  );
}

const db = creaClient(connectionString);

interface RigaContesto {
  utente: string;
  tenant_id: string;
}

async function leggiContesto(tx: { execute: typeof db.execute }): Promise<RigaContesto> {
  const righe = await tx.execute(
    sql`SELECT current_user AS utente, current_setting('app.tenant_id', true) AS tenant_id`,
  );
  const [riga] = righe as unknown as RigaContesto[];
  if (!riga) {
    throw new Error('Query di contesto senza risultati.');
  }
  return riga;
}

describe('withTenant', () => {
  it('dentro la transazione assume app_user e imposta app.tenant_id', async () => {
    const tenantId = '11111111-1111-1111-1111-111111111111';

    const contesto = await withTenant(db, tenantId, async (tx) => leggiContesto(tx));

    expect(contesto.utente).toBe('app_user');
    expect(contesto.tenant_id).toBe(tenantId);
  });

  it('fuori dalla transazione non resta traccia di ruolo o tenant', async () => {
    const contesto = await leggiContesto(db);

    expect(contesto.utente).not.toBe('app_user');
    expect(contesto.tenant_id).toBe('');
  });
});
