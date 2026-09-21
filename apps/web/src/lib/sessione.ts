import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { withTenant } from '@gestilab/db';
import { AREE_SESSIONE, COOKIE_PER_AREA, type AreaSessione } from '@gestilab/shared';
import { leggiSessioneAttiva, type UtenteSessione } from 'gestilab-auth-service/lettura';

import { ottieniDb } from './db.js';

// Lettura della sessione lato web: stesso store condiviso e stessa regola
// di apps/api (gestilab-auth-service/lettura), in-process — nessuna
// chiamata di rete per pagina. cache() di React deduplica per richiesta:
// layout, pagina e componenti che chiedono la stessa area fanno UNA query
// Postgres, non una a testa (docs/04: recupero dati nei server component,
// senza sprechi).
export const leggiSessione = cache(async (area: AreaSessione): Promise<UtenteSessione | null> => {
  const token = (await cookies()).get(COOKIE_PER_AREA[area])?.value;
  const tenantId = (await headers()).get('x-tenant-id');
  if (!token || !tenantId) {
    return null;
  }
  return withTenant(ottieniDb(), tenantId, (tx) => leggiSessioneAttiva(tx, area, token));
});

export type EsitoAccessoArea =
  | { esito: 'autorizzato'; utente: UtenteSessione }
  | { esito: 'altra_area'; areaCorretta: AreaSessione; utente: UtenteSessione }
  | { esito: 'nessuna_sessione' };

/**
 * docs/02-architettura.md § Aree: "ruolo sbagliato per l'area → 403 con
 * link all'area corretta, non redirect al login". Con un cookie per area:
 * se manca quello dell'area richiesta ma un'ALTRA area ha una sessione
 * valida, l'utente è loggato altrove → 403 con il link lì (chi lo decide
 * è il layout); se nessuna area ha una sessione → login.
 */
export async function verificaAccessoArea(area: AreaSessione): Promise<EsitoAccessoArea> {
  const utente = await leggiSessione(area);
  if (utente) {
    return { esito: 'autorizzato', utente };
  }
  for (const altra of AREE_SESSIONE) {
    if (altra === area) {
      continue;
    }
    const altrove = await leggiSessione(altra);
    if (altrove) {
      return { esito: 'altra_area', areaCorretta: altra, utente: altrove };
    }
  }
  return { esito: 'nessuna_sessione' };
}

/**
 * Per le PAGINE di un'area: l'utente della sessione, o redirect al login.
 * Next renderizza layout e pagina in parallelo, non in sequenza: senza
 * questo controllo in testa alla pagina, un /admin senza cookie farebbe
 * partire le chiamate all'API della pagina (401 a vuoto) mentre il layout
 * sta già reindirizzando. Stessa query del layout, deduplicata da cache().
 * Il caso "altra area" (403 con link) lo gestisce solo il layout: qui basta
 * non fare lavoro inutile.
 */
export async function richiediSessione(area: AreaSessione): Promise<UtenteSessione> {
  const utente = await leggiSessione(area);
  if (!utente) {
    redirect(`/${area}/login`);
  }
  return utente;
}
