import { headers } from 'next/headers';
import type { Metadata } from 'next';

import { ModuloDocenteLogin } from '../../../funzionalita/docente-login/modulo-docente-login.js';
import { leggiModalitaAccessoDocente } from '../../../lib/istituto.js';

export const metadata: Metadata = {
  title: 'Accesso docente — GestiLab',
};

// Route statica: intercetta /docente/login PRIMA del segmento dinamico
// [area]/login (email+password) — vedi il commento in quella pagina.
// Sempre dinamica: dipende dalla modalità dell'istituto, mai in cache.
export const dynamic = 'force-dynamic';

export default async function PaginaDocenteLogin(): Promise<React.JSX.Element> {
  const tenantId = (await headers()).get('x-tenant-id');
  const modalita = tenantId ? await leggiModalitaAccessoDocente(tenantId) : null;
  const aPin = modalita === 'pin_istituto' || modalita === 'pin_personale';

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Accesso docente</h1>
      {aPin ? (
        <ModuloDocenteLogin />
      ) : (
        <p role="status" className="max-w-sm text-center">
          L&apos;accesso docente non è ancora attivo per questo istituto. Rivolgiti alla segreteria o
          all&apos;assistente tecnico.
        </p>
      )}
    </main>
  );
}
