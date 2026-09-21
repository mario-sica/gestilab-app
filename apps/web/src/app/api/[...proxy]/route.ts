import type { NextRequest } from 'next/server';
import { leggiEnv } from '@gestilab/shared';

// Proxy verso apps/api per i client component (TanStack Query): il
// browser chiama /api/... sulla propria origine — stesso dominio del
// tenant, quindi il cookie di sessione viaggia da solo — e questo handler
// inoltra a API_URL (rete interna) con X-Tenant-Slug impostato dal
// middleware, che apps/api rivalida. Nessuna logica qui: è un tubo.
// docs/04-convenzioni-codice.md: "api/[...proxy]/ proxy verso api con
// tenant risolto".
//
// Header inoltrati per nome, non tutti: host/connection/content-length
// vanno ricalcolati da fetch, e nulla di ciò che il browser manda deve
// poter sovrascrivere X-Tenant-Slug (regola 2 di docs/CLAUDE.md).
const INTESTAZIONI_INOLTRATE = ['accept', 'content-type', 'cookie', 'accept-language'] as const;

async function inoltra(richiesta: NextRequest, contesto: { params: Promise<{ proxy: string[] }> }): Promise<Response> {
  const { proxy } = await contesto.params;
  const env = leggiEnv();
  const destinazione = new URL(`/api/${proxy.join('/')}`, env.API_URL);
  destinazione.search = richiesta.nextUrl.search;

  const intestazioni = new Headers();
  for (const nome of INTESTAZIONI_INOLTRATE) {
    const valore = richiesta.headers.get(nome);
    if (valore) {
      intestazioni.set(nome, valore);
    }
  }
  const slug = richiesta.headers.get('x-tenant-slug');
  if (slug) {
    intestazioni.set('x-tenant-slug', slug);
  }

  const conCorpo = richiesta.method !== 'GET' && richiesta.method !== 'HEAD';
  const init: RequestInit = { method: richiesta.method, headers: intestazioni, cache: 'no-store', redirect: 'manual' };
  if (conCorpo) {
    // exactOptionalPropertyTypes: "body: undefined" non è ammesso, il campo
    // va aggiunto solo quando c'è.
    init.body = await richiesta.arrayBuffer();
  }
  const risposta = await fetch(destinazione, init);

  const intestazioniRisposta = new Headers();
  for (const nome of ['content-type', 'cache-control', 'x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset']) {
    const valore = risposta.headers.get(nome);
    if (valore) {
      intestazioniRisposta.set(nome, valore);
    }
  }
  return new Response(risposta.body, { status: risposta.status, headers: intestazioniRisposta });
}

export const GET = inoltra;
export const POST = inoltra;
export const PUT = inoltra;
export const PATCH = inoltra;
export const DELETE = inoltra;
