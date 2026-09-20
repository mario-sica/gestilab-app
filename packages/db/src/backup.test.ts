import { existsSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { creaBackup, eliminaBackupScaduti, percorsoConteggi } from './backup.js';
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
  it('crea un file .dump nella cartella indicata', async () => {
    cartella = mkdtempSync(path.join(tmpdir(), 'gestilab-backup-'));

    const file = await creaBackup(cartella, migrateUrl, 7);

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
    await creaBackup(cartella, migrateUrl, 7);

    const risultato = await verificaBackup(cartella, migrateUrl);

    expect(risultato.successo).toBe(true);
    expect(risultato.righePerTabella.length).toBeGreaterThan(0);
  }, 30_000);

  it('rileva davvero un conteggio diverso: un conteggio salvato manomesso non corrisponde al ripristino', async () => {
    cartella = mkdtempSync(path.join(tmpdir(), 'gestilab-backup-'));
    const file = await creaBackup(cartella, migrateUrl, 7);

    // Manomette il conteggio salvato al momento del dump (non il database
    // live: dopo il fix, verificaBackup non lo interroga più — confronta il
    // ripristino solo con quanto registrato allora, vedi verifica-backup.ts).
    const percorso = percorsoConteggi(path.join(cartella, file));
    const conteggi = JSON.parse(readFileSync(percorso, 'utf8')) as Record<string, number>;
    conteggi.istituti = (conteggi.istituti ?? 0) + 1;
    writeFileSync(percorso, JSON.stringify(conteggi, null, 2));

    const risultato = await verificaBackup(cartella, migrateUrl);

    expect(risultato.successo).toBe(false);
    const riga = risultato.righePerTabella.find((r) => r.tabella === 'istituti');
    expect(riga?.trovate).toBe((riga?.attese ?? 0) - 1);
  }, 30_000);
});
