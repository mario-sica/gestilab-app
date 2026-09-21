import type { UtenteElenco } from '@gestilab/shared';

import { GestioneUtenti } from '../../../funzionalita/utenti/gestione-utenti.js';
import { chiamaApi } from '../../../lib/api.js';
import { richiediSessione } from '../../../lib/sessione.js';

// Server Component: l'elenco arriva già renderizzato dal server (una
// chiamata all'API, nessun caricamento nel browser) e viene passato come
// initialData alla query TanStack del client component, che da lì in poi
// lo tiene aggiornato dopo ogni invito — dati iniziali dal server, stato
// vivo nel client, nessun doppio fetch.
export default async function PaginaUtenti(): Promise<React.JSX.Element> {
  const utente = await richiediSessione('admin');
  const elenco = await chiamaApi<UtenteElenco[]>('admin', '/api/v1/admin/utenti');
  return <GestioneUtenti elencoIniziale={elenco} puoInvitare={utente.ruolo === 'admin'} />;
}
