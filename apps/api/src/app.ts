import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import type { Env } from '@gestilab/shared';

import { rotteSalute } from './moduli/salute/rotte.js';
import { pluginErrori } from './plugin/errori.js';
import { opzioniLogger } from './plugin/logger.js';
import { pluginOpenapi } from './plugin/openapi.js';
import { pluginRateLimit } from './plugin/rate-limit.js';

// Separato da server.ts (che aggiunge solo .listen()) per poterlo testare
// con fastify.inject() senza aprire una porta reale.
//
// packages/db non è ancora collegato qui: nessun modulo di dominio esiste
// ancora oltre /api/v1/salute (pubblica, senza tenant). pluginTenant
// (plugin/tenant.ts) è pronto e testato, e verrà registrato dal primo
// modulo reale che lo richiede — non globalmente, perché salute non deve
// richiedere un tenant.
export async function costruisciApp(env: Pick<Env, 'LOG_LEVEL' | 'REDIS_URL'>) {
  const app = Fastify({ logger: opzioniLogger(env.LOG_LEVEL) }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  pluginErrori(app);
  // Nessun secret: il cookie contiene solo il token opaco, la cui validità
  // si verifica con un lookup nella tabella sessioni (l'hash), non con una
  // firma — @fastify/cookie qui serve solo a leggerlo (request.cookies).
  await app.register(cookie);
  await pluginRateLimit(app, env.REDIS_URL);
  await pluginOpenapi(app);

  await app.register(rotteSalute);

  return app;
}
