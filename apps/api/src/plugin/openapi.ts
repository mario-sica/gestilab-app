import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';

// Spec generato dagli schemi Zod delle rotte (docs/CLAUDE.md regola 8: Zod
// è l'unica fonte di verità per i contratti, niente schema duplicato).
export async function pluginOpenapi(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      info: { title: 'GestiLab API', version: '1.0.0' },
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUi, {
    routePrefix: '/documentazione',
  });
}
