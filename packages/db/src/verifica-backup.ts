import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';

const DB_VERIFICA = 'gestilab_verifica_backup';

function quotaIdentificatore(nome: string): string {
  return `"${nome.replace(/"/g, '""')}"`;
}

export function ultimoBackup(cartella: string): string {
  const file = readdirSync(cartella)
    .filter((f) => f.endsWith('.dump'))
    .sort()
    .at(-1);

  if (!file) {
    throw new Error(`Nessun backup trovato in ${cartella}. Esegui prima "pnpm backup:crea".`);
  }

  return path.join(cartella, file);
}

function urlConDatabase(url: string, database: string): string {
  const u = new URL(url);
  u.pathname = `/${database}`;
  return u.toString();
}

function eseguiPsql(migrateUrl: string, sql: string): void {
  execFileSync('psql', [migrateUrl, '-v', 'ON_ERROR_STOP=1', '-c', sql], { stdio: 'inherit' });
}

async function conteggiPerTabella(connectionString: string): Promise<Map<string, number>> {
  const sql = postgres(connectionString, { max: 1 });
  try {
    const tabelle = await sql<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `;
    const conteggi = new Map<string, number>();
    for (const { tablename } of tabelle) {
      const righe = await sql.unsafe<{ n: number }[]>(
        `SELECT count(*)::int AS n FROM ${quotaIdentificatore(tablename)}`,
      );
      conteggi.set(tablename, righe[0]?.n ?? 0);
    }
    return conteggi;
  } finally {
    await sql.end();
  }
}

export interface RisultatoVerifica {
  successo: boolean;
  righePerTabella: { tabella: string; attese: number; trovate: number }[];
}

/**
 * Ripristina l'ultimo backup su un database temporaneo e confronta il
 * conteggio righe di ogni tabella con l'originale (docs/06-sicurezza-gdpr.md
 * § 2.10: "un backup mai ripristinato non è un backup"). Il database
 * temporaneo è sempre eliminato al termine, successo o fallimento.
 */
export async function verificaBackup(cartella: string, migrateUrl: string): Promise<RisultatoVerifica> {
  const dump = ultimoBackup(cartella);
  const urlVerifica = urlConDatabase(migrateUrl, DB_VERIFICA);

  eseguiPsql(migrateUrl, `DROP DATABASE IF EXISTS ${quotaIdentificatore(DB_VERIFICA)}`);
  eseguiPsql(migrateUrl, `CREATE DATABASE ${quotaIdentificatore(DB_VERIFICA)}`);

  try {
    execFileSync('pg_restore', ['-d', urlVerifica, dump], { stdio: 'inherit' });

    const [originali, ripristinati] = await Promise.all([
      conteggiPerTabella(migrateUrl),
      conteggiPerTabella(urlVerifica),
    ]);

    const tabelle = [...new Set([...originali.keys(), ...ripristinati.keys()])].sort();
    const righePerTabella = tabelle.map((tabella) => ({
      tabella,
      attese: originali.get(tabella) ?? 0,
      trovate: ripristinati.get(tabella) ?? 0,
    }));

    return {
      successo: righePerTabella.every((r) => r.attese === r.trovate),
      righePerTabella,
    };
  } finally {
    eseguiPsql(migrateUrl, `DROP DATABASE IF EXISTS ${quotaIdentificatore(DB_VERIFICA)}`);
  }
}

async function main(): Promise<void> {
  const migrateUrl = process.env.DATABASE_MIGRATE_URL;
  if (!migrateUrl) {
    throw new Error('DATABASE_MIGRATE_URL non impostata: serve la connessione owner.');
  }

  const cartella = process.env.BACKUP_DIR ?? '/app/backups';
  const risultato = await verificaBackup(cartella, migrateUrl);

  for (const { tabella, attese, trovate } of risultato.righePerTabella) {
    const stato = attese === trovate ? 'ok' : 'DIVERSO';
    console.log(`  ${tabella}: ${trovate}/${attese} righe (${stato})`);
  }

  if (!risultato.successo) {
    throw new Error('Ripristino non verificato: il conteggio righe differisce per almeno una tabella.');
  }

  console.log('Ripristino verificato: tutte le tabelle hanno lo stesso numero di righe.');
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch((errore: unknown) => {
    console.error(errore);
    process.exitCode = 1;
  });
}
