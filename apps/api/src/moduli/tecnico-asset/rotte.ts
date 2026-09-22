import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { schemaAsset, schemaListaAsset, schemaListaAssetQuery, schemaModificaAsset, schemaNuovoAsset } from '@gestilab/shared';
import { z } from 'zod';

import { richiediRuolo } from '../../plugin/sessione.js';
import { creaAssetTecnico, eliminaAssetTecnico, elencaAssetTecnico, modificaAssetTecnico, trovaAssetTecnico, type DipendenzeTecnicoAsset } from './servizio.js';

const schemaParametroId = z.object({ id: z.string().uuid() });

// Rotte dell'area tecnico sugli asset (task 2.2). Prefisso (/api/v1/tecnico)
// e plugin tenant + sessione(tecnico) sono registrati dal contesto in
// app.ts: qui ogni rotta dichiara solo il ruolo (docs/06 § 2.3). Un solo
// ruolo possibile in quest'area ('at'), ma richiediRuolo resta esplicito
// per coerenza con ogni altro modulo — mai un endpoint senza dichiarazione.
export async function rotteTecnicoAsset(app: FastifyInstance, deps: DipendenzeTecnicoAsset): Promise<void> {
  const tipizzata = app.withTypeProvider<ZodTypeProvider>();

  tipizzata.get(
    '/asset',
    { preHandler: richiediRuolo(['at']), schema: { querystring: schemaListaAssetQuery, response: { 200: schemaListaAsset } } },
    async (richiesta) => elencaAssetTecnico(deps, richiesta.tenantId!, richiesta.utente!.id, richiesta.query),
  );

  tipizzata.get(
    '/asset/:id',
    { preHandler: richiediRuolo(['at']), schema: { params: schemaParametroId, response: { 200: schemaAsset } } },
    async (richiesta) => trovaAssetTecnico(deps, richiesta.tenantId!, richiesta.utente!.id, richiesta.params.id),
  );

  tipizzata.post(
    '/asset',
    { preHandler: richiediRuolo(['at']), schema: { body: schemaNuovoAsset, response: { 201: schemaAsset } } },
    async (richiesta, risposta) => {
      const creato = await creaAssetTecnico(deps, richiesta.tenantId!, richiesta.utente!.id, richiesta.body);
      return risposta.code(201).send(creato);
    },
  );

  tipizzata.patch(
    '/asset/:id',
    { preHandler: richiediRuolo(['at']), schema: { params: schemaParametroId, body: schemaModificaAsset, response: { 200: schemaAsset } } },
    async (richiesta) => modificaAssetTecnico(deps, richiesta.tenantId!, richiesta.utente!.id, richiesta.params.id, richiesta.body),
  );

  tipizzata.delete(
    '/asset/:id',
    { preHandler: richiediRuolo(['at']), schema: { params: schemaParametroId } },
    async (richiesta, risposta) => {
      await eliminaAssetTecnico(deps, richiesta.tenantId!, richiesta.utente!.id, richiesta.params.id);
      return risposta.code(204).send();
    },
  );
}
