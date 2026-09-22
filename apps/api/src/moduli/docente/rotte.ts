import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { schemaPersonaRicerca } from '@gestilab/shared';
import { z } from 'zod';

import { ricercaPersone, type DipendenzeDocente } from './servizio.js';

const schemaQuery = z.object({
  // 2 caratteri minimo: sotto soglia la ricerca sarebbe larghissima
  // (l'intero elenco) su un endpoint pubblico — nessun vantaggio reale
  // per chi digita, solo più righe restituite a chiunque le chieda.
  query: z.string().trim().min(2).max(100),
});

// Pubblico (nessuna sessione: si usa DA una pagina di login, prima che una
// sessione esista) ma tenant-scoped — pluginTenant, registrato dal
// chiamante, non pluginSessione. Rate limit: quello globale di default
// (100/min, plugin/rate-limit.ts) basta per una ricerca in un elenco.
export async function rotteDocente(app: FastifyInstance, deps: DipendenzeDocente): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/persone',
    { schema: { querystring: schemaQuery, response: { 200: z.array(schemaPersonaRicerca) } } },
    async (richiesta) => ricercaPersone(deps, richiesta.tenantId!, richiesta.query.query),
  );
}
