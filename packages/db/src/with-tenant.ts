import { sql } from 'drizzle-orm';

import type { Db } from './client.js';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/**
 * Unico punto d'ingresso per le query di dominio (docs/02-architettura.md
 * § Isolamento a livello database): apre una transazione, assume il ruolo
 * app_user e imposta app.tenant_id, così le policy RLS filtrano da sole.
 * SET LOCAL vale solo per la transazione: fuori da qui non resta nulla.
 */
export async function withTenant<T>(
  db: Db,
  tenantId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE app_user`);
    await tx.execute(sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`);
    return fn(tx);
  });
}
