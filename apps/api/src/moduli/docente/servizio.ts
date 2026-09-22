import type { Db } from '@gestilab/db';
import type { PersonaRicerca } from '@gestilab/shared';
import { istituti } from '@gestilab/db/schema';
import { eq } from 'drizzle-orm';

import { cercaPersone } from './repository.js';

export interface DipendenzeDocente {
  db: Db;
}

const MODALITA_A_PIN = ['pin_istituto', 'pin_personale'];

/**
 * L'autocomplete risponde solo se l'istituto è davvero configurato per un
 * accesso docente a PIN — con "solo_qr" o "sso" un elenco di nomi
 * pubblico non servirebbe a nulla (nessun login possibile) e sarebbe
 * superficie esposta senza motivo (docs/CLAUDE.md § superficie pubblica).
 * Nessun errore: una lista vuota, come una ricerca senza risultati.
 */
export async function ricercaPersone(deps: DipendenzeDocente, tenantId: string, query: string): Promise<PersonaRicerca[]> {
  const [istituto] = await deps.db
    .select({ modalitaAccessoDocente: istituti.modalitaAccessoDocente, stato: istituti.stato })
    .from(istituti)
    .where(eq(istituti.id, tenantId));

  if (!istituto || istituto.stato !== 'attivo' || !MODALITA_A_PIN.includes(istituto.modalitaAccessoDocente)) {
    return [];
  }

  return cercaPersone(deps.db, tenantId, query);
}
