import { createHash, randomBytes } from 'node:crypto';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { eq } from 'drizzle-orm';
import { creaClient, withTenant, type Db } from '@gestilab/db';
import { affidamentiAmbienti, ambienti, anniScolastici, asset, istituti, plessi, tipiAsset, utenti } from '@gestilab/db/schema';
import { sessioni } from 'gestilab-auth-service/schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { pluginErrori } from '../../plugin/errori.js';
import { pluginSessione } from '../../plugin/sessione.js';
import { pluginTenant } from '../../plugin/tenant.js';
import { rotteTecnicoAsset } from './rotte.js';

// Integrazione sul database reale, come admin-utenti/rotte.test.ts.
const migrateUrl = process.env.DATABASE_MIGRATE_URL;
if (!migrateUrl) {
  throw new Error('DATABASE_MIGRATE_URL non impostata: avvia "pnpm dev" prima di eseguire questo test.');
}

const db: Db = creaClient(migrateUrl);

let istitutoId: string;
let slug: string;
let annoId: string;
let atId: string;
let ambienteAffidatoId: string;
let ambienteNonAffidatoId: string;
let tipoAssetId: string;

async function creaApp() {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  pluginErrori(app);
  await app.register(cookie);
  await app.register(
    async (tecnico) => {
      await tecnico.register(pluginTenant, { db });
      await tecnico.register(pluginSessione, { db, area: 'tecnico' });
      await tecnico.register(rotteTecnicoAsset, { db });
    },
    { prefix: '/api/v1/tecnico' },
  );
  await app.ready();
  return app;
}

async function sessioneAt(): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await withTenant(db, istitutoId, (tx) =>
    tx.insert(sessioni).values({ istitutoId, utenteId: atId, area: 'tecnico', tokenHash, scadeIl: new Date(Date.now() + 60_000) }),
  );
  return token;
}

const INTESTAZIONI = () => ({ 'x-tenant-slug': slug });

beforeEach(async () => {
  slug = `test-tecnico-asset-${Date.now()}`;
  const [istituto] = await db
    .insert(istituti)
    .values({ slug, codiceMeccanografico: `TEST-TA-${Date.now()}`, denominazione: 'Istituto Prova', tipologia: 'liceo' })
    .returning({ id: istituti.id });
  istitutoId = istituto!.id;

  await withTenant(db, istitutoId, async (tx) => {
    const [anno] = await tx
      .insert(anniScolastici)
      .values({ istitutoId, codice: '2026/27', dataInizio: '2026-09-01', dataFine: '2027-08-31', corrente: true })
      .returning({ id: anniScolastici.id });
    annoId = anno!.id;

    const [plesso] = await tx.insert(plessi).values({ istitutoId, nome: 'Sede centrale' }).returning({ id: plessi.id });

    const [ambienteA, ambienteB] = await tx
      .insert(ambienti)
      .values([
        { istitutoId, plessoId: plesso!.id, tipo: 'laboratorio', nome: 'Affidato', codiceBreve: 'AFF1', qrToken: `aff-${crypto.randomUUID()}` },
        { istitutoId, plessoId: plesso!.id, tipo: 'laboratorio', nome: 'Non affidato', codiceBreve: 'NOAFF1', qrToken: `noaff-${crypto.randomUUID()}` },
      ])
      .returning({ id: ambienti.id });
    ambienteAffidatoId = ambienteA!.id;
    ambienteNonAffidatoId = ambienteB!.id;

    const [at] = await tx.insert(utenti).values({ istitutoId, email: 'at@esempio.test', nome: 'AT', cognome: 'Prova', ruolo: 'at' }).returning({ id: utenti.id });
    atId = at!.id;

    await tx.insert(affidamentiAmbienti).values({ istitutoId, utenteId: atId, ambienteId: ambienteAffidatoId, annoScolasticoId: annoId, dataInizio: '2026-09-01' });

    const [tipo] = await tx.insert(tipiAsset).values({ istitutoId, nome: 'PC desktop', categoria: 'informatica' }).returning({ id: tipiAsset.id });
    tipoAssetId = tipo!.id;
  });
});

