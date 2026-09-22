import { parseArgs } from 'node:util';
import { eq } from 'drizzle-orm';
import { eSlugRiservato, formatoSlugValido, leggiEnv, origineTenant, type Env } from '@gestilab/shared';

import { creaClient, type Db } from './client.js';
import { withTenant } from './with-tenant.js';
import { anniScolastici, istituti, istitutoTipologia, utenti } from './schema/index.js';

/**
 * Task 1.6 (RF-A1): provisioning di un nuovo tenant, per il fornitore, non
 * per l'admin dell'istituto (che a questo punto non esiste ancora). Crea
 * solo istituto + anno scolastico corrente + admin iniziale con invito
 * (docs/02-architettura.md § Provisioning tenant) — tipi asset, guide
 * rapide, template risposta e checklist di sistema arrivano incrementalmente
 * con le fasi 2 e 4, quando i loro schemi esisteranno: precaricarli ora
 * userebbe dati inventati per uno schema che ancora cambierà.
 *
 * A differenza di `seed.ts` (idempotente, dati demo re-eseguibili), qui uno
 * slug già esistente è un errore: un secondo tenant reale con lo stesso
 * slug non è mai un'operazione da far proseguire in silenzio.
 *
 * Il link d'invito si ottiene chiamando gestilab-auth-service come farebbe
 * `apps/api` (stesso endpoint POST /inviti) e va solo in console: non
 * esiste ancora un `apps/worker` da invocare fuori da Fastify, e per un
 * comando lanciato una volta dal fornitore la coda email non aggiunge
 * nulla.
 */

export interface DatiNuovoTenant {
  slug: string;
  denominazione: string;
  codiceMeccanografico: string;
  tipologia: string;
  adminEmail: string;
  adminNome: string;
  adminCognome: string;
}

export interface TenantCreato {
  istitutoId: string;
  adminUtenteId: string;
  linkInvito: string;
  scadeIl: Date;
}

function annoScolasticoCorrente(oggi: Date): { codice: string; dataInizio: string; dataFine: string } {
  // Convenzione applicativa (non normata altrove): l'anno scolastico va da
  // settembre ad agosto. Prima di settembre si è ancora nell'anno iniziato
  // il settembre precedente.
  const annoInizio = oggi.getMonth() + 1 >= 9 ? oggi.getFullYear() : oggi.getFullYear() - 1;
  const annoFine = annoInizio + 1;
  return {
    codice: `${annoInizio}/${String(annoFine).slice(-2)}`,
    dataInizio: `${annoInizio}-09-01`,
    dataFine: `${annoFine}-08-31`,
  };
}

async function emettiInvito(authServiceUrl: string, istitutoId: string, utenteId: string): Promise<{ token: string; scadeIl: Date }> {
  let risposta: Response;
  try {
    risposta = await fetch(`${authServiceUrl}/inviti`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ istitutoId, utenteId }),
    });
  } catch {
    throw new Error(
      `Istituto e admin creati (istitutoId=${istitutoId}, utenteId=${utenteId}), ma gestilab-auth-service non è raggiungibile: nessun invito emesso. Verifica il profilo "auth" e rilancia l'invito manualmente.`,
    );
  }
  if (!risposta.ok) {
    throw new Error(
      `Istituto e admin creati (istitutoId=${istitutoId}, utenteId=${utenteId}), ma gestilab-auth-service ha risposto ${risposta.status} a POST /inviti: nessun invito emesso.`,
    );
  }
  const corpo = (await risposta.json()) as { token: string; scadeIl: string };
  return { token: corpo.token, scadeIl: new Date(corpo.scadeIl) };
}

