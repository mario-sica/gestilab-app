import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema/index.js';

export type Db = ReturnType<typeof creaClient>;

// Nessuna lettura di process.env qui dentro: la stringa di connessione la
// passa chi chiama (apps/api, migrate.ts, i test), dopo averla validata con
// packages/shared/env.ts. Tiene questo pacchetto testabile senza un
// ambiente globale implicito.
export function creaClient(connectionString: string) {
  const sql = postgres(connectionString);
  return drizzle(sql, { schema });
}