afterEach(async () => {
  await withTenant(db, istitutoId, async (tx) => {
    await tx.delete(asset).where(eq(asset.istitutoId, istitutoId));
    await tx.delete(tipiAsset).where(eq(tipiAsset.istitutoId, istitutoId));
    await tx.delete(sessioni).where(eq(sessioni.istitutoId, istitutoId));
    await tx.delete(affidamentiAmbienti).where(eq(affidamentiAmbienti.istitutoId, istitutoId));
    await tx.delete(utenti).where(eq(utenti.istitutoId, istitutoId));
    await tx.delete(ambienti).where(eq(ambienti.istitutoId, istitutoId));
    await tx.delete(plessi).where(eq(plessi.istitutoId, istitutoId));
    await tx.delete(anniScolastici).where(eq(anniScolastici.istitutoId, istitutoId));
  });
  await db.delete(istituti).where(eq(istituti.id, istitutoId));
});

async function creaAssetDiProva(ambienteId: string, etichetta: string) {
  return withTenant(db, istitutoId, (tx) =>
    tx
      .insert(asset)
      .values({
        istitutoId,
        ambienteId,
        tipoAssetId,
        etichetta,
        proprieta: 'istituto',
        codiceBreve: etichetta.padEnd(6, 'X').slice(0, 6),
        qrToken: `${etichetta}-${crypto.randomUUID()}`,
      })
      .returning({ id: asset.id }),
  );
}

describe('GET /api/v1/tecnico/asset', () => {
  it('elenca solo gli asset degli ambienti affidati, non quelli di un ambiente non affidato', async () => {
    await creaAssetDiProva(ambienteAffidatoId, 'PC-AFF-01');
    await creaAssetDiProva(ambienteNonAffidatoId, 'PC-NOAFF-01');
    const app = await creaApp();
    const token = await sessioneAt();

    const risposta = await app.inject({ method: 'GET', url: '/api/v1/tecnico/asset', headers: { ...INTESTAZIONI(), cookie: `gl_s_tec=${token}` } });

    expect(risposta.statusCode).toBe(200);
    const corpo = risposta.json();
    expect(corpo.totale).toBe(1);
    expect(corpo.dati.map((a: { etichetta: string }) => a.etichetta)).toEqual(['PC-AFF-01']);
  });

  it('un AT senza alcun affidamento vede una lista vuota, non un errore', async () => {
    await withTenant(db, istitutoId, (tx) => tx.delete(affidamentiAmbienti).where(eq(affidamentiAmbienti.utenteId, atId)));
    await creaAssetDiProva(ambienteAffidatoId, 'PC-AFF-01');
    const app = await creaApp();
    const token = await sessioneAt();

    const risposta = await app.inject({ method: 'GET', url: '/api/v1/tecnico/asset', headers: { ...INTESTAZIONI(), cookie: `gl_s_tec=${token}` } });

    expect(risposta.statusCode).toBe(200);
    expect(risposta.json()).toMatchObject({ dati: [], totale: 0 });
  });

  it('pagina/perPagina rispettati, ordinati per etichetta', async () => {
    await creaAssetDiProva(ambienteAffidatoId, 'PC-A');
    await creaAssetDiProva(ambienteAffidatoId, 'PC-B');
    await creaAssetDiProva(ambienteAffidatoId, 'PC-C');
    const app = await creaApp();
    const token = await sessioneAt();

    const risposta = await app.inject({
      method: 'GET',
      url: '/api/v1/tecnico/asset?perPagina=2&pagina=2',
      headers: { ...INTESTAZIONI(), cookie: `gl_s_tec=${token}` },
    });

    expect(risposta.statusCode).toBe(200);
    const corpo = risposta.json();
    expect(corpo).toMatchObject({ totale: 3, pagina: 2, perPagina: 2 });
    expect(corpo.dati.map((a: { etichetta: string }) => a.etichetta)).toEqual(['PC-C']);
  });

  it('filtra per ambienteId e per query sull’etichetta', async () => {
    await creaAssetDiProva(ambienteAffidatoId, 'PC-LAB1');
    await creaAssetDiProva(ambienteAffidatoId, 'MON-LAB1');
    const app = await creaApp();
    const token = await sessioneAt();

    const risposta = await app.inject({
      method: 'GET',
      url: '/api/v1/tecnico/asset?query=PC',
      headers: { ...INTESTAZIONI(), cookie: `gl_s_tec=${token}` },
    });

    expect(risposta.json().dati.map((a: { etichetta: string }) => a.etichetta)).toEqual(['PC-LAB1']);
  });

  it('senza sessione risponde 401', async () => {
    const app = await creaApp();
    const risposta = await app.inject({ method: 'GET', url: '/api/v1/tecnico/asset', headers: INTESTAZIONI() });
    expect(risposta.statusCode).toBe(401);
  });
});

