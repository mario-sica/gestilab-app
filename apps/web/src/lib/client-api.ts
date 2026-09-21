'use client';

import { ErroreDominio } from '@gestilab/shared';

// Lato browser: chiama il proxy /api/... (stessa origine, cookie automatico)
// e traduce { errore } in ErroreDominio, come lib/api.ts lato server. Usato
// dalle query e mutation di TanStack Query nei client component.
export async function chiamaApiClient<T>(percorso: string, init: RequestInit = {}): Promise<T> {
  const intestazioni = new Headers(init.headers);
  intestazioni.set('accept', 'application/json');
  if (init.body !== undefined && !intestazioni.has('content-type')) {
    intestazioni.set('content-type', 'application/json');
  }
  const risposta = await fetch(percorso, { ...init, headers: intestazioni, credentials: 'same-origin' });
  if (!risposta.ok) {
    const corpo = (await risposta.json().catch(() => null)) as {
      errore?: { codice?: string; messaggio?: string; dettagli?: Record<string, unknown> };
    } | null;
    throw new ErroreDominio(
      corpo?.errore?.codice ?? 'ERRORE_INTERNO',
      corpo?.errore?.messaggio ?? 'Si è verificato un errore.',
      risposta.status,
      corpo?.errore?.dettagli,
    );
  }
  if (risposta.status === 204) {
    return undefined as T;
  }
  return (await risposta.json()) as T;
}
