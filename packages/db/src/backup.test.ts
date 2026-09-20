import { existsSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';

import { creaBackup, eliminaBackupScaduti } from './backup.js';
import { creaClient } from './client.js';
import { istituti } from './schema/istituti.js';
import { verificaBackup } from './verifica-backup.js';

// Integrazione: richiede il servizio "db" del profilo dev in esecuzione,
// con la connessione owner (pg_dump/pg_restore leggono ogni riga, la
// connessione applicativa fuori da withTenant non può: docs/02-
// architettura.md § Isolamento a livello database).
const migrateUrl = process.env.DATABASE_MIGRATE_URL;
if (!migrateUrl) {
  throw new Error('DATABASE_MIGRATE_URL non impostata: avvia "pnpm dev" prima di eseguire questo test.');
}

let cartella: string | undefined;

afterEach(() => {
  if (cartella) {
    rmSync(cartella, { recursive: true, force: true });
    cartella = undefined;
  }
});

describe('creaBackup', () => {
  it('crea un file .dump nella cartella indicata', () => {
    cartella = mkdtempSync(path.join(tmpdir(), 'gestilab-backup-'));

    const file = creaBackup(cartella, migrateUrl, 7);

    expect(file).toMatch(/^gestilab_.*\.dump$/);
    expect(existsSync(path.join(cartella, file))).toBe(true);
  });
});

describe('eliminaBackupScaduti', () => {
  it('elimina solo i file più vecchi della soglia di retention', () => {
    cartella = mkdtempSync(path.join(tmpdir(), 'gestilab-backup-'));
    const vecchio = path.join(cartella, 'gestilab_vecchio.dump');
    const recente = path.join(cartella, 'gestilab_recente.dump');
    writeFileSync(vecchio, '');
    writeFileSync(recente, '');

    const ottoGiorniFa = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    utimesSync(vecchio, ottoGiorniFa, ottoGiorniFa);

    const eliminati = eliminaBackupScaduti(cartella, 7);

    expect(eliminati).toEqual(['gestilab_vecchio.dump']);
    expect(existsSync(vecchio)).toBe(false);
    expect(existsSync(recente)).toBe(true);
  });
});

describe('verificaBackup', () => {
  it('un backup appena creato si ripristina con lo stesso conteggio righe ovunque', async () => {
    cartella = mkdtempSync(path.join(tmpdir(), 'gestilab-backup-'));
    creaBackup(cartella, migrateUrl, 7);

    const risultato = await verificaBackup(cartella, migrateUrl);

    expect(risultato.successo).toBe(true);
    expect(risultato.righePerTabella.length).toBeGreaterThan(0);
  }, 30_000);

  it('rileva davvero un conteggio diverso: un istituto aggiunto dopo il backup non è nel ripristino', async () => {
    cartella = mkdtempSync(path.join(tmpdir(), 'gestilab-backup-'));
    creaBackup(cartella, migrateUrl, 7);

    const db = creaClient(migrateUrl);
    const [inserito] = await db
      .insert(istituti)
      .values({
        slug: 'verifica-backup-temp',
        codiceMeccanografico: 'VERIFICA-BACKUP-TEMP',
        denominazione: 'Istituto temporaneo per il test di verifica backup',
        tipologia: 'liceo',
      })
      .returning({ id: istituti.id });

    try {
      const risultato = await verificaBackup(cartella, migrateUrl);

      expect(risultato.successo).toBe(false);
      const riga = risultato.righePerTabella.find((r) => r.tabella === 'istituti');
      expect(riga?.trovate).toBe((riga?.attese ?? 0) - 1);
    } finally {
      if (inserito) {
        await db.delete(istituti).where(eq(istituti.id, inserito.id));
      }
    }
  }, 30_000);
});
