import pino from 'pino';

// Stesse regole del logger di apps/api (plugin/logger.ts): JSON su stdout,
// nessun dato personale, token e password oscurati — docs/06 § 2.8. Qui
// in più l'indirizzo del destinatario e il link (contiene il token
// d'invito): il worker logga l'id del job e l'esito, mai il payload intero.
export function creaLogger(livello: string): pino.Logger {
  return pino({
    level: livello,
    redact: { paths: ['*.password', '*.pin', '*.token', '*.link', '*.a'], censor: '[Redacted]' },
  });
}
