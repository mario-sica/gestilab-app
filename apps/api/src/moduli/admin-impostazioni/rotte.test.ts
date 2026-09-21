import { createHash, randomBytes } from 'node:crypto';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { eq } from 'drizzle-orm';
import { creaClient, withTenant, type Db } from '@gestilab/db';
import { istituti, utenti } from '@gestilab/db/schema';
import { sessioni } from 'gestilab-auth-service/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pluginErrori } from '../../plugin/errori.js';
import { pluginSessione } from '../../plugin/sessione.js';
import { pluginTenant } from '../../plugin/tenant.js';
import { rotteAdminImpostazioni } from './rotte.js';

const migrateUrl = process.env.DATABASE_MIGRATE_URL;
if (!migrateUrl) {
  throw new Error('DATABASE_MIGRATE_URL non impostata: avvia "pnpm dev" prima di questo test.');
}

const db: Db = creaClient(migrateUrl);
const rigeneraPinIstituto = vi.fn<(istitutoId: string) => Promise<{ pin: string; sessioniDocenteRevocate: number }>>();
const creaInvito = vi.fn();

let istitutoId: string;
let slug: string;
let utenteId: string;

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
      await admin.register(rotteAdminImpostazioni, { db, authService: { creaInvito, rigeneraPinIstituto } });
    },
    { prefix: '/api/v1/admin' },
  );
  await app.ready();
  return app;
}

async function sessione(): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await withTenant(db, istitutoId, (tx) =>
    tx.insert(sessioni).values({
      istitutoId,
      utenteId,
      area: 'admin',
      tokenHash: createHash('sha256').update(token).digest('hex'),
      scadeIl: new Date(Date.now() + 60_000),
    }),
  );
  return token;
}

beforeEach(async () => {
  vi.resetAllMocks();
  rigeneraPinIstituto.mockResolvedValue({ pin: '042817', sessioniDocenteRevocate: 3 });
  slug = `test-impostazioni-${Date.now()}`;
  const [istituto] = await db
    .insert(istituti)
    .values({ slug, codiceMeccanografico: `TEST-IMP-${Date.now()}`, denominazione: 'Istituto Impostazioni', tipologia: 'liceo' })
    .returning({ id: istituti.id });
  istitutoId = istituto!.id;
  await withTenant(db, istitutoId, async (tx) => {
    const [u] = await tx
      .insert(utenti)
      .values({ istitutoId, email: 'admin@esempio.test', nome: 'Admin', cognome: 'Imp', ruolo: 'admin' })
      .returning({ id: utenti.id });
    utenteId = u!.id;
  });
});

afterEach(async () => {
  await withTenant(db, istitutoId, async (tx) => {
    await tx.delete(sessioni).where(eq(sessioni.istitutoId, istitutoId));
    await tx.delete(utenti).where(eq(utenti.istitutoId, istitutoId));
  });
  await db.delete(istituti).where(eq(istituti.id, istitutoId));
});

describe('/api/v1/admin/impostazioni', () => {
  it('GET risponde modalità e se il PIN è impostato, mai l’hash', async () => {
    await db.update(istituti).set({ pinIstitutoHash: '$argon2id$finto' }).where(eq(istituti.id, istitutoId));
    const app = await creaApp();
    const token = await sessione();

    const risposta = await app.inject({ method: 'GET', url: '/api/v1/admin/impostazioni', headers: { 'x-tenant-slug': slug, cookie: `gl_s_adm=${token}` } });

    expect(risposta.statusCode).toBe(200);
    expect(risposta.json()).toEqual({ modalitaAccessoDocente: 'solo_qr', pinImpostato: true });
    expect(risposta.body).not.toContain('argon2');
  });

  it('POST pin-docente (admin) chiede la rigenerazione all’auth-service e risponde il PIN una volta', async () => {
    const app = await creaApp();
    const token = await sessione();

    const risposta = await app.inject({ method: 'POST', url: '/api/v1/admin/impostazioni/pin-docente', headers: { 'x-tenant-slug': slug, cookie: `gl_s_adm=${token}` } });

    expect(risposta.statusCode).toBe(200);
    expect(risposta.json()).toEqual({ pin: '042817', sessioniDocenteRevocate: 3 });
    expect(rigeneraPinIstituto).toHaveBeenCalledWith(istitutoId);
  });

  it('un supervisore può leggere ma non rigenerare (403 con areaCorretta)', async () => {
    await withTenant(db, istitutoId, (tx) => tx.update(utenti).set({ ruolo: 'supervisore' }).where(eq(utenti.id, utenteId)));
    const app = await creaApp();
    const token = await sessione();
    const intestazioni = { 'x-tenant-slug': slug, cookie: `gl_s_adm=${token}` };

    expect((await app.inject({ method: 'GET', url: '/api/v1/admin/impostazioni', headers: intestazioni })).statusCode).toBe(200);
    const rigenera = await app.inject({ method: 'POST', url: '/api/v1/admin/impostazioni/pin-docente', headers: intestazioni });
    expect(rigenera.statusCode).toBe(403);
    expect(rigenera.json().errore.dettagli).toEqual({ areaCorretta: 'admin' });
    expect(rigeneraPinIstituto).not.toHaveBeenCalled();
  });
});
