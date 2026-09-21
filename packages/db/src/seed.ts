import { and, eq } from 'drizzle-orm';
import { leggiEnv } from '@gestilab/shared';

import { creaClient } from './client.js';
import { withTenant } from './with-tenant.js';
import {
  ambienti,
  anniScolastici,
  affidamentiAmbienti,
  istituti,
  persone,
  plessi,
  utenti,
} from './schema/index.js';

/**
 * Dati demo per il pilota: due istituti (dellaquila, demo) con un minimo di
 * dati collegati, per verificare a occhio l'isolamento tra tenant (docs/
 * 02-architettura.md). Idempotente per istituto: se esiste già un anno
 * scolastico corrente, quel tenant è già seminato e viene saltato per
 * intero — rieseguibile senza duplicare nulla. Pensato per girare in
 * container: `pnpm db:seed` dalla radice, come `pnpm db:migrate`.
 */

// Password di tutti gli utenti demo: "GestiLabDemo2026!". Hash Argon2id
// precalcolato (stessi parametri di gestilab-auth-service, docs/06 § 2.1)
// per non aggiungere argon2 a packages/db. Solo per l'ambiente locale e i
// test end-to-end (apps/web/e2e): un tenant reale nasce da
// `pnpm tenant:create` (task 1.6) con invito, mai con questa password.
const HASH_PASSWORD_DEMO = '$argon2id$v=19$m=19456,t=2,p=1$e8BsKB1w3v4xKCB6C3YzfQ$V4xI9BMkUkY4rbXSELw8VpZuZeLwXEtI72sEkn/dndc';

interface DatiTenant {
  slug: string;
  codiceMeccanografico: string;
  denominazione: string;
  tipologia: 'IISS' | 'liceo';
}

const TENANT_DEMO: DatiTenant[] = [
  {
    slug: 'dellaquila',
    codiceMeccanografico: 'FGIS00100X',
    denominazione: "IISS M. Dell'Aquila - S. Staffa",
    tipologia: 'IISS',
  },
  {
    slug: 'demo',
    codiceMeccanografico: 'FGIS00200X',
    denominazione: 'Liceo Demo — verifica isolamento tenant',
    tipologia: 'liceo',
  },
];

async function main(): Promise<void> {
  const env = leggiEnv();
  const db = creaClient(env.DATABASE_URL);

  try {
    await seminaTutti(db, env.BASE_DOMAIN);
  } finally {
    await db.$client.end();
  }
}

async function seminaTutti(db: ReturnType<typeof creaClient>, baseDomain: string): Promise<void> {
  for (const dati of TENANT_DEMO) {
    const [istituto] = await db
      .insert(istituti)
      .values({
        slug: dati.slug,
        codiceMeccanografico: dati.codiceMeccanografico,
        denominazione: dati.denominazione,
        tipologia: dati.tipologia,
      })
      .onConflictDoUpdate({
        target: istituti.slug,
        set: { denominazione: dati.denominazione },
      })
      .returning();

    if (!istituto) {
      throw new Error(`Istituto "${dati.slug}" non creato.`);
    }

    const giaSeminato = await withTenant(db, istituto.id, async (tx) => {
      const [annoEsistente] = await tx
        .select({ id: anniScolastici.id })
        .from(anniScolastici)
        .where(and(eq(anniScolastici.istitutoId, istituto.id), eq(anniScolastici.corrente, true)));
      return Boolean(annoEsistente);
    });

    if (giaSeminato) {
      console.log(`Istituto "${dati.slug}" già seminato, salto.`);
      continue;
    }

    await withTenant(db, istituto.id, async (tx) => {
      const [anno] = await tx
        .insert(anniScolastici)
        .values({
          istitutoId: istituto.id,
          codice: '2026/27',
          dataInizio: '2026-09-15',
          dataFine: '2027-06-15',
          corrente: true,
        })
        .returning();
      if (!anno) {
        throw new Error(`Anno scolastico non creato per "${dati.slug}".`);
      }

      const [plesso] = await tx
        .insert(plessi)
        .values({ istitutoId: istituto.id, nome: 'Sede centrale' })
        .returning();
      if (!plesso) {
        throw new Error(`Plesso non creato per "${dati.slug}".`);
      }

      const ambientiCreati = await tx
        .insert(ambienti)
        .values([
          {
            istitutoId: istituto.id,
            plessoId: plesso.id,
            tipo: 'laboratorio',
            nome: 'Laboratorio Informatica 1',
            codiceBreve: 'LAB1',
            qrToken: `${dati.slug}-lab1-${crypto.randomUUID()}`,
          },
          {
            istitutoId: istituto.id,
            plessoId: plesso.id,
            tipo: 'laboratorio',
            nome: 'Laboratorio Informatica 2',
            codiceBreve: 'LAB2',
            qrToken: `${dati.slug}-lab2-${crypto.randomUUID()}`,
          },
        ])
        .returning();

      const [admin, at] = await tx
        .insert(utenti)
        .values([
          {
            istitutoId: istituto.id,
            email: `admin@${dati.slug}.${baseDomain}`,
            nome: 'Admin',
            cognome: dati.slug,
            ruolo: 'admin',
            passwordHash: HASH_PASSWORD_DEMO,
          },
          {
            istitutoId: istituto.id,
            email: `at@${dati.slug}.${baseDomain}`,
            nome: 'Assistente',
            cognome: 'Tecnico',
            ruolo: 'at',
            passwordHash: HASH_PASSWORD_DEMO,
          },
        ])
        .returning();
      if (!admin || !at) {
        throw new Error(`Utenti non creati per "${dati.slug}".`);
      }

      if (ambientiCreati.length > 0) {
        await tx.insert(affidamentiAmbienti).values(
          ambientiCreati.map((ambiente) => ({
            istitutoId: istituto.id,
            utenteId: at.id,
            ambienteId: ambiente.id,
            annoScolasticoId: anno.id,
            dataInizio: '2026-09-15',
          })),
        );
      }

      await tx.insert(persone).values([
        {
          istitutoId: istituto.id,
          nome: 'Mario',
          cognome: 'Rossi',
          qualifica: 'docente',
          annoScolasticoId: anno.id,
        },
        {
          istitutoId: istituto.id,
          nome: 'Anna',
          cognome: 'Bianchi',
          qualifica: 'docente',
          annoScolasticoId: anno.id,
        },
      ]);
    });

    console.log(`Istituto "${dati.slug}" seminato.`);
  }
}

main().catch((errore: unknown) => {
  console.error(errore);
  process.exitCode = 1;
});
