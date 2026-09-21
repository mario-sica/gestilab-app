import { creaClient, type Db } from '@gestilab/db';
import { leggiEnv } from '@gestilab/shared';

// Un solo pool Postgres per il processo web (connessione applicativa
// gestilab_app, mai owner): condiviso da risoluzione tenant (middleware)
// e lettura sessione (layout). Creato al primo uso, non all'import, così i
// test che mockano non aprono connessioni.
let db: Db | null = null;
export function ottieniDb(): Db {
  db ??= creaClient(leggiEnv().DATABASE_URL);
  return db;
}