describe('GET /api/v1/tecnico/asset/:id', () => {
  it('trova un asset del proprio perimetro', async () => {
    const [creato] = await creaAssetDiProva(ambienteAffidatoId, 'PC-AFF-01');
    const app = await creaApp();
    const token = await sessioneAt();

    const risposta = await app.inject({ method: 'GET', url: `/api/v1/tecnico/asset/${creato!.id}`, headers: { ...INTESTAZIONI(), cookie: `gl_s_tec=${token}` } });

    expect(risposta.statusCode).toBe(200);
    expect(risposta.json()).toMatchObject({ id: creato!.id, etichetta: 'PC-AFF-01' });
  });

  it('un asset di un ambiente non affidato risponde 404 ASSET_NON_TROVATO, non 403', async () => {
    const [creato] = await creaAssetDiProva(ambienteNonAffidatoId, 'PC-NOAFF-01');
    const app = await creaApp();
    const token = await sessioneAt();

    const risposta = await app.inject({ method: 'GET', url: `/api/v1/tecnico/asset/${creato!.id}`, headers: { ...INTESTAZIONI(), cookie: `gl_s_tec=${token}` } });

    expect(risposta.statusCode).toBe(404);
    expect(risposta.json().errore.codice).toBe('ASSET_NON_TROVATO');
  });

  it('un id inesistente risponde con lo stesso 404 (non distingue i due casi)', async () => {
    const app = await creaApp();
    const token = await sessioneAt();

    const risposta = await app.inject({
      method: 'GET',
      url: `/api/v1/tecnico/asset/${crypto.randomUUID()}`,
      headers: { ...INTESTAZIONI(), cookie: `gl_s_tec=${token}` },
    });

    expect(risposta.statusCode).toBe(404);
    expect(risposta.json().errore.codice).toBe('ASSET_NON_TROVATO');
  });

  it('un asset soft-eliminato risponde 404', async () => {
    const [creato] = await creaAssetDiProva(ambienteAffidatoId, 'PC-ELIM');
    await withTenant(db, istitutoId, (tx) => tx.update(asset).set({ eliminatoIl: new Date() }).where(eq(asset.id, creato!.id)));
    const app = await creaApp();
    const token = await sessioneAt();

    const risposta = await app.inject({ method: 'GET', url: `/api/v1/tecnico/asset/${creato!.id}`, headers: { ...INTESTAZIONI(), cookie: `gl_s_tec=${token}` } });

    expect(risposta.statusCode).toBe(404);
  });
});

const corpoNuovoAsset = (ambienteId: string, etichetta = 'PC-NUOVO') => ({
  ambienteId,
  tipoAssetId,
  etichetta,
  proprieta: 'istituto',
});

describe('POST /api/v1/tecnico/asset', () => {
  it('crea un asset nel proprio perimetro, con codice_breve e qr_token generati', async () => {
    const app = await creaApp();
    const token = await sessioneAt();

    const risposta = await app.inject({
      method: 'POST',
      url: '/api/v1/tecnico/asset',
      headers: { ...INTESTAZIONI(), cookie: `gl_s_tec=${token}` },
      payload: corpoNuovoAsset(ambienteAffidatoId),
    });

    expect(risposta.statusCode).toBe(201);
    const corpo = risposta.json();
    expect(corpo.etichetta).toBe('PC-NUOVO');
    expect(corpo.stato).toBe('attivo');
    expect(corpo.codiceBreve).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(corpo.qrToken).toHaveLength(22);
  });

  it('un ambiente non affidato risponde 404, non crea nulla', async () => {
    const app = await creaApp();
    const token = await sessioneAt();

    const risposta = await app.inject({
      method: 'POST',
      url: '/api/v1/tecnico/asset',
      headers: { ...INTESTAZIONI(), cookie: `gl_s_tec=${token}` },
      payload: corpoNuovoAsset(ambienteNonAffidatoId),
    });

    expect(risposta.statusCode).toBe(404);
    expect(risposta.json().errore.codice).toBe('ASSET_NON_TROVATO');
    const righe = await withTenant(db, istitutoId, (tx) => tx.select().from(asset).where(eq(asset.istitutoId, istitutoId)));
    expect(righe).toHaveLength(0);
  });

  it('un’etichetta già usata nell’istituto risponde 409', async () => {
    await creaAssetDiProva(ambienteAffidatoId, 'PC-DUP');
    const app = await creaApp();
    const token = await sessioneAt();

    const risposta = await app.inject({
      method: 'POST',
      url: '/api/v1/tecnico/asset',
      headers: { ...INTESTAZIONI(), cookie: `gl_s_tec=${token}` },
      payload: corpoNuovoAsset(ambienteAffidatoId, 'PC-DUP'),
    });

    expect(risposta.statusCode).toBe(409);
    expect(risposta.json().errore.codice).toBe('ETICHETTA_GIA_PRESENTE');
  });

  it('un parent_asset_id con a sua volta un parent risponde 400 (profondità massima 1)', async () => {
    const [nonno] = await creaAssetDiProva(ambienteAffidatoId, 'BASE');
    const [padre] = await withTenant(db, istitutoId, (tx) =>
      tx.insert(asset).values({ istitutoId, ambienteId: ambienteAffidatoId, tipoAssetId, parentAssetId: nonno!.id, etichetta: 'PADRE', proprieta: 'istituto', codiceBreve: 'PADREX', qrToken: `padre-${crypto.randomUUID()}` }).returning({ id: asset.id }),
    );
    const app = await creaApp();
    const token = await sessioneAt();

    const risposta = await app.inject({
      method: 'POST',
      url: '/api/v1/tecnico/asset',
      headers: { ...INTESTAZIONI(), cookie: `gl_s_tec=${token}` },
      payload: { ...corpoNuovoAsset(ambienteAffidatoId, 'FIGLIO'), parentAssetId: padre!.id },
    });

    expect(risposta.statusCode).toBe(400);
  });
});

