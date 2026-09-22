import { eq } from 'drizzle-orm';
import type { Db } from '@gestilab/db';
import { istituti } from '@gestilab/db/schema';
import { ErroreDominio, type AggiornaImpostazioni, type Impostazioni } from '@gestilab/shared';

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

// Modalità di accesso docente (task 1.5): dominio dell'istituto, non una
// credenziale — nessuna chiamata a gestilab-auth-service qui, a differenza
// del PIN. Scrittura diretta, come la lettura sopra.
export async function aggiornaImpostazioni(db: Db, tenantId: string, dati: AggiornaImpostazioni): Promise<Impostazioni> {
  const [riga] = await db
    .update(istituti)
    .set({ modalitaAccessoDocente: dati.modalitaAccessoDocente, updatedAt: new Date() })
    .where(eq(istituti.id, tenantId))
    .returning({ modalitaAccessoDocente: istituti.modalitaAccessoDocente, pinIstitutoHash: istituti.pinIstitutoHash });
  if (!riga) {
    throw new ErroreDominio('TENANT_NON_TROVATO', 'Istituto non trovato.', 404);
  }
  return { modalitaAccessoDocente: riga.modalitaAccessoDocente, pinImpostato: riga.pinIstitutoHash !== null };
}
