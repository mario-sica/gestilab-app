import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';

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
      eliminati.push(file);
    }
  }

  return eliminati;
}

export function creaBackup(cartella: string, migrateUrl: string, retentionGiorni: number): string {
  mkdirSync(cartella, { recursive: true });

  const file = nomeFileBackup();
  const percorso = path.join(cartella, file);

  execFileSync('pg_dump', ['-Fc', '-f', percorso, migrateUrl], { stdio: 'inherit' });

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

  const file = creaBackup(cartella, migrateUrl, retentionGiorni);
  console.log(`Backup creato: ${file}`);
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch((errore: unknown) => {
    console.error(errore);
    process.exitCode = 1;
  });
}
