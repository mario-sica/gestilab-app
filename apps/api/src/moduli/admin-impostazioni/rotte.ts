import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { schemaImpostazioni, schemaPinRigenerato } from '@gestilab/shared';

import { richiediRuolo } from '../../plugin/sessione.js';
import { impostazioni, rigeneraPinDocente, type DipendenzeAdminImpostazioni } from './servizio.js';

// /api/v1/admin/impostazioni: stato delle impostazioni dell'istituto e
// azioni su di esse. Lettura anche per il supervisore; la rigenerazione
// del PIN è scrittura (e butta fuori tutti i docenti): solo admin.
export async function rotteAdminImpostazioni(app: FastifyInstance, deps: DipendenzeAdminImpostazioni): Promise<void> {
  const tipizzata = app.withTypeProvider<ZodTypeProvider>();

  tipizzata.get(
    '/impostazioni',
    { preHandler: richiediRuolo(['admin', 'supervisore']), schema: { response: { 200: schemaImpostazioni } } },
    async (richiesta) => impostazioni(deps, richiesta.tenantId!),
  );

  tipizzata.post(
    '/impostazioni/pin-docente',
    { preHandler: richiediRuolo(['admin']), schema: { response: { 200: schemaPinRigenerato } } },
    async (richiesta) => rigeneraPinDocente(deps, richiesta.tenantId!),
  );
}
