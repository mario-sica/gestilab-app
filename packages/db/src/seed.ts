import { randomBytes } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { leggiEnv } from '@gestilab/shared';

import { creaClient } from './client.js';
import { withTenant } from './with-tenant.js';
import {
  ambienti,
  anniScolastici,
  affidamentiAmbienti,
  asset,
  istituti,
  persone,
  plessi,
  tipiAsset,
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

// Catalogo globale di sistema (docs/01-dominio.md — Gruppo B: tipi_asset
// con istituto_id NULL, uguale per ogni istituto). schema_attributi vuoto
// per ora: gli schemi JSON per categoria arrivano con un task che li usa
// davvero, non prima. Un rappresentante per categoria, non un catalogo
// esaustivo — basta a rendere il seed di asset demo realistico.
const CATALOGO_TIPI_ASSET = [
  { nome: 'PC desktop', categoria: 'informatica' },
  { nome: 'PC portatile', categoria: 'informatica' },
  { nome: 'Monitor', categoria: 'informatica' },
  { nome: 'Proiettore', categoria: 'audiovideo' },
  { nome: 'LIM', categoria: 'audiovideo' },
  { nome: 'Stampante', categoria: 'stampa' },
  { nome: 'Switch di rete', categoria: 'rete' },
  { nome: 'Access point', categoria: 'rete' },
  { nome: 'Microscopio', categoria: 'scientifico' },
  { nome: 'Trapano', categoria: 'officina' },
  { nome: 'Armadio', categoria: 'arredo' },
  { nome: 'Sedia', categoria: 'arredo' },
  { nome: 'Materiale vario', categoria: 'altro' },
] as const;

// Mix di asset per un laboratorio informatica demo: ciclato per generare i
// 30 asset di ogni istituto (task 2.1, "Fatto quando: ... 30 asset demo").
const MIX_ASSET_LABORATORIO = [
  { tipo: 'PC desktop', marca: 'Dell', modello: 'OptiPlex 3000' },
  { tipo: 'Monitor', marca: 'Dell', modello: 'P2422H' },
  { tipo: 'PC desktop', marca: 'Dell', modello: 'OptiPlex 3000' },
  { tipo: 'Monitor', marca: 'Dell', modello: 'P2422H' },
  { tipo: 'Proiettore', marca: 'Epson', modello: 'EB-X49' },
  { tipo: 'Switch di rete', marca: 'TP-Link', modello: 'TL-SG1016' },
  { tipo: 'Stampante', marca: 'HP', modello: 'LaserJet Pro M404' },
] as const;

// Caratteri senza ambiguità (no O/0, I/1), come da docs/01-dominio.md:
// generazione minima per il seed, non l'algoritmo definitivo (task 2.3).
const ALFABETO_CODICE_BREVE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generaCodiceBreve(): string {
  return Array.from({ length: 6 }, () => ALFABETO_CODICE_BREVE[randomBytes(1)[0]! % ALFABETO_CODICE_BREVE.length]).join('');
}

function generaQrToken(): string {
  return randomBytes(16).toString('base64url');
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
    const tipiPerNome = await seminaCatalogoTipiAsset(db);
    await seminaTutti(db, env.BASE_DOMAIN, tipiPerNome);
  } finally {
    await db.$client.end();
  }
}

// Catalogo globale (istituto_id NULL): fuori da withTenant, come istituti,
// perché non appartiene a un tenant — la policy RLS di tipi_asset ammette
// esplicitamente le righe globali indipendentemente dal contesto (vedi
// schema/tipi-asset.ts). Idempotente: se il catalogo esiste già (qualunque
// riga globale), non lo tocca.
async function seminaCatalogoTipiAsset(db: ReturnType<typeof creaClient>): Promise<Map<string, string>> {
  const esistenti = await db.select({ id: tipiAsset.id, nome: tipiAsset.nome }).from(tipiAsset).where(isNull(tipiAsset.istitutoId));
  if (esistenti.length > 0) {
    console.log('Catalogo globale tipi_asset già seminato, salto.');
    return new Map(esistenti.map((riga) => [riga.nome, riga.id]));
  }

  const creati = await db
    .insert(tipiAsset)
    .values(CATALOGO_TIPI_ASSET.map((tipo) => ({ nome: tipo.nome, categoria: tipo.categoria, schemaAttributi: {} })))
    .returning({ id: tipiAsset.id, nome: tipiAsset.nome });
  console.log(`Catalogo globale tipi_asset seminato (${creati.length} tipi).`);
  return new Map(creati.map((riga) => [riga.nome, riga.id]));
}

async function seminaTutti(db: ReturnType<typeof creaClient>, baseDomain: string, tipiPerNome: Map<string, string>): Promise<void> {
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

      // 30 asset demo (task 2.1, "Fatto quando"), 15 per laboratorio,
      // ciclando MIX_ASSET_LABORATORIO. codice_breve/qr_token con la
      // generazione minima del seed (vedi sopra), non l'algoritmo
      // definitivo di task 2.3.
      const ASSET_PER_AMBIENTE = 15;
      const codiciBreviUsati = new Set<string>();
      const assetDaCreare = ambientiCreati.flatMap((ambiente) =>
        Array.from({ length: ASSET_PER_AMBIENTE }, (_, indice) => {
          const mix = MIX_ASSET_LABORATORIO[indice % MIX_ASSET_LABORATORIO.length]!;
          const tipoAssetId = tipiPerNome.get(mix.tipo);
          if (!tipoAssetId) {
            throw new Error(`Tipo asset "${mix.tipo}" non trovato nel catalogo globale.`);
          }
          let codiceBreve = generaCodiceBreve();
          while (codiciBreviUsati.has(codiceBreve)) {
            codiceBreve = generaCodiceBreve();
          }
          codiciBreviUsati.add(codiceBreve);
          return {
            istitutoId: istituto.id,
            ambienteId: ambiente.id,
            tipoAssetId,
            etichetta: `${ambiente.codiceBreve}-${String(indice + 1).padStart(2, '0')}`,
            marca: mix.marca,
            modello: mix.modello,
            proprieta: 'istituto' as const,
            stato: 'attivo' as const,
            codiceBreve,
            qrToken: generaQrToken(),
          };
        }),
      );
      if (assetDaCreare.length > 0) {
        await tx.insert(asset).values(assetDaCreare);
      }
    });

    console.log(`Istituto "${dati.slug}" seminato.`);
  }
}

main().catch((errore: unknown) => {
  console.error(errore);
  process.exitCode = 1;
});
