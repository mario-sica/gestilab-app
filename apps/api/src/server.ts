import Fastify from 'fastify';
import { leggiEnv } from '@gestilab/shared';

import { rotteSalute } from './moduli/salute/rotte.js';

async function avvia(): Promise<void> {
  const env = leggiEnv();
  const app = Fastify({ logger: { level: env.LOG_LEVEL } });

  await app.register(rotteSalute);

  await app.listen({ port: env.API_PORT, host: env.API_HOST });
}

avvia().catch((errore: unknown) => {
  console.error(errore);
  process.exitCode = 1;
});
