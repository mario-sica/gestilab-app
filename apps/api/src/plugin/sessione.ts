import { createHash } from 'node:crypto';
import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import { withTenant, type Db } from '@gestilab/db';
import { utenti } from '@gestilab/db/schema';
import { ErroreDominio } from '@gestilab/shared';
import { sessioni } from 'gestilab-auth-service/schema';

type Area = 'admin' | 'tecnico';

declare module 'fastify' {
  interface FastifyRequest {
    utente?: { id: string; ruolo: string };
  }
}

// docs/06-sicurezza-gdpr.md (gestilab-app) § 2.2: un nome di cookie per
// area. Solo admin/tecnico per ora — coerente con gestilab-auth-service,
// che non emette ancora sessioni docente (persona + PIN, task 1.5).
const COOKIE_PER_AREA: Record<Area, string> = {
  admin: 'gl_s_adm',
  tecnico: 'gl_s_tec',
};

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Legge la sessione dallo store condiviso con gestilab-auth-service (la
 * tabella "sessioni", stesso database) — nessuna chiamata di rete verso
 * quel servizio: qui si legge, lì si scrive (login, PIN, TOTP). Richiede
 * pluginTenant registrato prima (usa request.tenantId).
 *
 * Il ruolo si rilegge sempre da "utenti", mai dalla sessione: se un admin
 * viene retrocesso o disattivato, la sessione esistente non deve
 * conservare il vecchio ruolo — stesso principio del perimetro dell'AT
 * ricalcolato ad ogni richiesta (docs/06-sicurezza-gdpr.md § 2.3).
 */
export const pluginSessione = fp(async function pluginSessione(app: FastifyInstance, opts: { db: Db; area: Area }) {
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

    const tokenHash = hashToken(token);
    const tenantId = request.tenantId;

    const utente = await withTenant(opts.db, tenantId, async (tx) => {
      const [sessione] = await tx
        .select({ utenteId: sessioni.utenteId, area: sessioni.area, scadeIl: sessioni.scadeIl })
        .from(sessioni)
        .where(eq(sessioni.tokenHash, tokenHash));

      if (!sessione || sessione.area !== opts.area || sessione.scadeIl.getTime() < Date.now()) {
        return null;
      }

      const [riga] = await tx
        .select({ id: utenti.id, ruolo: utenti.ruolo, attivo: utenti.attivo })
        .from(utenti)
        .where(eq(utenti.id, sessione.utenteId));

      if (!riga || !riga.attivo) {
        return null;
      }

      return { id: riga.id, ruolo: riga.ruolo };
    });

    if (!utente) {
      throw sessioneMancante;
    }

    request.utente = utente;
  });
});

/**
 * Hook per singole rotte: 403 se il ruolo della sessione (già letta da
 * pluginSessione) non è tra quelli ammessi. Non genera qui il link
 * all'area corretta (task 1.1, "403 con link corretto"): quello è
 * responsabilità di apps/web, che conosce gli URL delle pagine di login —
 * questo endpoint espone solo il codice, non un URL hardcoded.
 */
export function richiediRuolo(ruoliAmmessi: readonly string[]) {
  return async (request: FastifyRequest): Promise<void> => {
    if (!request.utente || !ruoliAmmessi.includes(request.utente.ruolo)) {
      throw new ErroreDominio('RUOLO_NON_VALIDO', 'Non hai i permessi per questa azione.', 403);
    }
  };
}
