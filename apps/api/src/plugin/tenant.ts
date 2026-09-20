import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { trovaIstitutoAttivoDaSlug, type Db } from '@gestilab/db';
import { ErroreDominio, slugValido } from '@gestilab/shared';

declare module 'fastify' {
  interface FastifyRequest {
    tenantId?: string;
  }
}

// docs/CLAUDE.md regola 2: il tenant si ricava dall'host, mai dal client
// senza rivalidazione. web (task 0.6) risolve lo slug dall'Host e lo
// inoltra come X-Tenant-Slug; questo plugin lo rivalida qui, allo stesso
// modo (stessa query condivisa in packages/db), invece di fidarsene.
// Decora `request.tenantId` solo dove serve: da registrare nei moduli che
// hanno bisogno del tenant, non globalmente (es. /api/v1/salute resta
// pubblica e non lo richiede).
export const pluginTenant = fp(async function pluginTenant(app: FastifyInstance, opts: { db: Db }) {
  app.decorateRequest('tenantId', undefined);

  app.addHook('onRequest', async (request: FastifyRequest) => {
    const slug = request.headers['x-tenant-slug'];

    if (typeof slug !== 'string' || slug === '') {
      throw new ErroreDominio('TENANT_MANCANTE', 'Header X-Tenant-Slug mancante.', 400);
    }

    if (!slugValido(slug)) {
      throw new ErroreDominio('TENANT_NON_TROVATO', 'Istituto non trovato.', 404);
    }

    const istituto = await trovaIstitutoAttivoDaSlug(opts.db, slug);
    if (!istituto) {
      throw new ErroreDominio('TENANT_NON_TROVATO', 'Istituto non trovato.', 404);
    }

    request.tenantId = istituto.id;
  });
});
