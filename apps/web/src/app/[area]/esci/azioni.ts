'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_PER_AREA, eAreaSessione, leggiEnv } from '@gestilab/shared';

export interface StatoEsci {
  errore?: string;
}

// Logout (task 1.2), speculare a login/azioni.ts: Server Action, chiamata
// diretta a gestilab-auth-service (POST /esci) dalla rete interna. Sempre
// via <form> POST, mai un link GET: un GET /esci sarebbe un logout
// innescabile da qualunque pagina terza con un <img src>.
//
// Ordine deliberato: prima la revoca sul server, poi la cancellazione del
// cookie — e solo se la revoca è riuscita. Cancellare il cookie con la
// sessione ancora viva darebbe all'utente l'impressione di essere uscito
// mentre il token resta valido fino a scadenza (fino a 30 giorni per il
// tecnico): un errore visibile è preferibile a una falsa sicurezza.
//
// L'area arriva da un campo hidden, non da esci.bind(null, area): stesso
// motivo spiegato in login/azioni.ts (azione bound + stato restituito →
// heap out of memory del dev server con Next 15.5.25). Rivalidata.
export async function esci(_statoPrecedente: StatoEsci, formData: FormData): Promise<StatoEsci> {
  const area = formData.get('area');
  if (typeof area !== 'string' || !eAreaSessione(area)) {
    return { errore: 'Area non valida.' };
  }

  const nomeCookie = COOKIE_PER_AREA[area];
  const cookieStore = await cookies();
  const token = cookieStore.get(nomeCookie)?.value;

  // Nessun cookie: non c'è niente da revocare, l'utente è già fuori.
  if (!token) {
    redirect(`/${area}/login`);
  }

  const tenantId = (await headers()).get('x-tenant-id');
  if (!tenantId) {
    return { errore: 'Istituto non riconosciuto.' };
  }

  const env = leggiEnv();
  const erroreServizio: StatoEsci = { errore: 'Non è stato possibile uscire. Riprova più tardi.' };
  let risposta: Response;
  try {
    risposta = await fetch(`${env.AUTH_SERVICE_URL}/esci`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ istitutoId: tenantId, token }),
    });
  } catch {
    // Servizio irraggiungibile (container fermo, rete): fetch lancia invece
    // di rispondere. Senza questo catch la Server Action finirebbe in una
    // pagina 500 — trovato provando davvero il logout con "auth" fermo.
    return erroreServizio;
  }

  // /esci è idempotente (204 anche per un token già revocato): qualunque
  // altro esito è un problema del servizio, non dell'utente.
  if (!risposta.ok) {
    return erroreServizio;
  }

  cookieStore.delete(nomeCookie);
  redirect(`/${area}/login`);
}
