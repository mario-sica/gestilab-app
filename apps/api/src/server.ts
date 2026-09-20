import { leggiEnv } from '@gestilab/shared';

import { costruisciApp } from './app.js';

async function avvia(): Promise<void> {
  const env = leggiEnv();
  const app = await costruisciApp(env);

  await app.listen({ port: env.API_PORT, host: env.API_HOST });
}

avvia().catch((errore: unknown) => {
  console.error(errore);
  process.exitCode = 1;
});
