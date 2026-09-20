import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { VERSIONE_API } from '@gestilab/shared';
import { z } from 'zod';

const schemaRisposta = z.object({ stato: z.literal('ok') });

export async function rotteSalute(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().get(
    `/api/${VERSIONE_API}/salute`,
    { schema: { response: { 200: schemaRisposta } } },
    async () => ({ stato: 'ok' as const }),
  );
}
