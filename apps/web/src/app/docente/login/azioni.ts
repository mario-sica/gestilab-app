'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_PER_AREA, leggiEnv, schemaAccessoDocente } from '@gestilab/shared';

export interface StatoAccessoDocente {
  errore?: string;
}

interface RispostaAccessoDocente {
  token: string;
  scadeIl: string;
}

// Speculare a [area]/login/azioni.ts, ma con lo schema condiviso
// schemaAccessoDocente (personaId + pin) invece di email+password — chiama
// direttamente gestilab-auth-service, mai apps/api: la stessa ragione del
// login admin/tecnico (solo chi risponde sul dominio reale del tenant può
// impostare il cookie; nessun segreto transita da un sistema in più).
export async function accediDocente(_statoPrecedente: StatoAccessoDocente, formData: FormData): Promise<StatoAccessoDocente> {
  const validazione = schemaAccessoDocente.safeParse({ personaId: formData.get('personaId'), pin: formData.get('pin') });
  if (!validazione.success) {
    return { errore: validazione.error.issues[0]?.message ?? 'Dati non validi.' };
  }

  const tenantId = (await headers()).get('x-tenant-id');
  if (!tenantId) {
    return { errore: 'Istituto non riconosciuto.' };
  }

  const env = leggiEnv();
  const erroreServizio: StatoAccessoDocente = { errore: 'Si è verificato un errore. Riprova più tardi.' };
  let risposta: Response;
  try {
    risposta = await fetch(`${env.AUTH_SERVICE_URL}/docente/accedi`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ istitutoId: tenantId, ...validazione.data }),
    });
  } catch {
    return erroreServizio;
  }

  if (!risposta.ok) {
    // Stesso messaggio generico per persona sbagliata, PIN sbagliato o
    // modalità d'istituto non a PIN (gestilab-auth-service li tratta già
    // allo stesso modo). 429 = rate limit sulla coppia (persona, IP): vedi
    // il commento nel login admin/tecnico sullo stesso caso.
    if (risposta.status === 429) {
      return { errore: 'Troppi tentativi: aspetta un minuto e riprova.' };
    }
    return risposta.status >= 500 ? erroreServizio : { errore: 'PIN non corretto.' };
  }

  const { token, scadeIl } = (await risposta.json()) as RispostaAccessoDocente;

  (await cookies()).set(COOKIE_PER_AREA.docente, token, {
    httpOnly: true,
    secure: env.BASE_DOMAIN !== 'localhost',
    sameSite: 'lax',
    path: '/',
    expires: new Date(scadeIl),
  });

  redirect('/docente');
}
