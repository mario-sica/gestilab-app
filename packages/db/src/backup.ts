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

function quotaIdentificatore(nome: string): string {
  return `"${nome.replace(/"/g, '""')}"`;
}

/**
 * Conteggio righe per ogni tabella di "public" e dump, sulla stessa
 * istantanea MVCC esportata (`pg_export_snapshot`, `pg_dump --snapshot`):
 * contare in una transazione propria e lanciare `pg_dump` subito dopo (due
 * istanti distinti, anche se vicinissimi) permetteva a un'altra
 * connessione di scrivere nel mezzo, disallineando i conteggi salvati dal
 * contenuto vero del dump — scoperto dalla suite di sicurezza cross-tenant
 * (task 1.7, apps/api), che crea ed elimina istituti di prova nella stessa
 * finestra in CI. `--snapshot` fa leggere a `pg_dump` esattamente la
 * stessa istantanea di questa transazione, non una nuova presa al volo:
 * la transazione resta aperta (idle) per tutta la durata del processo
 * `pg_dump`, che è per questo dentro la stessa `sql.begin`.
 */
async function conteggiEDump(migrateUrl: string, percorsoDump: string): Promise<Record<string, number>> {
  const sql = postgres(migrateUrl, { max: 1 });
  try {
    return await sql.begin('ISOLATION LEVEL REPEATABLE READ', async (tx) => {
      const [riga] = await tx<{ snapshot: string }[]>`SELECT pg_export_snapshot() AS snapshot`;
      const snapshot = riga!.snapshot;

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

      execFileSync('pg_dump', ['-Fc', '--snapshot', snapshot, '-f', percorsoDump, migrateUrl], { stdio: 'inherit' });

      return conteggi;
    });
  } finally {
    await sql.end();
  }
}

/**
 * Crea un dump e, sulla stessa istantanea (vedi `conteggiEDump`), salva
 * quante righe aveva ogni tabella: è quello il confronto corretto per "il
 * backup corrisponde a cosa c'era quando è stato preso", non "corrisponde
 * a cosa c'è ora nel database originale".
 */
export async function creaBackup(cartella: string, migrateUrl: string, retentionGiorni: number): Promise<string> {
  mkdirSync(cartella, { recursive: true });

  const file = nomeFileBackup();
  const percorso = path.join(cartella, file);

  const conteggi = await conteggiEDump(migrateUrl, percorso);
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
