import { createHash, randomBytes } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { creaClient, withTenant, type Db } from '@gestilab/db';
import { anniScolastici, istituti, utenti } from '@gestilab/db/schema';
import { sessioni } from 'gestilab-auth-service/schema';
import { leggiEnv } from '@gestilab/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { costruisciApp } from './app.js';

type App = Awaited<ReturnType<typeof costruisciApp>>;

// `exactOptionalPropertyTypes` rifiuta `payload: undefined` esplicito
// nell'oggetto: le rotte GET della tabella non hanno payload, va omesso
// del tutto, non passato come `undefined`.
async function iniettaConSlugESessione(app: App, rotta: RottaSessione, slug: string, token: string) {
  return app.inject({
    method: rotta.metodo,
    url: rotta.url,
    headers: { 'x-tenant-slug': slug, cookie: `gl_s_adm=${token}` },
    ...(rotta.payload !== undefined ? { payload: rotta.payload } : {}),
  });
}

/**
 * Task 1.7 — suite dedicata e parametrica (docs/04-convenzioni-codice.md §
 * Test: "Sicurezza | suite dedicata in CI | cross-tenant su ogni
 * endpoint"), non sparsa nei test dei singoli moduli: un nuovo endpoint
 * con sessione va aggiunto a ROTTE_SESSIONE_ADMIN, non dimenticato.
 *
 * Gira contro l'app VERA (costruisciApp, come app.test.ts), non una
 * ricostruzione parziale per modulo: verifica esattamente ciò che è
 * registrato in produzione, col ruolo di connessione applicativo
 * (gestilab_app), non quello owner.
 *
 * Endpoint esistenti fuori da questa tabella, e perché:
 * - `GET /api/v1/salute`: nessun concetto di tenant, non c'entra.
 * - `GET /api/v1/docente/persone`: pubblico (nessuna sessione, task 1.5) —
 *   il suo isolamento tra istituti è già testato in
 *   `moduli/docente/rotte.test.ts` ("un altro tenant non vede queste
 *   persone"), stessa forma dei test qui ma senza sessione da forgiare.
 *
 * Il rischio verificato: una sessione valida per l'istituto A, presentata
 * con l'header `X-Tenant-Slug` dell'istituto B, non deve MAI passare
 * `pluginSessione` — la query di lettura sessione gira dentro
 * `withTenant(db, tenantId-di-B, ...)` (RLS), quindi la riga di sessione
 * di A è invisibile in quel contesto: l'esito corretto è 401
 * SESSIONE_MANCANTE, mai i dati o l'effetto di scrittura di B. Un
 * controllo positivo (stessa sessione, proprio istituto) accompagna ogni
 * caso, per non far passare la verifica per un motivo sbagliato (es. un
 * cookie con nome errato che farebbe fallire comunque tutto con 401).
 */
const migrateUrl = process.env.DATABASE_MIGRATE_URL;
if (!migrateUrl) {
  throw new Error('DATABASE_MIGRATE_URL non impostata: avvia "pnpm dev" prima di questo test.');
}

const db: Db = creaClient(migrateUrl);
const env = leggiEnv();

interface Istituto {
  id: string;
  slug: string;
  adminId: string;
}

let istitutoA: Istituto;
let istitutoB: Istituto;

async function creaIstituto(etichetta: string): Promise<Istituto> {
  const slug = `test-cross-tenant-${etichetta}-${Date.now()}`;
  const [istituto] = await db
    .insert(istituti)
    .values({ slug, codiceMeccanografico: `TEST-CT-${etichetta}-${Date.now()}`, denominazione: `Istituto ${etichetta}`, tipologia: 'liceo' })
    .returning({ id: istituti.id });
  const istitutoId = istituto!.id;
  const adminId = await withTenant(db, istitutoId, async (tx) => {
    await tx.insert(anniScolastici).values({ istitutoId, codice: '2026/27', dataInizio: '2026-09-01', dataFine: '2027-08-31', corrente: true });
    const [admin] = await tx
      .insert(utenti)
      .values({ istitutoId, email: `admin@${slug}.test`, nome: 'Admin', cognome: etichetta, ruolo: 'admin' })
      .returning({ id: utenti.id });
    return admin!.id;
  });
  return { id: istitutoId, slug, adminId };
}

async function sessioneAdmin(istituto: Istituto): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await withTenant(db, istituto.id, (tx) =>
    tx.insert(sessioni).values({ istitutoId: istituto.id, utenteId: istituto.adminId, area: 'admin', tokenHash, scadeIl: new Date(Date.now() + 60_000) }),
  );
  return token;
}

async function pulisci(istituto: Istituto): Promise<void> {
  await withTenant(db, istituto.id, async (tx) => {
    // Il controllo positivo su POST /admin/utenti/inviti può davvero
    // raggiungere gestilab-auth-service (se il profilo "auth" gira) e
    // lasciare una riga in "inviti" (FK su utenti.id, tabella del suo
    // schema, stesso database): va rimossa prima di utenti, altrimenti la
    // delete successiva viola il vincolo.
    await tx.execute(sql`DELETE FROM inviti WHERE istituto_id = ${istituto.id}`);
    await tx.delete(sessioni).where(eq(sessioni.istitutoId, istituto.id));
    await tx.delete(utenti).where(eq(utenti.istitutoId, istituto.id));
    await tx.delete(anniScolastici).where(eq(anniScolastici.istitutoId, istituto.id));
  });
  await db.delete(istituti).where(eq(istituti.id, istituto.id));
}

