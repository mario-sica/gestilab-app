import { asc, eq, isNotNull } from 'drizzle-orm';
import { withTenant, type Db } from '@gestilab/db';
import { istituti, utenti } from '@gestilab/db/schema';
import { ErroreDominio, type NuovoInvitoUtente, type UtenteElenco } from '@gestilab/shared';

// Unico posto del modulo che parla con Drizzle (docs/04-convenzioni-codice.md
// § moduli). Ogni accesso a utenti passa da withTenant: RLS + app.tenant_id,
// mai un filtro istituto_id scritto a mano come unica difesa (regola 1).

export async function creaUtenteSenzaPassword(db: Db, tenantId: string, dati: NuovoInvitoUtente): Promise<{ id: string }> {
  try {
    return await withTenant(db, tenantId, async (tx) => {
      const [riga] = await tx
        .insert(utenti)
        .values({ istitutoId: tenantId, email: dati.email, nome: dati.nome, cognome: dati.cognome, ruolo: dati.ruolo })
        .returning({ id: utenti.id });
      return { id: riga!.id };
    });
  } catch (errore) {
    // 23505 = unique_violation: l'indice utenti_istituto_id_email_idx
    // (email unica per istituto). Un 409 esplicito invece del 500 generico:
    // l'Admin deve sapere che quella persona esiste già, non "riprova".
    if (eViolazioneUnicita(errore)) {
      throw new ErroreDominio('EMAIL_GIA_PRESENTE', 'Esiste già un utente con questa email.', 409);
    }
    throw errore;
  }
}

// drizzle-orm ≥ 0.45 incapsula l'errore del driver in DrizzleQueryError,
// con l'originale (postgres-js, che porta "code") in `cause`: si guarda
// prima lì, poi all'errore stesso per non dipendere dal wrapping.
function eViolazioneUnicita(errore: unknown): boolean {
  const candidati = [errore, errore instanceof Error ? errore.cause : undefined];
  return candidati.some((e) => typeof e === 'object' && e !== null && 'code' in e && e.code === '23505');
}

// istituti non ha RLS (è la tabella dei tenant stessi): lettura diretta per
// id, come trovaIstitutoAttivoDaSlug in packages/db.
export async function trovaIstituto(db: Db, id: string): Promise<{ slug: string; denominazione: string }> {
  const [riga] = await db.select({ slug: istituti.slug, denominazione: istituti.denominazione }).from(istituti).where(eq(istituti.id, id));
  if (!riga) {
    throw new ErroreDominio('TENANT_NON_TROVATO', 'Istituto non trovato.', 404);
  }
  return riga;
}

// Elenco completo, ordinato per cognome/nome: gli utenti di un istituto
// sono decine (admin, AT, supervisore), non migliaia — nessuna paginazione
// qui (docs/03-api.md: si definisce con la prima lista aperta, gli asset).
export async function elencaUtenti(db: Db, tenantId: string): Promise<UtenteElenco[]> {
  return withTenant(db, tenantId, async (tx) => {
    const righe = await tx
      .select({
        id: utenti.id,
        email: utenti.email,
        nome: utenti.nome,
        cognome: utenti.cognome,
        ruolo: utenti.ruolo,
        attivo: utenti.attivo,
        passwordImpostata: isNotNull(utenti.passwordHash),
        ultimoAccesso: utenti.ultimoAccesso,
      })
      .from(utenti)
      .orderBy(asc(utenti.cognome), asc(utenti.nome));
    return righe.map((r) => ({ ...r, passwordImpostata: Boolean(r.passwordImpostata), ultimoAccesso: r.ultimoAccesso?.toISOString() ?? null }));
  });
}
