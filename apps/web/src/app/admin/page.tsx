import Link from 'next/link';
import type { Impostazioni, UtenteElenco } from '@gestilab/shared';

import { chiamaApi } from '../../lib/api.js';
import { richiediSessione } from '../../lib/sessione.js';

// Cruscotto minimo (docs/02: /admin → cruscotto): due numeri e i link alle
// sezioni. I contatori veri (asset, segnalazioni, task) arrivano con le
// loro fasi. Le due chiamate all'API sono in parallelo.
export default async function PaginaAdmin(): Promise<React.JSX.Element> {
  const utente = await richiediSessione('admin');
  const [utenti, impostazioni] = await Promise.all([
    chiamaApi<UtenteElenco[]>('admin', '/api/v1/admin/utenti'),
    chiamaApi<Impostazioni>('admin', '/api/v1/admin/impostazioni'),
  ]);
  const daInvitare = utenti.filter((u) => !u.passwordImpostata).length;

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Cruscotto</h1>
      <p>Ciao {utente.nome}.</p>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="rounded border border-gray-300 bg-white p-4">
          <dt className="text-sm text-gray-600">Utenti</dt>
          <dd className="text-3xl font-semibold">{utenti.length}</dd>
          <dd className="text-sm">{daInvitare > 0 ? `${daInvitare} con invito in sospeso` : 'tutti con password impostata'}</dd>
          <Link href="/admin/utenti" className="text-sm underline">
            Gestisci utenti
          </Link>
        </div>
        <div className="rounded border border-gray-300 bg-white p-4">
          <dt className="text-sm text-gray-600">PIN docente</dt>
          <dd className="text-3xl font-semibold">{impostazioni.pinImpostato ? 'impostato' : 'assente'}</dd>
          <dd className="text-sm">modalità accesso docente: {impostazioni.modalitaAccessoDocente}</dd>
          <Link href="/admin/impostazioni" className="text-sm underline">
            Impostazioni
          </Link>
        </div>
      </dl>
    </section>
  );
}
