import 'server-only';
import { cookies, headers } from 'next/headers';
import { COOKIE_PER_AREA, ErroreDominio, leggiEnv, type AreaSessione } from '@gestilab/shared';

// Client verso apps/api per Server Component e Server Action (URL interno
// API_URL). Inoltra solo il cookie dell'area e X-Tenant-Slug (che apps/api
// rivalida, docs/03-api.md § Contesto tenant). Un errore { errore } diventa
// un ErroreDominio con lo stesso codice: le pagine ragionano su codici,
// mai su stringhe (docs/04).
//
// Il proxy app/api/[...proxy] fa la stessa cosa per i client component:
// stessa base, stessi header — due porte d'ingresso, un solo backend.
export async function chiamaApi<T>(area: AreaSessione, percorso: string, init: RequestInit = {}): Promise<T> {
  const env = leggiEnv();
  const token = (await cookies()).get(COOKIE_PER_AREA[area])?.value;
  const slug = (await headers()).get('x-tenant-slug');

  const intestazioni = new Headers(init.headers);
  intestazioni.set('accept', 'application/json');
  if (slug) {
    intestazioni.set('x-tenant-slug', slug);
  }
  if (token) {
    intestazioni.set('cookie', `${COOKIE_PER_AREA[area]}=${token}`);
  }
  if (init.body !== undefined && !intestazioni.has('content-type')) {
    intestazioni.set('content-type', 'application/json');
  }

  const risposta = await fetch(`${env.API_URL}${percorso}`, { ...init, headers: intestazioni, cache: 'no-store' });
  if (!risposta.ok) {
    throw await erroreDaRisposta(risposta);
  }
  if (risposta.status === 204) {
    return undefined as T;
  }
  return (await risposta.json()) as T;
}

export async function erroreDaRisposta(risposta: Response): Promise<ErroreDominio> {
  const corpo = (await risposta.json().catch(() => null)) as {
    errore?: { codice?: string; messaggio?: string; dettagli?: Record<string, unknown> };
  } | null;
  return new ErroreDominio(
    corpo?.errore?.codice ?? 'ERRORE_INTERNO',
    corpo?.errore?.messaggio ?? 'Si è verificato un errore.',
    risposta.status,
    corpo?.errore?.dettagli,
  );
}
