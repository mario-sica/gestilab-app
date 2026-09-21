import { createHash, randomBytes } from 'node:crypto';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { eq } from 'drizzle-orm';
import { creaClient, withTenant, type Db } from '@gestilab/db';
import { istituti, utenti } from '@gestilab/db/schema';
import { sessioni } from 'gestilab-auth-service/schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { pluginErrori } from './errori.js';
import { pluginTenant } from './tenant.js';
import { pluginSessione, richiediRuolo } from './sessione.js';

// Integrazione: richiede il servizio "db" del profilo dev, con la
// connessione owner (scrive sessioni e utenti in setup/teardown).
const migrateUrl = process.env.DATABASE_MIGRATE_URL;
if (!migrateUrl) {
  throw new Error('DATABASE_MIGRATE_URL non impostata: avvia "pnpm dev" prima di questo test.');
}

const db: Db = creaClient(migrateUrl);

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

let istitutoId: string;
let slug: string;
let utenteId: string;

async function creaApp() {
  const app = Fastify({ logger: false });
  pluginErrori(app);
  await app.register(cookie);
  await app.register(pluginTenant, { db });
  await app.register(pluginSessione, { db, area: 'admin' });
  app.get('/protetta', { preHandler: richiediRuolo(['admin']) }, async (request) => ({
    utente: request.utente,
  }));
  app.get('/qualunque-ruolo', async (request) => ({ utente: request.utente }));
  await app.ready();
  return app;
}

async function creaSessioneDiTest(area: 'admin' | 'tecnico', scadeIl: Date): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await withTenant(db, istitutoId, (tx) =>
    tx.insert(sessioni).values({ istitutoId, utenteId, area, tokenHash: hashToken(token), scadeIl }),
  );
  return token;
}

beforeEach(async () => {
  slug = `test-sessione-api-${Date.now()}`;
  const [istituto] = await db
    .insert(istituti)
    .values({
      slug,
      codiceMeccanografico: `TEST-SESSIONE-API-${Date.now()}`,
      denominazione: 'Istituto di test per plugin sessione',
      tipologia: 'liceo',
    })
    .returning({ id: istituti.id });
  istitutoId = istituto!.id;

  await withTenant(db, istitutoId, async (tx) => {
    const [utente] = await tx
      .insert(utenti)
      .values({ istitutoId, email: 'test@esempio.test', nome: 'Test', cognome: 'Sessione', ruolo: 'admin' })
      .returning({ id: utenti.id });
    utenteId = utente!.id;
  });
});

afterEach(async () => {
  await withTenant(db, istitutoId, async (tx) => {
    await tx.delete(sessioni).where(eq(sessioni.istitutoId, istitutoId));
    await tx.delete(utenti).where(eq(utenti.istitutoId, istitutoId));
  });
  await db.delete(istituti).where(eq(istituti.id, istitutoId));
});

describe('pluginSessione', () => {
  it('con un cookie di sessione valido, decora request.utente', async () => {
    const token = await creaSessioneDiTest('admin', new Date(Date.now() + 60_000));
    const app = await creaApp();

    const risposta = await app.inject({
      method: 'GET',
      url: '/qualunque-ruolo',
      headers: { 'x-tenant-slug': slug, cookie: `gl_s_adm=${token}` },
    });

    expect(risposta.statusCode).toBe(200);
    expect(risposta.json().utente).toEqual({ id: utenteId, nome: 'Test', cognome: 'Sessione', email: 'test@esempio.test', ruolo: 'admin' });
  });

  it('senza cookie risponde 401', async () => {
    const app = await creaApp();

    const risposta = await app.inject({ method: 'GET', url: '/qualunque-ruolo', headers: { 'x-tenant-slug': slug } });

    expect(risposta.statusCode).toBe(401);
    expect(risposta.json().errore.codice).toBe('SESSIONE_MANCANTE');
  });

  it('con un token che non corrisponde a nessuna sessione risponde 401', async () => {
    const app = await creaApp();

    const risposta = await app.inject({
      method: 'GET',
      url: '/qualunque-ruolo',
      headers: { 'x-tenant-slug': slug, cookie: 'gl_s_adm=token-inventato' },
    });

    expect(risposta.statusCode).toBe(401);
  });

  it('con una sessione scaduta risponde 401', async () => {
    const token = await creaSessioneDiTest('admin', new Date(Date.now() - 1000));
    const app = await creaApp();

    const risposta = await app.inject({
      method: 'GET',
      url: '/qualunque-ruolo',
      headers: { 'x-tenant-slug': slug, cookie: `gl_s_adm=${token}` },
    });

    expect(risposta.statusCode).toBe(401);
  });

  it('con una sessione di un\'altra area (cookie sbagliato) risponde 401', async () => {
    // gl_s_tec non esiste per questo plugin (montato per "admin"): il
    // cookie "sbagliato" semplicemente non c'è nella richiesta.
    const token = await creaSessioneDiTest('tecnico', new Date(Date.now() + 60_000));
    const app = await creaApp();

    const risposta = await app.inject({
      method: 'GET',
      url: '/qualunque-ruolo',
      headers: { 'x-tenant-slug': slug, cookie: `gl_s_adm=${token}` },
    });

    // Il token esiste ma è di una sessione "tecnico": anche se qualcuno
    // lo inviasse nel cookie sbagliato, il confronto sessione.area !==
    // opts.area lo rifiuta comunque.
    expect(risposta.statusCode).toBe(401);
  });

  it('un utente disattivato dopo il login perde l\'accesso alla richiesta successiva', async () => {
    const token = await creaSessioneDiTest('admin', new Date(Date.now() + 60_000));
    await withTenant(db, istitutoId, (tx) => tx.update(utenti).set({ attivo: false }).where(eq(utenti.id, utenteId)));
    const app = await creaApp();

    const risposta = await app.inject({
      method: 'GET',
      url: '/qualunque-ruolo',
      headers: { 'x-tenant-slug': slug, cookie: `gl_s_adm=${token}` },
    });

    expect(risposta.statusCode).toBe(401);
  });
});

describe('richiediRuolo', () => {
  it('con il ruolo ammesso risponde 200', async () => {
    const token = await creaSessioneDiTest('admin', new Date(Date.now() + 60_000));
    const app = await creaApp();

    const risposta = await app.inject({
      method: 'GET',
      url: '/protetta',
      headers: { 'x-tenant-slug': slug, cookie: `gl_s_adm=${token}` },
    });

    expect(risposta.statusCode).toBe(200);
  });

  it('con un ruolo non ammesso risponde 403', async () => {
    await withTenant(db, istitutoId, (tx) => tx.update(utenti).set({ ruolo: 'supervisore' }).where(eq(utenti.id, utenteId)));
    const token = await creaSessioneDiTest('admin', new Date(Date.now() + 60_000));
    const app = await creaApp();

    const risposta = await app.inject({
      method: 'GET',
      url: '/protetta',
      headers: { 'x-tenant-slug': slug, cookie: `gl_s_adm=${token}` },
    });

    expect(risposta.statusCode).toBe(403);
    expect(risposta.json().errore).toEqual({
      codice: 'RUOLO_NON_VALIDO',
      messaggio: 'Non hai i permessi per questa azione.',
      // Un supervisore appartiene all'area admin: è lì che apps/web deve
      // rimandarlo, non alla pagina di login (docs/02-architettura.md § Aree).
      dettagli: { areaCorretta: 'admin' },
    });
  });
});