export async function creaTenant(
  db: Db,
  authServiceUrl: string,
  env: Pick<Env, 'BASE_DOMAIN' | 'WEB_PROTOCOLLO' | 'WEB_PORTA'>,
  dati: DatiNuovoTenant,
): Promise<TenantCreato> {
  if (!formatoSlugValido(dati.slug) || eSlugRiservato(dati.slug)) {
    throw new Error(`Slug "${dati.slug}" non valido: deve rispettare [a-z0-9-]{3,40}, non riservato (vedi packages/shared/src/slug.ts).`);
  }
  if (!(istitutoTipologia.enumValues as readonly string[]).includes(dati.tipologia)) {
    throw new Error(`Tipologia "${dati.tipologia}" non valida: valori ammessi ${istitutoTipologia.enumValues.join(', ')}.`);
  }

  const [esistente] = await db.select({ id: istituti.id }).from(istituti).where(eq(istituti.slug, dati.slug));
  if (esistente) {
    throw new Error(`Esiste già un istituto con slug "${dati.slug}".`);
  }

  const [istituto] = await db
    .insert(istituti)
    .values({
      slug: dati.slug,
      denominazione: dati.denominazione,
      codiceMeccanografico: dati.codiceMeccanografico,
      tipologia: dati.tipologia as (typeof istitutoTipologia.enumValues)[number],
    })
    .returning();
  if (!istituto) {
    throw new Error(`Istituto "${dati.slug}" non creato.`);
  }

  const { codice, dataInizio, dataFine } = annoScolasticoCorrente(new Date());

  const adminUtenteId = await withTenant(db, istituto.id, async (tx) => {
    const [anno] = await tx
      .insert(anniScolastici)
      .values({ istitutoId: istituto.id, codice, dataInizio, dataFine, corrente: true })
      .returning();
    if (!anno) {
      throw new Error(`Anno scolastico non creato per "${dati.slug}".`);
    }

    const [admin] = await tx
      .insert(utenti)
      .values({
        istitutoId: istituto.id,
        email: dati.adminEmail,
        nome: dati.adminNome,
        cognome: dati.adminCognome,
        ruolo: 'admin',
      })
      .returning();
    if (!admin) {
      throw new Error(`Admin non creato per "${dati.slug}".`);
    }
    return admin.id;
  });

  const invito = await emettiInvito(authServiceUrl, istituto.id, adminUtenteId);

  return {
    istitutoId: istituto.id,
    adminUtenteId,
    linkInvito: `${origineTenant(env, istituto.slug)}/invito/${invito.token}`,
    scadeIl: invito.scadeIl,
  };
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      slug: { type: 'string' },
      nome: { type: 'string' },
      meccanografico: { type: 'string' },
      tipologia: { type: 'string' },
      'admin-email': { type: 'string' },
      'admin-nome': { type: 'string' },
      'admin-cognome': { type: 'string' },
    },
  });

  const obbligatori = ['slug', 'nome', 'meccanografico', 'tipologia', 'admin-email', 'admin-nome', 'admin-cognome'] as const;
  const mancanti = obbligatori.filter((chiave) => !values[chiave]);
  if (mancanti.length > 0) {
    console.error(
      `Argomenti mancanti: ${mancanti.map((chiave) => `--${chiave}`).join(', ')}\n\n` +
        'Uso: pnpm tenant:create --slug <slug> --nome <denominazione> --meccanografico <codice> --tipologia <liceo|tecnico|professionale|IISS> ' +
        '--admin-email <email> --admin-nome <nome> --admin-cognome <cognome>',
    );
    process.exitCode = 1;
    return;
  }

  const env = leggiEnv();
  const db = creaClient(env.DATABASE_URL);

  try {
    const risultato = await creaTenant(db, env.AUTH_SERVICE_URL, env, {
      slug: values.slug!,
      denominazione: values.nome!,
      codiceMeccanografico: values.meccanografico!,
      tipologia: values.tipologia!,
      adminEmail: values['admin-email']!.trim().toLowerCase(),
      adminNome: values['admin-nome']!,
      adminCognome: values['admin-cognome']!,
    });

    console.log(`Istituto creato: ${risultato.istitutoId}`);
    console.log(`Admin iniziale: ${risultato.adminUtenteId}`);
    console.log(`Link d'invito (scade il ${risultato.scadeIl.toISOString()}):`);
    console.log(risultato.linkInvito);
  } finally {
    await db.$client.end();
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch((errore: unknown) => {
    console.error(errore instanceof Error ? errore.message : errore);
    process.exitCode = 1;
  });
}
