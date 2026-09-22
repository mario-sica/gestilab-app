import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { creaClient } from '@gestilab/db';
import { VERSIONE_API, type Env } from '@gestilab/shared';

import { rotteAdminImpostazioni } from './moduli/admin-impostazioni/rotte.js';
import { rotteAdminUtenti } from './moduli/admin-utenti/rotte.js';
import { rotteDocente } from './moduli/docente/rotte.js';
import { rotteSalute } from './moduli/salute/rotte.js';
import { pluginCodaEmail } from './plugin/coda-email.js';
import { pluginErrori } from './plugin/errori.js';
import { opzioniLogger } from './plugin/logger.js';
import { pluginOpenapi } from './plugin/openapi.js';
import { pluginRateLimit } from './plugin/rate-limit.js';
import { pluginSessione } from './plugin/sessione.js';
import { pluginTenant } from './plugin/tenant.js';
import { creaClientAuthService } from './servizi/auth-service.js';

export type EnvApp = Pick<
  Env,
  'LOG_LEVEL' | 'REDIS_URL' | 'DATABASE_URL' | 'AUTH_SERVICE_URL' | 'BASE_DOMAIN' | 'WEB_PROTOCOLLO' | 'WEB_PORTA'
>;

// Separato da server.ts (che aggiunge solo .listen()) per poterlo testare
// con fastify.inject() senza aprire una porta reale.
export async function costruisciApp(env: EnvApp) {
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

  // Connessione applicativa (gestilab_app, mai owner) e produttore della
  // coda email: condivisi dai moduli di dominio, non da /salute.
  const db = creaClient(env.DATABASE_URL);
  await app.register(pluginCodaEmail, { redisUrl: env.REDIS_URL });
  const authService = creaClientAuthService(env.AUTH_SERVICE_URL);

  // Area admin: tenant dall'header rivalidato + sessione dal cookie
  // gl_s_adm, entrambi solo in questo contesto (fastify incapsula i plugin
  // non-fp registrati dentro un register): /salute e le future rotte
  // pubbliche (/q/{token}) non li vedono.
  await app.register(
    async (admin) => {
      await admin.register(pluginTenant, { db });
      await admin.register(pluginSessione, { db, area: 'admin' });
      await admin.register(rotteAdminUtenti, { db, env, authService, codaEmail: admin.codaEmail });
      await admin.register(rotteAdminImpostazioni, { db, authService });
    },
    { prefix: `/api/${VERSIONE_API}/admin` },
  );

  // Area docente: solo tenant dall'header rivalidato, NESSUNA sessione —
  // usata dalla pagina di login prima che una sessione esista (task 1.5).
  // Un contesto a parte, non dentro quello admin: qui pluginSessione non è
  // mai registrato, quindi request.utente non esiste per queste rotte, a
  // differenza di /admin/*.
  await app.register(
    async (docente) => {
      await docente.register(pluginTenant, { db });
      await docente.register(rotteDocente, { db });
    },
    { prefix: `/api/${VERSIONE_API}/docente` },
  );

  return app;
}
