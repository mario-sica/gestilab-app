import type { ListaAsset } from '@gestilab/shared';

import { GestioneAsset } from '../../../funzionalita/asset/gestione-asset.js';
import { chiamaApi } from '../../../lib/api.js';
import { richiediSessione } from '../../../lib/sessione.js';

// Server Component: prima pagina (dati iniziali) come admin/utenti — poi
// TanStack Query nel client component per il cambio pagina (task 2.2).
// Sola lettura: creare/modificare un asset arriva con i task 2.4 (mobile,
// 5 campi) e successivi, non qui.
export default async function PaginaAsset(): Promise<React.JSX.Element> {
  await richiediSessione('tecnico');
  const elenco = await chiamaApi<ListaAsset>('tecnico', '/api/v1/tecnico/asset');
  return <GestioneAsset elencoIniziale={elenco} />;
}
