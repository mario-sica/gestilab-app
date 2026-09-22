import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { withTenant, type Db } from '@gestilab/db';
import { AREA_PER_RUOLO, COOKIE_PER_AREA, ErroreDominio, type AreaSessioneUtente, type RuoloUtente } from '@gestilab/shared';
import { leggiSessioneAttiva, type UtenteSessione } from 'gestilab-auth-service/lettura';

declare module 'fastify' {
  interface FastifyRequest {
    utente?: UtenteSessione;
  }
}

/**
 * Legge la sessione dallo store condiviso con gestilab-auth-service (la
 * tabella "sessioni", stesso database) — nessuna chiamata di rete verso
 * quel servizio: qui si legge, lì si scrive (login, PIN, TOTP). La regola
 * "quando una sessione è valida" (area, scadenza, utente attivo, ruolo
 * riletto da utenti — docs/06 § 2.3) vive in gestilab-auth-service/lettura,
 * condivisa con apps/web: qui solo cookie e contesto tenant. Richiede
 * pluginTenant registrato prima (usa request.tenantId).
 */
export const pluginSessione = fp(async function pluginSessione(app: FastifyInstance, opts: { db: Db; area: AreaSessioneUtente }) {
  app.decorateRequest('utente', undefined);

  app.addHook('onRequest', async (request: FastifyRequest) => {
    if (!request.tenantId) {
      throw new ErroreDominio(
        'CONTESTO_MANCANTE',
        'pluginSessione richiede pluginTenant registrato prima.',
        500,
      );
    }

    const token = request.cookies[COOKIE_PER_AREA[opts.area]];
    const sessioneMancante = new ErroreDominio('SESSIONE_MANCANTE', 'Accesso richiesto.', 401);
    if (!token) {
      throw sessioneMancante;
    }

    const utente = await withTenant(opts.db, request.tenantId, (tx) => leggiSessioneAttiva(tx, opts.area, token));

    if (!utente) {
      throw sessioneMancante;
    }

    request.utente = utente;
  });
});

/**
 * Hook per singole rotte: 403 se il ruolo della sessione (già letta da
 * pluginSessione) non è tra quelli ammessi. docs/02-architettura.md § Aree:
 * "ruolo sbagliato → 403 con link all'area corretta, non redirect al
 * login". L'API espone l'AREA (dettagli.areaCorretta, dalla mappa
 * ruolo → area di packages/shared), non un URL: il link lo compone
 * apps/web, che conosce le proprie rotte — nessun percorso hardcoded qui.
 */
export function richiediRuolo(ruoliAmmessi: readonly RuoloUtente[]) {
  return async (request: FastifyRequest): Promise<void> => {
    if (!request.utente) {
      throw new ErroreDominio('RUOLO_NON_VALIDO', 'Non hai i permessi per questa azione.', 403);
    }
    if (!ruoliAmmessi.includes(request.utente.ruolo)) {
      throw new ErroreDominio('RUOLO_NON_VALIDO', 'Non hai i permessi per questa azione.', 403, {
        areaCorretta: AREA_PER_RUOLO[request.utente.ruolo],
      });
    }
  };
}
