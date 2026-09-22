import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '@gestilab/shared';

import { creaClient } from './client.js';
import { withTenant } from './with-tenant.js';
import { creaTenant } from './tenant-create.js';
import { anniScolastici, istituti, utenti } from './schema/index.js';

// Integrazione, come with-tenant.test.ts: richiede il servizio "db" del
// profilo dev in esecuzione. gestilab-auth-service non serve: la chiamata a
// POST /inviti è mockata su `fetch`, coerente con come apps/web mocka la
// stessa chiamata (app/docente/login/azioni.test.ts).
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL non impostata: avvia "pnpm dev" (serve il servizio "db") prima di eseguire questo test.');
}

const db = creaClient(connectionString);
const ENV: Pick<Env, 'BASE_DOMAIN' | 'WEB_PROTOCOLLO' | 'WEB_PORTA'> = { BASE_DOMAIN: 'localhost', WEB_PROTOCOLLO: 'http', WEB_PORTA: 3000 };

const DATI_BASE = {
  slug: 'tenant-create-test',
  denominazione: 'Istituto di prova',
  codiceMeccanografico: 'TEST00100X',
  tipologia: 'liceo',
  adminEmail: 'admin@tenant-create-test.localhost',
  adminNome: 'Admin',
  adminCognome: 'Prova',
};

async function pulisci(slug: string): Promise<void> {
  const [istituto] = await db.select({ id: istituti.id }).from(istituti).where(eq(istituti.slug, slug));
  if (!istituto) {
    return;
  }
  await withTenant(db, istituto.id, async (tx) => {
    await tx.delete(utenti).where(eq(utenti.istitutoId, istituto.id));
    await tx.delete(anniScolastici).where(eq(anniScolastici.istitutoId, istituto.id));
  });
  await db.delete(istituti).where(eq(istituti.id, istituto.id));
}

afterEach(async () => {
  vi.restoreAllMocks();
  await pulisci(DATI_BASE.slug);
});

describe('creaTenant', () => {
  it('crea istituto, anno scolastico corrente e admin con invito', async () => {
    const scadeIl = new Date(Date.now() + 72 * 60 * 60 * 1000);
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ token: 'il-token', scadeIl: scadeIl.toISOString() }), { status: 200 }));

    const risultato = await creaTenant(db, 'http://auth:3002', ENV, DATI_BASE);

    expect(risultato.linkInvito).toBe(`http://tenant-create-test.localhost:3000/invito/il-token`);
    expect(risultato.scadeIl).toEqual(scadeIl);

    const [istituto] = await db.select().from(istituti).where(eq(istituti.id, risultato.istitutoId));
    expect(istituto?.denominazione).toBe(DATI_BASE.denominazione);
    expect(istituto?.codiceMeccanografico).toBe(DATI_BASE.codiceMeccanografico);

    await withTenant(db, risultato.istitutoId, async (tx) => {
      const [anno] = await tx.select().from(anniScolastici).where(eq(anniScolastici.istitutoId, risultato.istitutoId));
      expect(anno?.corrente).toBe(true);

      const [admin] = await tx.select().from(utenti).where(eq(utenti.id, risultato.adminUtenteId));
      expect(admin?.ruolo).toBe('admin');
      expect(admin?.email).toBe(DATI_BASE.adminEmail);
      expect(admin?.passwordHash).toBeNull();
    });
  });

  it('rifiuta uno slug già esistente, senza chiamare gestilab-auth-service', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    await creaTenant(db, 'http://auth:3002', ENV, {
      ...DATI_BASE,
      adminEmail: 'primo@tenant-create-test.localhost',
    }).catch(() => {
      // Il primo tentativo può fallire per altri motivi nel test seguente;
      // qui serve solo che l'istituto esista già per il secondo tentativo.
    });
    fetchSpy.mockClear();

    await expect(creaTenant(db, 'http://auth:3002', ENV, DATI_BASE)).rejects.toThrow(/esiste già/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rifiuta uno slug non valido, senza scrivere nulla', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');

    await expect(creaTenant(db, 'http://auth:3002', ENV, { ...DATI_BASE, slug: 'AB' })).rejects.toThrow(/slug/i);

    expect(fetchSpy).not.toHaveBeenCalled();
    const [istituto] = await db.select({ id: istituti.id }).from(istituti).where(eq(istituti.slug, 'AB'));
    expect(istituto).toBeUndefined();
  });

  it('rifiuta uno slug riservato', async () => {
    await expect(creaTenant(db, 'http://auth:3002', ENV, { ...DATI_BASE, slug: 'admin' })).rejects.toThrow(/slug/i);
  });

  it('rifiuta una tipologia non valida', async () => {
    await expect(creaTenant(db, 'http://auth:3002', ENV, { ...DATI_BASE, tipologia: 'universita' })).rejects.toThrow(/tipologia/i);
  });

  it('se gestilab-auth-service non è raggiungibile, istituto e admin restano comunque creati', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new TypeError('fetch failed'));

    await expect(creaTenant(db, 'http://auth:3002', ENV, DATI_BASE)).rejects.toThrow(/non è raggiungibile/i);

    const [istituto] = await db.select({ id: istituti.id }).from(istituti).where(eq(istituti.slug, DATI_BASE.slug));
    expect(istituto).toBeDefined();
  });
});
