import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import { ErroreDominio } from '@gestilab/shared';
import { Redis } from 'ioredis';

// Store Redis, non in-memory: redis è già nello stack (per BullMQ, task
// futuri) e un limite in-memory non regge quando l'API girerà su più
// repliche. Soglia globale prudente; endpoint sensibili (es. /q/{token},
// docs/06-sicurezza-gdpr.md § 2.5) avranno un limite più stretto quando
// verranno creati, sovrascrivendo questo default per-rotta.
//
// errorResponseBuilder: @fastify/rate-limit fa `throw` sul suo valore di
// ritorno (non lo invia direttamente) — un oggetto semplice senza
// `statusCode` arriverebbe al client come 500. Ritornare un ErroreDominio
// lo fa riconoscere da pluginErrori esattamente come ogni altro errore di
// dominio, status e formato inclusi.
export async function pluginRateLimit(app: FastifyInstance, redisUrl: string): Promise<void> {
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis: new Redis(redisUrl, { enableAutoPipelining: true }),
    errorResponseBuilder: () =>
      new ErroreDominio('TROPPE_RICHIESTE', 'Troppe richieste, riprova più tardi.', 429),
  });
}
