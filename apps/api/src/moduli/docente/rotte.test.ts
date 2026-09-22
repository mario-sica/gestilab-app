import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { eq } from 'drizzle-orm';
import { creaClient, withTenant, type Db } from '@gestilab/db';
import { anniScolastici, istituti, persone } from '@gestilab/db/schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { pluginErrori } from '../../plugin/errori.js';
import { pluginTenant } from '../../plugin/tenant.js';
import { rotteDocente } from './rotte.js';

const migrateUrl = process.env.DATABASE_MIGRATE_URL;
if (!migrateUrl) {
  throw new Error('DATABASE_MIGRATE_URL non impostata: avvia "pnpm dev" prima di questo test.');
}

const db: Db = creaClient(migrateUrl);
let istitutoId: string;
let slug: string;
let annoCorrenteId: string;

async function creaApp() {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  pluginErrori(app);
  await app.register(
    async (docente) => {
      await docente.register(pluginTenant, { db });
      await docente.register(rotteDocente, { db });
    },
    { prefix: '/api/v1/docente' },
  );
  await app.ready();
  return app;
}

beforeEach(async () => {
  slug = `test-docente-persone-${Date.now()}`;
  const [istituto] = await db
    .insert(istituti)
    .values({ slug, codiceMeccanografico: `TEST-DP-${Date.now()}`, denominazione: 'Istituto Persone', tipologia: 'liceo', modalitaAccessoDocente: 'pin_istituto' })
    .returning({ id: istituti.id });
  istitutoId = istituto!.id;
  await withTenant(db, istitutoId, async (tx) => {
    const [anno] = await tx
      .insert(anniScolastici)
      .values({ istitutoId, codice: '2026/27', dataInizio: '2026-09-01', dataFine: '2027-08-31', corrente: true })
      .returning({ id: anniScolastici.id });
    annoCorrenteId = anno!.id;
    await tx.insert(persone).values([
      { istitutoId, nome: 'Mario', cognome: 'Rossi', qualifica: 'docente', annoScolasticoId: annoCorrenteId },
      { istitutoId, nome: 'Anna', cognome: 'Bianchi', qualifica: 'docente', annoScolasticoId: annoCorrenteId },
    ]);
  });
});

afterEach(async () => {
  await withTenant(db, istitutoId, async (tx) => {
    await tx.delete(persone).where(eq(persone.istitutoId, istitutoId));
    await tx.delete(anniScolastici).where(eq(anniScolastici.istitutoId, istitutoId));
  });
  await db.delete(istituti).where(eq(istituti.id, istitutoId));
});

describe('GET /api/v1/docente/persone', () => {
  it('senza sessione (è pubblico): "ros" trova "Rossi Mario"', async () => {
    const app = await creaApp();

    const risposta = await app.inject({ method: 'GET', url: '/api/v1/docente/persone?query=ros', headers: { 'x-tenant-slug': slug } });

    expect(risposta.statusCode).toBe(200);
    const elenco = risposta.json();
    expect(elenco).toHaveLength(1);
    expect(elenco[0]).toEqual({ id: expect.any(String), nome: 'Mario', cognome: 'Rossi', qualifica: 'docente' });
  });

  it('con una query sotto i 2 caratteri risponde 400', async () => {
    const app = await creaApp();

    const risposta = await app.inject({ method: 'GET', url: '/api/v1/docente/persone?query=r', headers: { 'x-tenant-slug': slug } });

    expect(risposta.statusCode).toBe(400);
  });

  it('con modalita_accesso_docente=solo_qr risponde una lista vuota, non un errore', async () => {
    await db.update(istituti).set({ modalitaAccessoDocente: 'solo_qr' }).where(eq(istituti.id, istitutoId));
    const app = await creaApp();

    const risposta = await app.inject({ method: 'GET', url: '/api/v1/docente/persone?query=ros', headers: { 'x-tenant-slug': slug } });

    expect(risposta.statusCode).toBe(200);
    expect(risposta.json()).toEqual([]);
  });

  it('non trova persone di un anno scolastico non corrente', async () => {
    // Pulizia lasciata all'afterEach (persone → anni_scolastici, per
    // istitutoId): una delete qui nell'ordine sbagliato violerebbe la FK.
    await withTenant(db, istitutoId, async (tx) => {
      const [anno] = await tx
        .insert(anniScolastici)
        .values({ istitutoId, codice: '2025/26', dataInizio: '2025-09-01', dataFine: '2026-08-31', corrente: false })
        .returning({ id: anniScolastici.id });
      await tx.insert(persone).values({ istitutoId, nome: 'Luca', cognome: 'Verdi', qualifica: 'docente', annoScolasticoId: anno!.id });
    });
    const app = await creaApp();

    const risposta = await app.inject({ method: 'GET', url: '/api/v1/docente/persone?query=verdi', headers: { 'x-tenant-slug': slug } });

    expect(risposta.json()).toEqual([]);
  });

  it('un altro tenant non vede queste persone', async () => {
    // Anche in modalità a PIN (altrimenti tornerebbe [] per il gate sulla
    // modalità, non per l'isolamento tenant che questo test verifica).
    const slugAltro = `altro-${Date.now()}`;
    const [altro] = await db
      .insert(istituti)
      .values({ slug: slugAltro, codiceMeccanografico: `ALTRO-${Date.now()}`, denominazione: 'Altro istituto', tipologia: 'liceo', modalitaAccessoDocente: 'pin_istituto' })
      .returning({ id: istituti.id });
    const app = await creaApp();

    const risposta = await app.inject({ method: 'GET', url: '/api/v1/docente/persone?query=ros', headers: { 'x-tenant-slug': slugAltro } });

    expect(risposta.json()).toEqual([]);
    await db.delete(istituti).where(eq(istituti.id, altro!.id));
  });
});