beforeEach(async () => {
  istitutoA = await creaIstituto('a');
  istitutoB = await creaIstituto('b');
});

afterEach(async () => {
  await pulisci(istitutoA);
  await pulisci(istitutoB);
});

interface RottaSessione {
  nome: string;
  metodo: 'GET' | 'POST' | 'PATCH';
  url: string;
  payload?: Record<string, unknown>;
  // Status atteso quando sessione e X-Tenant-Slug sono dello stesso
  // istituto (controllo positivo). Omesso per le rotte il cui esito di
  // successo dipende da gestilab-auth-service, che in CI non gira come
  // servizio HTTP (docs/04, job "verifica" — nessuna richiesta reale lo
  // raggiunge): lì basta verificare che NON sia 401, cioè che la sessione
  // sia stata riconosciuta valida, indipendentemente da cosa succede dopo.
  statoAttesoStessoIstituto?: number;
}

const ROTTE_SESSIONE_ADMIN: RottaSessione[] = [
  { nome: 'GET /admin/utenti', metodo: 'GET', url: '/api/v1/admin/utenti', statoAttesoStessoIstituto: 200 },
  {
    nome: 'POST /admin/utenti/inviti',
    metodo: 'POST',
    url: '/api/v1/admin/utenti/inviti',
    payload: { email: 'nuovo@cross-tenant-test.test', nome: 'Nuovo', cognome: 'Utente', ruolo: 'at' },
  },
  { nome: 'GET /admin/impostazioni', metodo: 'GET', url: '/api/v1/admin/impostazioni', statoAttesoStessoIstituto: 200 },
  {
    nome: 'PATCH /admin/impostazioni',
    metodo: 'PATCH',
    url: '/api/v1/admin/impostazioni',
    payload: { modalitaAccessoDocente: 'pin_istituto' },
    statoAttesoStessoIstituto: 200,
  },
  { nome: 'POST /admin/impostazioni/pin-docente', metodo: 'POST', url: '/api/v1/admin/impostazioni/pin-docente' },
];

describe.each(ROTTE_SESSIONE_ADMIN)('$nome — sessione di un istituto contro lo slug di un altro', (rotta) => {
  it('risponde 401 SESSIONE_MANCANTE, non i dati o l’effetto dell’altro istituto', async () => {
    const app = await costruisciApp({ ...env, LOG_LEVEL: 'error' });
    const tokenA = await sessioneAdmin(istitutoA);

    const risposta = await iniettaConSlugESessione(app, rotta, istitutoB.slug, tokenA);

    expect(risposta.statusCode).toBe(401);
    expect(risposta.json().errore.codice).toBe('SESSIONE_MANCANTE');
  });

  if (rotta.statoAttesoStessoIstituto !== undefined) {
    it('controllo positivo: la stessa sessione sul proprio istituto funziona', async () => {
      const app = await costruisciApp({ ...env, LOG_LEVEL: 'error' });
      const tokenA = await sessioneAdmin(istitutoA);

      const risposta = await iniettaConSlugESessione(app, rotta, istitutoA.slug, tokenA);

      expect(risposta.statusCode).toBe(rotta.statoAttesoStessoIstituto);
    });
  } else {
    it('controllo positivo: la stessa sessione sul proprio istituto viene riconosciuta (non 401)', async () => {
      const app = await costruisciApp({ ...env, LOG_LEVEL: 'error' });
      const tokenA = await sessioneAdmin(istitutoA);

      const risposta = await iniettaConSlugESessione(app, rotta, istitutoA.slug, tokenA);

      expect(risposta.statusCode).not.toBe(401);
    });
  }
});

describe('effetti collaterali su scritture cross-tenant', () => {
  it('PATCH /admin/impostazioni con la sessione di A contro lo slug di B non modifica le impostazioni di B', async () => {
    const app = await costruisciApp({ ...env, LOG_LEVEL: 'error' });
    const tokenA = await sessioneAdmin(istitutoA);

    await app.inject({
      method: 'PATCH',
      url: '/api/v1/admin/impostazioni',
      headers: { 'x-tenant-slug': istitutoB.slug, cookie: `gl_s_adm=${tokenA}` },
      payload: { modalitaAccessoDocente: 'pin_istituto' },
    });

    const [b] = await db.select({ modalita: istituti.modalitaAccessoDocente }).from(istituti).where(eq(istituti.id, istitutoB.id));
    expect(b?.modalita).toBe('solo_qr');
  });

  it('POST /admin/utenti/inviti con la sessione di A contro lo slug di B non crea nessun utente in B', async () => {
    const app = await costruisciApp({ ...env, LOG_LEVEL: 'error' });
    const tokenA = await sessioneAdmin(istitutoA);

    await app.inject({
      method: 'POST',
      url: '/api/v1/admin/utenti/inviti',
      headers: { 'x-tenant-slug': istitutoB.slug, cookie: `gl_s_adm=${tokenA}` },
      payload: { email: 'nuovo@cross-tenant-test.test', nome: 'Nuovo', cognome: 'Utente', ruolo: 'at' },
    });

    const utentiB = await withTenant(db, istitutoB.id, (tx) => tx.select().from(utenti).where(eq(utenti.istitutoId, istitutoB.id)));
    expect(utentiB).toHaveLength(1); // solo l'admin creato in beforeEach
  });
});
