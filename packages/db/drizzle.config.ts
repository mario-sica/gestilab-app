import { defineConfig } from 'drizzle-kit';

// Le migrazioni si applicano con la connessione owner (mai quella
// applicativa): vedi src/migrate.ts e docs/02-architettura.md
// § Isolamento a livello database.
export default defineConfig({
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_MIGRATE_URL ?? '',
  },
});
