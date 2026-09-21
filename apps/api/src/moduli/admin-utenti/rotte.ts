import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { schemaNuovoInvitoUtente } from '@gestilab/shared';
import { z } from 'zod';

import { richiediRuolo } from '../../plugin/sessione.js';
import { invitaUtente, type DipendenzeAdminUtenti } from './servizio.js';

const schemaRispostaInvito = z.object({
  utenteId: z.string().uuid(),
  scadeIl: z.string(),
});

// Rotte dell'area admin sugli utenti. Prefisso (/api/v1/admin) e plugin
// tenant + sessione(admin) sono registrati dal contesto in app.ts: qui ogni
// rotta dichiara solo il ruolo (docs/06 § 2.3: "ogni endpoint dichiara
// ruolo e ambito"). Il supervisore entra nell'area admin ma in sola
// lettura: invitare è scrittura, quindi solo 'admin'.
export async function rotteAdminUtenti(app: FastifyInstance, deps: DipendenzeAdminUtenti): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/utenti/inviti',
    {
      preHandler: richiediRuolo(['admin']),
      schema: { body: schemaNuovoInvitoUtente, response: { 201: schemaRispostaInvito } },
    },
    async (richiesta, risposta) => {
      const esito = await invitaUtente(deps, richiesta.tenantId!, richiesta.body);
      return risposta.code(201).send({ utenteId: esito.utenteId, scadeIl: esito.scadeIl.toISOString() });
    },
  );
}
