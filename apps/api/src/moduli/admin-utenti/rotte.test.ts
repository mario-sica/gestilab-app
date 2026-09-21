import { createHash, randomBytes } from 'node:crypto';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { eq } from 'drizzle-orm';
import { creaClient, withTenant, type Db } from '@gestilab/db';
import { istituti, utenti } from '@gestilab/db/schema';
import type { JobEmail } from '@gestilab/shared';
import { sessioni } from 'gestilab-auth-service/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pluginErrori } from '../../plugin/errori.js';
import { pluginSessione } from '../../plugin/sessione.js';
import { pluginTenant } from '../../plugin/tenant.js';
import { rotteAdminUtenti } from './rotte.js';

// Integrazione sul database reale (tenant, sessione, riga utenti); i due
// confini esterni — gestilab-auth-service e la coda email — sono mock
// tipizzati: ciascuno ha il suo test (auth-service nel suo repository,
// plugin/coda-email.test.ts qui).
const migrateUrl = process.env.DATABASE_MIGRATE_URL;
if (!migrateUrl) {
  throw new Error('DATABASE_MIGRATE_URL non impostata: avvia "pnpm dev" prima di questo test.');
}

const db: Db = creaClient(migrateUrl);
const env = { BASE_DOMAIN: 'localhost', WEB_PROTOCOLLO: 'http' as const, WEB_PORTA: 3000 };

let istitutoId: string;
let slug: string;
let adminId: string;
const creaInvito = vi.fn<(istitutoId: string, utenteId: string) => Promise<{ token: string; scadeIl: Date }>>();
const accoda = vi.fn<(job: JobEmail) => Promise<void>>();

async function creaApp() {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  pluginErrori(app);
  await app.register(cookie);
  await app.register(
    async (admin) => {
      await admin.register(pluginTenant, { db });
      await admin.register(pluginSessione, { db, area: 'admin' });
      await admin.register(rotteAdminUtenti, { db, env, authService: { creaInvito }, codaEmail: { accoda } });
    },
    { prefix: '/api/v1/admin' },
  );
  await app.ready();
  return app;
}

async function sessioneAdmin(utenteId = adminId): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await withTenant(db, istitutoId, (tx) =>
    tx.insert(sessioni).values({ istitutoId, utenteId, area: 'admin', tokenHash, scadeIl: new Date(Date.now() + 60_000) }),
  );
  return token;
}

beforeEach(async () => {
  vi.resetAllMocks();
  creaInvito.mockResolvedValue({ token: 'token-di-prova', scadeIl: new Date('2030-01-01T00:00:00.000Z') });
  accoda.mockResolvedValue();

  slug = `test-admin-utenti-${Date.now()}`;
  const [istituto] = await db
    .insert(istituti)
    .values({ slug, codiceMeccanografico: `TEST-AU-${Date.now()}`, denominazione: 'Istituto Prova', tipologia: 'liceo' })
    .returning({ id: istituti.id });
  istitutoId = istituto!.id;
  await withTenant(db, istitutoId, async (tx) => {
    const [admin] = await tx
      .insert(utenti)
      .values({ istitutoId, email: 'admin@esempio.test', nome: 'Admin', cognome: 'Prova', ruolo: 'admin' })
      .returning({ id: utenti.id });
    adminId = admin!.id;
  });
});

afterEach(async () => {
  await withTenant(db, istitutoId, async (tx) => {
    await tx.delete(sessioni).where(eq(sessioni.istitutoId, istitutoId));
    await tx.delete(utenti).where(eq(utenti.istitutoId, istitutoId));
  });
  await db.delete(istituti).where(eq(istituti.id, istitutoId));
});

const corpo = { email: 'Nuova.Persona@Esempio.test', nome: 'Nuova', cognome: 'Persona', ruolo: 'at' };

