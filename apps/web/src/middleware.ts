import { NextResponse, type NextRequest } from 'next/server';

import { eSlugRiservato, estraiSlug, risolviTenant, validoPerLookup } from './lib/tenant.js';

// Serve la connessione a Postgres (net Node.js), non disponibile nel
// runtime edge di default per il middleware.
export const config = {
  runtime: 'nodejs',
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const host = request.headers.get('host') ?? '';
  const slug = estraiSlug(host);

  // Nessun sottodominio (dominio di base da solo) o slug riservato
  // (www, app, console, api, ...): non è un tentativo di tenant, passa.
  if (!slug || eSlugRiservato(slug)) {
    return NextResponse.next();
  }

  if (!validoPerLookup(slug)) {
    return new NextResponse(null, { status: 404 });
  }

  const tenant = await risolviTenant(slug);
  if (!tenant) {
    return new NextResponse(null, { status: 404 });
  }

  const headers = new Headers(request.headers);
  headers.set('x-tenant-slug', slug);
  headers.set('x-tenant-id', tenant.id);
  return NextResponse.next({ request: { headers } });
}
