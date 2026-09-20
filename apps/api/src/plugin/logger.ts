import type { FastifyServerOptions } from 'fastify';

// docs/06-sicurezza-gdpr.md § 2.8: log strutturati JSON senza dati
// personali né token/PIN. redact sostituisce il valore con "[Redacted]"
// invece di ometterlo, così resta evidente che qualcosa è stato tolto.
export function opzioniLogger(livello: string): NonNullable<FastifyServerOptions['logger']> {
  return {
    level: livello,
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.pin', '*.token'],
      censor: '[Redacted]',
    },
  };
}
