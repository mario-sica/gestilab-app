import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';

// docs/02-architettura.md § Backup in locale, docs/06-sicurezza-gdpr.md §
// 2.10: dump con pg_dump, retention 7 giorni in locale (30 in produzione).
// Connessione owner (mai quella applicativa): pg_dump deve leggere ogni
// riga di ogni tabella, e la connessione applicativa fuori da withTenant
// non ha app.tenant_id impostato — le policy RLS la filtrerebbero a vuoto,
// non è un bypass di RLS che vogliamo qui, è la connessione sbagliata per
// questo compito (stessa scelta di migrate.ts).
export function nomeFileBackup(adesso: Date = new Date()): string {
  return `gestilab_${adesso.toISOString().replace(/[:.]/g, '-')}.dump`;
}

export function percorsoConteggi(percorsoDump: string): string {
  return `${percorsoDump}.conteggi.json`;
}

export function eliminaBackupScaduti(cartella: string, retentionGiorni: number): string[] {
  const sogliaMs = retentionGiorni * 24 * 60 * 60 * 1000;
  const adesso = Date.now();
  const eliminati: string[] = [];

  for (const file of readdirSync(cartella)) {
    if (!file.endsWith('.dump')) {
      continue;
    }
    const percorso = path.join(cartella, file);
    const eta = adesso - statSync(percorso).mtimeMs;
    if (eta > sogliaMs) {
      unlinkSync(percorso);
      const conteggi = percorsoConteggi(percorso);
      if (existsSync(conteggi)) {
        unlinkSync(conteggi);
      }
      eliminati.push(file);
    }
  }

  return eliminati;
}

/**
 * Conteggio righe per ogni tabella di "public", nello stesso istante per
 * tutte (una singola transazione REPEATABLE READ: la stessa istantanea
 * MVCC per ogni SELECT, coerente anche se altre connessioni scrivono nel
 * frattempo).
 */
async function conteggiAttuali(migrateUrl: string): Promise<Record<string, number>> {
  const sql = postgres(migrateUrl, { max: 1 });
  try {
    return await sql.begin('ISOLATION LEVEL REPEATABLE READ', async (tx) => {
      const tabelle = await tx<{ tablename: string }[]>`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '\\_\\_drizzle%'
      `;
      const conteggi: Record<string, number> = {};
      for (const { tablename } of tabelle) {
        const righe = await tx.unsafe<{ n: number }[]>(
          `SELECT count(*)::int AS n FROM ${quotaIdentificatore(tablename)}`,
        );
        conteggi[tablename] = righe[0]?.n ?? 0;
      }
      return conteggi;
    });
  } finally {
    await sql.end();
  }
}

function quotaIdentificatore(nome: string): string {
  return `"${nome.replace(/"/g, '""')}"`;
}

/**
 * Crea un dump e, nello stesso momento (non quando qualcuno lo verifica
 * più tardi — nel frattempo il database può essere legittimamente
 * cambiato), salva quante righe aveva ogni tabella: è quello il confronto
 * corretto per "il backup corrisponde a cosa c'era quando è stato preso",
 * non "corrisponde a cosa c'è ora nel database originale".
 */
export async function creaBackup(cartella: string, migrateUrl: string, retentionGiorni: number): Promise<string> {
  mkdirSync(cartella, { recursive: true });

  const file = nomeFileBackup();
  const percorso = path.join(cartella, file);

  const conteggi = await conteggiAttuali(migrateUrl);
  execFileSync('pg_dump', ['-Fc', '-f', percorso, migrateUrl], { stdio: 'inherit' });
  writeFileSync(percorsoConteggi(percorso), JSON.stringify(conteggi, null, 2));

  const eliminati = eliminaBackupScaduti(cartella, retentionGiorni);
  if (eliminati.length > 0) {
    console.log(`Backup più vecchi di ${retentionGiorni} giorni eliminati: ${eliminati.join(', ')}`);
  }

  return file;
}

async function main(): Promise<void> {
  const migrateUrl = process.env.DATABASE_MIGRATE_URL;
  if (!migrateUrl) {
    throw new Error('DATABASE_MIGRATE_URL non impostata: serve la connessione owner per pg_dump.');
  }

  const cartella = process.env.BACKUP_DIR ?? '/app/backups';
  const retentionGiorni = Number(process.env.BACKUP_RETENTION_GIORNI ?? '7');

  const file = await creaBackup(cartella, migrateUrl, retentionGiorni);
  console.log(`Backup creato: ${file}`);
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch((errore: unknown) => {
    console.error(errore);
    process.exitCode = 1;
  });
}
