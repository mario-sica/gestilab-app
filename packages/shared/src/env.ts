import { z } from 'zod';

const schemaEnv = z.object({
  BASE_DOMAIN: z.string().min(1),
  // Protocollo e porta con cui il browser raggiunge apps/web: insieme a
  // BASE_DOMAIN e allo slug del tenant compongono un URL assoluto (link
  // email, QR) — vedi origineTenant in url-pubblico.ts. In sviluppo
  // http + 3000; dietro Traefik https senza porta (WEB_PORTA vuota).
  WEB_PROTOCOLLO: z.enum(['http', 'https']),
  WEB_PORTA: z
    .string()
    .optional()
    .transform((valore) => (valore ? Number(valore) : undefined))
    .pipe(z.number().int().positive().optional()),
  API_PORT: z.coerce.number().int().positive(),
  API_HOST: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  // URL interno (rete Docker) del servizio gestilab-auth-service — sempre
  // presente in .env, anche quando il profilo Compose "auth" non è in
  // esecuzione (in quel caso la chiamata fallisce a runtime, non all'avvio:
  // vedi il documento di riferimento, sezione sull'integrazione).
  AUTH_SERVICE_URL: z.string().min(1),
  // URL interno (rete Docker) di apps/api, per apps/web: Server Component e
  // Server Action lo chiamano direttamente, il proxy app/api/[...proxy] lo
  // usa per i client component. Mai raggiunto dal browser.
  API_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  S3_ENDPOINT: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  SMTP_URL: z.string().min(1),
  // Mittente delle email transazionali (apps/worker), es. "GestiLab <noreply@dominio>".
  EMAIL_MITTENTE: z.string().min(1),
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