describe('POST /api/v1/admin/utenti/inviti', () => {
  it('crea l’utente senza password, chiede il token all’auth-service e accoda l’email con il link del tenant', async () => {
    const app = await creaApp();
    const token = await sessioneAdmin();

    const risposta = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/utenti/inviti',
      headers: { 'x-tenant-slug': slug, cookie: `gl_s_adm=${token}` },
      payload: corpo,
    });

    expect(risposta.statusCode).toBe(201);
    const { utenteId, scadeIl } = risposta.json();
    expect(scadeIl).toBe('2030-01-01T00:00:00.000Z');

    const [creato] = await withTenant(db, istitutoId, (tx) => tx.select().from(utenti).where(eq(utenti.id, utenteId)));
    expect(creato).toMatchObject({ email: 'nuova.persona@esempio.test', ruolo: 'at', attivo: true, passwordHash: null });

    expect(creaInvito).toHaveBeenCalledWith(istitutoId, utenteId);
    expect(accoda).toHaveBeenCalledWith({
      tipo: 'invito',
      a: 'nuova.persona@esempio.test',
      nome: 'Nuova',
      istituto: 'Istituto Prova',
      link: `http://${slug}.localhost:3000/invito/token-di-prova`,
      scadeIl: '2030-01-01T00:00:00.000Z',
    });
  });

  it('con un’email già presente nell’istituto risponde 409 senza chiamare l’auth-service', async () => {
    const app = await creaApp();
    const token = await sessioneAdmin();

    const risposta = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/utenti/inviti',
      headers: { 'x-tenant-slug': slug, cookie: `gl_s_adm=${token}` },
      payload: { ...corpo, email: 'admin@esempio.test' },
    });

    expect(risposta.statusCode).toBe(409);
    expect(risposta.json().errore.codice).toBe('EMAIL_GIA_PRESENTE');
    expect(creaInvito).not.toHaveBeenCalled();
    expect(accoda).not.toHaveBeenCalled();
  });

  it('un supervisore (area admin, sola lettura) riceve 403 con areaCorretta', async () => {
    await withTenant(db, istitutoId, (tx) => tx.update(utenti).set({ ruolo: 'supervisore' }).where(eq(utenti.id, adminId)));
    const app = await creaApp();
    const token = await sessioneAdmin();

    const risposta = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/utenti/inviti',
      headers: { 'x-tenant-slug': slug, cookie: `gl_s_adm=${token}` },
      payload: corpo,
    });

    expect(risposta.statusCode).toBe(403);
    expect(risposta.json().errore.dettagli).toEqual({ areaCorretta: 'admin' });
  });

  it('senza sessione risponde 401', async () => {
    const app = await creaApp();

    const risposta = await app.inject({ method: 'POST', url: '/api/v1/admin/utenti/inviti', headers: { 'x-tenant-slug': slug }, payload: corpo });

    expect(risposta.statusCode).toBe(401);
  });

  it('con un corpo non valido (ruolo sconosciuto) risponde 400', async () => {
    const app = await creaApp();
    const token = await sessioneAdmin();

    const risposta = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/utenti/inviti',
      headers: { 'x-tenant-slug': slug, cookie: `gl_s_adm=${token}` },
      payload: { ...corpo, ruolo: 'docente' },
    });

    expect(risposta.statusCode).toBe(400);
  });

  it('se l’auth-service non è raggiungibile risponde 503 e l’utente resta creato (reinvitabile)', async () => {
    creaInvito.mockRejectedValue(new (await import('@gestilab/shared')).ErroreDominio('AUTH_SERVICE_NON_RAGGIUNGIBILE', 'x', 503));
    const app = await creaApp();
    const token = await sessioneAdmin();

    const risposta = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/utenti/inviti',
      headers: { 'x-tenant-slug': slug, cookie: `gl_s_adm=${token}` },
      payload: corpo,
    });

    expect(risposta.statusCode).toBe(503);
    const righe = await withTenant(db, istitutoId, (tx) => tx.select().from(utenti).where(eq(utenti.email, 'nuova.persona@esempio.test')));
    expect(righe).toHaveLength(1);
    expect(accoda).not.toHaveBeenCalled();
  });
});
