import { and, eq, ilike, sql } from 'drizzle-orm';
import { withTenant, type Db } from '@gestilab/db';
import { anniScolastici, persone } from '@gestilab/db/schema';
import type { PersonaRicerca } from '@gestilab/shared';

const RISULTATI_MASSIMI = 10;

/**
 * Autocomplete del login docente (task 1.5): persone attive dell'anno
 * scolastico corrente il cui nome+cognome contiene "query" (usa l'indice
 * trigram di persone.ts, docs/01-dominio.md). Nessuna paginazione: max 10
 * risultati bastano a un elenco scolastico (chi cerca affina la query).
 *
 * L'anno corrente si cerca dentro la stessa withTenant della query
 * principale: entrambe le tabelle sono tenant-scoped, un solo contesto RLS
 * per entrambe.
 */
export async function cercaPersone(db: Db, tenantId: string, query: string): Promise<PersonaRicerca[]> {
  return withTenant(db, tenantId, async (tx) => {
    const [anno] = await tx
      .select({ id: anniScolastici.id })
      .from(anniScolastici)
      .where(and(eq(anniScolastici.istitutoId, tenantId), eq(anniScolastici.corrente, true)));
    if (!anno) {
      return [];
    }

    return tx
      .select({ id: persone.id, nome: persone.nome, cognome: persone.cognome, qualifica: persone.qualifica })
      .from(persone)
      .where(
        and(
          eq(persone.istitutoId, tenantId),
          eq(persone.annoScolasticoId, anno.id),
          eq(persone.attivo, true),
          sql`${persone.eliminatoIl} IS NULL`,
          ilike(sql`${persone.nome} || ' ' || ${persone.cognome}`, `%${query}%`),
        ),
      )
      .orderBy(persone.cognome, persone.nome)
      .limit(RISULTATI_MASSIMI);
  });
}
