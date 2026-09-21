import type { Db } from '@gestilab/db';
import { origineTenant, type Env, type NuovoInvitoUtente } from '@gestilab/shared';

import type { CodaEmail } from '../../plugin/coda-email.js';
import type { ClientAuthService } from '../../servizi/auth-service.js';
import { creaUtenteSenzaPassword, trovaIstituto } from './repository.js';

export interface DipendenzeAdminUtenti {
  db: Db;
  env: Pick<Env, 'BASE_DOMAIN' | 'WEB_PROTOCOLLO' | 'WEB_PORTA'>;
  authService: ClientAuthService;
  codaEmail: CodaEmail;
}

export interface InvitoInviato {
  utenteId: string;
  scadeIl: Date;
}

/**
 * RF-A2: l'Admin invita un utente. Tre passi, in quest'ordine:
 * 1. la riga in utenti (senza password: la imposta l'invitato);
 * 2. il token d'invito, emesso da gestilab-auth-service (che possiede
 *    credenziali e token — questo modulo non vede mai l'hash);
 * 3. l'email, accodata al worker con il link assoluto composto qui, da
 *    BASE_DOMAIN + slug (apps/api è l'unico dei tre a sapere sia lo slug
 *    del tenant sia l'origine pubblica di apps/web).
 *
 * Se il passo 2 o 3 fallisce l'utente resta creato ma senza invito: non è
 * un'incoerenza, l'Admin lo vedrà in elenco e potrà reinvitarlo (il
 * reinvio è la via normale anche per un link scaduto) — un rollback
 * dell'utente per un SMTP giù sarebbe più sorprendente che utile.
 */
export async function invitaUtente(deps: DipendenzeAdminUtenti, tenantId: string, dati: NuovoInvitoUtente): Promise<InvitoInviato> {
  const istituto = await trovaIstituto(deps.db, tenantId);
  const utente = await creaUtenteSenzaPassword(deps.db, tenantId, dati);
  const invito = await deps.authService.creaInvito(tenantId, utente.id);

  await deps.codaEmail.accoda({
    tipo: 'invito',
    a: dati.email,
    nome: dati.nome,
    istituto: istituto.denominazione,
    link: `${origineTenant(deps.env, istituto.slug)}/invito/${invito.token}`,
    scadeIl: invito.scadeIl.toISOString(),
  });

  return { utenteId: utente.id, scadeIl: invito.scadeIl };
}
