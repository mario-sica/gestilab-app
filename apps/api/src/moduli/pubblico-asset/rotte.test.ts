import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { eq } from 'drizzle-orm';
import { creaClient, withTenant, type Db } from '@gestilab/db';
import { ambienti, asset, istituti, plessi, tipiAsset } from '@gestilab/db/schema';
import { leggiEnv } from '@gestilab/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { costruisciApp } from '../../app.js';
import { pluginErrori } from '../../plugin/errori.js';
import { pluginTenant } from '../../plugin/tenant.js';
import { rottePubblicoAsset } from './rotte.js';

// Integrazione sul database reale, come docente/rotte.test.ts.
const migrateUrl = process.env.DATABASE_MIGRATE_URL;
if (!migrateUrl) {
  throw new Error('DATABASE_MIGRATE_URL non impostata: avvia "pnpm dev" prima di eseguire questo test.');
}

const db: Db = creaClient(migrateUrl);

let istitutoId: string;
let slug: string;
let assetAttivoId: string;
let qrTokenAttivo: string;
let codiceBreveAttivo: string;
let qrTokenPaginaDisattivata: string;

async function creaApp() {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  pluginErrori(app);
  await app.register(
    async (pubblico) => {
      await pubblico.register(pluginTenant, { db });
      await pubblico.register(rottePubblicoAsset, { db });
    },
    { prefix: '/api/v1/pubblico' },
  );
  await app.ready();
  return app;
}

beforeEach(async () => {
  slug = `test-pubblico-asset-${Date.now()}`;
  const [istituto] = await db
    .insert(istituti)
    .values({ slug, codiceMeccanografico: `TEST-PA-${Date.now()}`, denominazione: 'Istituto Prova', tipologia: 'liceo' })
    .returning({ id: istituti.id });
  istitutoId = istituto!.id;

  await withTenant(db, istitutoId, async (tx) => {
    const [plesso] = await tx.insert(plessi).values({ istitutoId, nome: 'Sede centrale' }).returning({ id: plessi.id });
    const [ambiente] = await tx
      .insert(ambienti)
      .values({ istitutoId, plessoId: plesso!.id, tipo: 'laboratorio', nome: 'Laboratorio Informatica 1', codiceBreve: 'LAB1', qrToken: `amb-${crypto.randomUUID()}` })
      .returning({ id: ambienti.id });
    const [tipo] = await tx.insert(tipiAsset).values({ istitutoId, nome: 'PC desktop', categoria: 'informatica' }).returning({ id: tipiAsset.id });

    qrTokenAttivo = `qr-attivo-${crypto.randomUUID()}`;
    codiceBreveAttivo = 'ABC234';
    const [attivo] = await tx
      .insert(asset)
      .values({
        istitutoId,
        ambienteId: ambiente!.id,
        tipoAssetId: tipo!.id,
        etichetta: 'PC-LAB1-01',
        marca: 'Dell',
        modello: 'OptiPlex 3000',
        proprieta: 'istituto',
        codiceBreve: codiceBreveAttivo,
        qrToken: qrTokenAttivo,
      })
      .returning({ id: asset.id });
    assetAttivoId = attivo!.id;

    qrTokenPaginaDisattivata = `qr-disattivato-${crypto.randomUUID()}`;
    await tx.insert(asset).values({
      istitutoId,
      ambienteId: ambiente!.id,
      tipoAssetId: tipo!.id,
      etichetta: 'PC-LAB1-02',
      proprieta: 'istituto',
      codiceBreve: 'DEF567',
      qrToken: qrTokenPaginaDisattivata,
      paginaPubblicaAttiva: false,
    });
  });
});

afterEach(async () => {
  await withTenant(db, istitutoId, async (tx) => {
    await tx.delete(asset).where(eq(asset.istitutoId, istitutoId));
    await tx.delete(tipiAsset).where(eq(tipiAsset.istitutoId, istitutoId));
    await tx.delete(ambienti).where(eq(ambienti.istitutoId, istitutoId));
    await tx.delete(plessi).where(eq(plessi.istitutoId, istitutoId));
  });
  await db.delete(istituti).where(eq(istituti.id, istitutoId));
});

