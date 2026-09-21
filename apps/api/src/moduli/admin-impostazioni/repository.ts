import { eq } from 'drizzle-orm';
import type { Db } from '@gestilab/db';
import { istituti } from '@gestilab/db/schema';
import { ErroreDominio, type Impostazioni } from '@gestilab/shared';

// istituti non ha RLS (tabella dei tenant): lettura per id, come in
// admin-utenti/repository.ts. Mai pin_istituto_hash in uscita: solo il
// fatto che esista.
export async function leggiImpostazioni(db: Db, tenantId: string): Promise<Impostazioni> {
  const [riga] = await db
    .select({ modalitaAccessoDocente: istituti.modalitaAccessoDocente, pinIstitutoHash: istituti.pinIstitutoHash })
    .from(istituti)
    .where(eq(istituti.id, tenantId));
  if (!riga) {
    throw new ErroreDominio('TENANT_NON_TROVATO', 'Istituto non trovato.', 404);
  }
  return { modalitaAccessoDocente: riga.modalitaAccessoDocente, pinImpostato: riga.pinIstitutoHash !== null };
}
