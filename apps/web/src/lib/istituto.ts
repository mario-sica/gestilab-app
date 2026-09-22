import { istituti } from '@gestilab/db/schema';
import { eq } from 'drizzle-orm';
import type { ModalitaAccessoDocente } from '@gestilab/shared';

import { ottieniDb } from './db.js';

/**
 * Letta direttamente dal database, come la risoluzione del tenant
 * (lib/tenant.ts): serve alla pagina /docente/login, che non ha (e non
 * può avere) una sessione — istituti non ha RLS, nessun withTenant
 * necessario. Null se l'istituto non esiste più (non dovrebbe capitare:
 * il middleware ha già risolto tenantId da un istituto attivo).
 */
export async function leggiModalitaAccessoDocente(tenantId: string): Promise<ModalitaAccessoDocente | null> {
  const [riga] = await ottieniDb()
    .select({ modalitaAccessoDocente: istituti.modalitaAccessoDocente })
    .from(istituti)
    .where(eq(istituti.id, tenantId));
  return riga?.modalitaAccessoDocente ?? null;
}
