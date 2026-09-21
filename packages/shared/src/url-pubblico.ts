import type { Env } from './env.js';

/**
 * Origine pubblica dell'app web di un tenant, es. http://dellaquila.localhost:3000
 * in sviluppo, https://dellaquila.gestilab.test in local-prod: serve a chi
 * deve scrivere un URL assoluto fuori da una richiesta HTTP (link email
 * d'invito; in futuro i QR). Composta solo da variabili d'ambiente — mai
 * un dominio scritto nel codice (docs/CLAUDE.md).
 */
export function origineTenant(env: Pick<Env, 'BASE_DOMAIN' | 'WEB_PROTOCOLLO' | 'WEB_PORTA'>, slug: string): string {
  const porta = env.WEB_PORTA === undefined ? '' : `:${env.WEB_PORTA}`;
  return `${env.WEB_PROTOCOLLO}://${slug}.${env.BASE_DOMAIN}${porta}`;
}
