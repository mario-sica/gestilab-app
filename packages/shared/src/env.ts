import { z } from 'zod';

const schemaEnv = z.object({
  BASE_DOMAIN: z.string().min(1),
  API_PORT: z.coerce.number().int().positive(),
  API_HOST: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  S3_ENDPOINT: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  SMTP_URL: z.string().min(1),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Env = z.infer<typeof schemaEnv>;

export function leggiEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const risultato = schemaEnv.safeParse(source);

  if (!risultato.success) {
    const dettagli = risultato.error.issues
      .map((problema) => `- ${problema.path.join('.')}: ${problema.message}`)
      .join('\n');
    throw new Error(`Configurazione ambiente non valida:\n${dettagli}`);
  }

  return risultato.data;
}
