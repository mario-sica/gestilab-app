'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_PER_AREA, eAreaSessione, leggiEnv } from '@gestilab/shared';

export interface StatoLogin {
  errore?: string;
}

interface RispostaAccedi {
  token: string;
  scadeIl: string;
}

// gestilab-auth-service risponde solo alla rete Docker interna (nessuna
// label Traefik pubblica, vedi il suo README): questa Server Action è
// l'unico chiamante ammesso, perché è lei — rispondendo sul dominio reale
// del tenant — a poter impostare un cookie scoped a quel dominio. Nessuna
// chiamata di rete dal browser verso gestilab-auth-service.
//
// L'area arriva da un campo hidden del form, non da accedi.bind(null, area):
// con Next 15.5.25 un'azione bound passata a useActionState che RESTITUISCE
// uno stato (invece di fare redirect) manda il dev server in "heap out of
// memory" — riprodotto con un'azione che restituiva { errore } senza fare
// altro; senza bind funziona. Il campo è input del client, quindi viene
// rivalidato con eAreaSessione come qualunque altro.
export async function accedi(_statoPrecedente: StatoLogin, formData: FormData): Promise<StatoLogin> {
  const area = formData.get('area');
  if (typeof area !== 'string' || !eAreaSessione(area)) {
    return { errore: 'Area non valida.' };
  }

  const email = formData.get('email');
  const password = formData.get('password');
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return { errore: 'Inserisci email e password.' };
  }

  // Impostato dal middleware (task 0.6) dopo aver risolto il tenant
  // dall'host: se manca, l'host non corrisponde a nessun istituto attivo —
  // non dovrebbe poter capitare su questa pagina (stesso dominio), ma un
  // 404 lo escluderebbe comunque prima di arrivare qui.
  const tenantId = (await headers()).get('x-tenant-id');
  if (!tenantId) {
    return { errore: 'Istituto non riconosciuto.' };
  }

  const env = leggiEnv();
  const erroreServizio: StatoLogin = { errore: 'Si è verificato un errore. Riprova più tardi.' };
  let risposta: Response;
  try {
    risposta = await fetch(`${env.AUTH_SERVICE_URL}/accedi`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ istitutoId: tenantId, area, email, password }),
    });
  } catch {
    // Servizio irraggiungibile: fetch lancia, non risponde — senza il catch
    // la Server Action finirebbe in una pagina 500 (stesso caso di esci/).
    return erroreServizio;
  }

  if (!risposta.ok) {
    // Stesso messaggio generico per email inesistente, password sbagliata o
    // ruolo non valido per l'area (gestilab-auth-service li tratta già allo
    // stesso modo, per non rivelare quale caso si è verificato). Un errore
    // 5xx è distinto: non è un problema delle credenziali dell'utente.
    return risposta.status >= 500 ? erroreServizio : { errore: 'Email o password non corretti.' };
  }

  const { token, scadeIl } = (await risposta.json()) as RispostaAccedi;

  (await cookies()).set(COOKIE_PER_AREA[area], token, {
    httpOnly: true,
    // http:// in sviluppo locale ("localhost"): un cookie "secure" non
    // verrebbe mai inviato dal browser. local-prod e prod sono sempre
    // https (Traefik), dove "secure" è invece d'obbligo.
    secure: env.BASE_DOMAIN !== 'localhost',
    sameSite: 'lax',
    path: '/',
    expires: new Date(scadeIl),
  });

  // Nessuna dashboard ancora (fuori scope di questo task): unica
  // destinazione sensata finché non esiste.
  redirect('/');
}