describe('PATCH /api/v1/tecnico/asset/:id', () => {
  it('modifica un campo consentito', async () => {
    const [creato] = await creaAssetDiProva(ambienteAffidatoId, 'PC-MOD');
    const app = await creaApp();
    const token = await sessioneAt();

    const risposta = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tecnico/asset/${creato!.id}`,
      headers: { ...INTESTAZIONI(), cookie: `gl_s_tec=${token}` },
      payload: { stato: 'guasto' },
    });

    expect(risposta.statusCode).toBe(200);
    expect(risposta.json().stato).toBe('guasto');
  });

  it('rifiuta ambienteId nel corpo con 400 (si cambia solo via movimento)', async () => {
    const [creato] = await creaAssetDiProva(ambienteAffidatoId, 'PC-MOD2');
    const app = await creaApp();
    const token = await sessioneAt();

    const risposta = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tecnico/asset/${creato!.id}`,
      headers: { ...INTESTAZIONI(), cookie: `gl_s_tec=${token}` },
      payload: { ambienteId: ambienteNonAffidatoId },
    });

    expect(risposta.statusCode).toBe(400);
    const righe = await withTenant(db, istitutoId, (tx) => tx.select().from(asset).where(eq(asset.id, creato!.id)));
    expect(righe[0]?.ambienteId).toBe(ambienteAffidatoId);
  });

  it('un asset fuori perimetro risponde 404', async () => {
    const [creato] = await creaAssetDiProva(ambienteNonAffidatoId, 'PC-FUORI');
    const app = await creaApp();
    const token = await sessioneAt();

    const risposta = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tecnico/asset/${creato!.id}`,
      headers: { ...INTESTAZIONI(), cookie: `gl_s_tec=${token}` },
      payload: { stato: 'guasto' },
    });

    expect(risposta.statusCode).toBe(404);
  });
});

describe('DELETE /api/v1/tecnico/asset/:id', () => {
  it('elimina (soft) un asset del proprio perimetro', async () => {
    const [creato] = await creaAssetDiProva(ambienteAffidatoId, 'PC-DEL');
    const app = await creaApp();
    const token = await sessioneAt();

    const risposta = await app.inject({ method: 'DELETE', url: `/api/v1/tecnico/asset/${creato!.id}`, headers: { ...INTESTAZIONI(), cookie: `gl_s_tec=${token}` } });

    expect(risposta.statusCode).toBe(204);
    const [riga] = await withTenant(db, istitutoId, (tx) => tx.select().from(asset).where(eq(asset.id, creato!.id)));
    expect(riga?.eliminatoIl).not.toBeNull();
  });

  it('un asset fuori perimetro risponde 404, non elimina nulla', async () => {
    const [creato] = await creaAssetDiProva(ambienteNonAffidatoId, 'PC-FUORI-DEL');
    const app = await creaApp();
    const token = await sessioneAt();

    const risposta = await app.inject({ method: 'DELETE', url: `/api/v1/tecnico/asset/${creato!.id}`, headers: { ...INTESTAZIONI(), cookie: `gl_s_tec=${token}` } });

    expect(risposta.statusCode).toBe(404);
    const [riga] = await withTenant(db, istitutoId, (tx) => tx.select().from(asset).where(eq(asset.id, creato!.id)));
    expect(riga?.eliminatoIl).toBeNull();
  });
});