describe('GET /api/v1/pubblico/asset/qr/:token', () => {
  it('risolve un asset con pagina pubblica attiva, con il payload minimo', async () => {
    const app = await creaApp();

    const risposta = await app.inject({ method: 'GET', url: `/api/v1/pubblico/asset/qr/${qrTokenAttivo}`, headers: { 'x-tenant-slug': slug } });

    expect(risposta.statusCode).toBe(200);
    expect(risposta.headers['cache-control']).toBe('no-store');
    expect(risposta.json()).toEqual({
      etichetta: 'PC-LAB1-01',
      tipoAsset: 'PC desktop',
      categoria: 'informatica',
      marca: 'Dell',
      modello: 'OptiPlex 3000',
      ambiente: 'Laboratorio Informatica 1',
      stato: 'attivo',
    });
    // Nessun dato patrimoniale/identificativo nella risposta grezza.
    expect(risposta.body).not.toContain('seriale');
    expect(risposta.body).not.toContain('numeroInventario');
    expect(risposta.body).not.toContain('valoreAcquisto');
  });

  it('un token inesistente risponde 404 ASSET_NON_TROVATO', async () => {
    const app = await creaApp();

    const risposta = await app.inject({ method: 'GET', url: '/api/v1/pubblico/asset/qr/token-inesistente', headers: { 'x-tenant-slug': slug } });

    expect(risposta.statusCode).toBe(404);
    expect(risposta.json().errore.codice).toBe('ASSET_NON_TROVATO');
  });

  it('un asset con pagina pubblica disattivata risponde con lo stesso 404 di un token inesistente', async () => {
    const app = await creaApp();

    const risposta = await app.inject({ method: 'GET', url: `/api/v1/pubblico/asset/qr/${qrTokenPaginaDisattivata}`, headers: { 'x-tenant-slug': slug } });

    expect(risposta.statusCode).toBe(404);
    expect(risposta.json().errore.codice).toBe('ASSET_NON_TROVATO');
  });

  it('un asset soft-eliminato risponde 404', async () => {
    await withTenant(db, istitutoId, (tx) => tx.update(asset).set({ eliminatoIl: new Date() }).where(eq(asset.id, assetAttivoId)));
    const app = await creaApp();

    const risposta = await app.inject({ method: 'GET', url: `/api/v1/pubblico/asset/qr/${qrTokenAttivo}`, headers: { 'x-tenant-slug': slug } });

    expect(risposta.statusCode).toBe(404);
  });

  it('un token di un altro istituto non risolve (isolamento RLS)', async () => {
    const slugAltro = `altro-pubblico-${Date.now()}`;
    const [altro] = await db
      .insert(istituti)
      .values({ slug: slugAltro, codiceMeccanografico: `ALTRO-PA-${Date.now()}`, denominazione: 'Altro istituto', tipologia: 'liceo' })
      .returning({ id: istituti.id });
    const app = await creaApp();

    const risposta = await app.inject({ method: 'GET', url: `/api/v1/pubblico/asset/qr/${qrTokenAttivo}`, headers: { 'x-tenant-slug': slugAltro } });

    expect(risposta.statusCode).toBe(404);
    await db.delete(istituti).where(eq(istituti.id, altro!.id));
  });
});

describe('GET /api/v1/pubblico/asset/codice-breve/:codice', () => {
  it('risolve un asset dal codice breve', async () => {
    const app = await creaApp();

    const risposta = await app.inject({ method: 'GET', url: `/api/v1/pubblico/asset/codice-breve/${codiceBreveAttivo}`, headers: { 'x-tenant-slug': slug } });

    expect(risposta.statusCode).toBe(200);
    expect(risposta.json().etichetta).toBe('PC-LAB1-01');
  });

  it('normalizza il codice a maiuscolo (digitato da mobile)', async () => {
    const app = await creaApp();

    const risposta = await app.inject({
      method: 'GET',
      url: `/api/v1/pubblico/asset/codice-breve/${codiceBreveAttivo.toLowerCase()}`,
      headers: { 'x-tenant-slug': slug },
    });

    expect(risposta.statusCode).toBe(200);
  });

  it('un codice inesistente risponde 404', async () => {
    const app = await creaApp();

    const risposta = await app.inject({ method: 'GET', url: '/api/v1/pubblico/asset/codice-breve/ZZZ999', headers: { 'x-tenant-slug': slug } });

    expect(risposta.statusCode).toBe(404);
    expect(risposta.json().errore.codice).toBe('ASSET_NON_TROVATO');
  });
});

// L'app vera (costruisciApp), non il mini-app sopra: serve pluginRateLimit
// (Redis) davvero registrato per verificare la soglia per-rotta.
describe('rate limit su /pubblico/asset/codice-breve', () => {
  it('oltre 20 richieste al minuto sullo stesso codice risponde 429', async () => {
    const env = leggiEnv();
    const app = await costruisciApp({ ...env, LOG_LEVEL: 'error' });
    const codiceUnico = `RL${Date.now().toString().slice(-4)}`;

    let ultima;
    for (let i = 0; i < 21; i++) {
      ultima = await app.inject({ method: 'GET', url: `/api/v1/pubblico/asset/codice-breve/${codiceUnico}`, headers: { 'x-tenant-slug': slug } });
    }

    expect(ultima!.statusCode).toBe(429);
    expect(ultima!.json().errore.codice).toBe('TROPPE_RICHIESTE');
  });
});
