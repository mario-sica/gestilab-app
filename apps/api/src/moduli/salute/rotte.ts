import type { FastifyInstance } from 'fastify';

export async function rotteSalute(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/salute', async () => ({ stato: 'ok' }));
}
