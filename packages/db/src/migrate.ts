import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/**
 * Applica le migrazioni con la connessione owner (mai quella applicativa,
 * docs/02-architettura.md § Isolamento a livello database) e allinea la
 * password del ruolo di connessione (gestilab_app) a quella in DATABASE_URL.
 * Pensato per girare in un container one-shot: `pnpm db:migrate` dalla
 * radice, che esegue questo script nel container "api".
 */
async function main(): Promise<void> {
  const migrateUrl = process.env.DATABASE_MIGRATE_URL;
  if (!migrateUrl) {
    throw new Error('DATABASE_MIGRATE_URL non impostata: serve la connessione owner per le migrazioni.');
  }
  const appUrl = process.env.DATABASE_URL;
  if (!appUrl) {
    throw new Error('DATABASE_URL non impostata: serve per ricavare utente e password di gestilab_app.');
  }

  const owner = postgres(migrateUrl, { max: 1 });
  const db = drizzle(owner);

  try {
    await migrate(db, { migrationsFolder: new URL('../migrations', import.meta.url).pathname });

    const urlApp = new URL(appUrl);
    const username = decodeURIComponent(urlApp.username);
    const password = decodeURIComponent(urlApp.password);
    if (username && password) {
      // ALTER ROLE ... PASSWORD non accetta parametri bind (Postgres lo
      // rifiuta a livello di grammatica): va costruita come istruzione con
      // valori letterali, correttamente quotati. Sicuro perché username e
      // password arrivano da .env, non da input esterno.
      await owner.unsafe(`ALTER ROLE ${quotaIdentificatore(username)} WITH PASSWORD ${quotaLetterale(password)}`);
    }
  } finally {
    await owner.end();
  }

  console.log('Migrazioni applicate.');
}

function quotaIdentificatore(nome: string): string {
  return `"${nome.replace(/"/g, '""')}"`;
}

function quotaLetterale(valore: string): string {
  return `'${valore.replace(/'/g, "''")}'`;
}

main().catch((errore: unknown) => {
  console.error(errore);
  process.exitCode = 1;
});
