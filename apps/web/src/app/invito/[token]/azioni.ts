'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { eAreaSessione, leggiEnv } from '@gestilab/shared';

export interface StatoInvito {
  errore?: string;
}

// Pagina pubblica: nessuna sessione, l'unico "segreto" è il token nel link
// (docs/06 § 2.1: opaco, monouso, con hash lato auth-service). Come login
// ed esci: Server Action → chiamata diretta a gestilab-auth-service, mai
// dal browser; niente .bind (vedi login/azioni.ts), il token arriva da un
// campo hidden del form e viene comunque rivalidato dall'auth-service.
//
// La conferma della password si controlla qui, non nel browser: un form
// senza JS deve dare lo stesso esito. La lunghezza minima la impone
// l'auth-service (400 PASSWORD_TROPPO_CORTA) — una sola fonte per la
// regola dei 12 caratteri.
export async function accettaInvito(_statoPrecedente: StatoInvito, formData: FormData): Promise<StatoInvito> {
  const token = formData.get('token');
  const password = formData.get('password');
  const conferma = formData.get('conferma');
  if (typeof token !== 'string' || !token) {
    return { errore: 'Invito non valido.' };
  }
  if (typeof password !== 'string' || !password || typeof conferma !== 'string') {
    return { errore: 'Inserisci la password due volte.' };
  }
  if (password !== conferma) {
    return { errore: 'Le due password non coincidono.' };
  }

  const tenantId = (await headers()).get('x-tenant-id');
  if (!tenantId) {
    return { errore: 'Istituto non riconosciuto.' };
  }

  const env = leggiEnv();
  let risposta: Response;
  try {
    risposta = await fetch(`${env.AUTH_SERVICE_URL}/inviti/accetta`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ istitutoId: tenantId, token, password }),
    });
  } catch {
    return { errore: 'Si è verificato un errore. Riprova più tardi.' };
  }

  if (!risposta.ok) {
    const corpo = (await risposta.json().catch(() => null)) as { errore?: { codice?: string; messaggio?: string } } | null;
    switch (corpo?.errore?.codice) {
      case 'PASSWORD_TROPPO_CORTA':
        return { errore: corpo.errore.messaggio ?? 'Password troppo corta.' };
      case 'INVITO_NON_VALIDO':
        return { errore: 'Questo invito non è più valido: chiedi un nuovo invito al tuo amministratore.' };
      default:
        return { errore: 'Si è verificato un errore. Riprova più tardi.' };
    }
  }

  const { area } = (await risposta.json()) as { area: string };
  redirect(eAreaSessione(area) ? `/${area}/login?invito=ok` : '/');
}
