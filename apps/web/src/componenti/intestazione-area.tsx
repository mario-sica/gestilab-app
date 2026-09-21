import Link from 'next/link';
import type { AreaSessione } from '@gestilab/shared';
import type { UtenteSessione } from 'gestilab-auth-service/lettura';

import { ModuloEsci } from '../app/[area]/esci/modulo-esci.js';

interface Voce {
  href: string;
  testo: string;
}

// Testata comune alle aree autenticate: navigazione, chi sei, "Esci".
// Server Component: riceve l'utente dal layout (letto una volta per
// richiesta, lib/sessione.ts), non lo rilegge.
export function IntestazioneArea({
  area,
  titolo,
  voci,
  utente,
}: {
  area: AreaSessione;
  titolo: string;
  voci: Voce[];
  utente: UtenteSessione;
}): React.JSX.Element {
  return (
    <header className="border-b border-gray-300 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-3">
        <Link href={`/${area}`} className="text-lg font-semibold">
          GestiLab · {titolo}
        </Link>
        <nav aria-label="Sezioni" className="flex flex-wrap gap-3 text-sm">
          {voci.map((voce) => (
            <Link key={voce.href} href={voce.href} className="min-h-11 py-2 underline-offset-4 hover:underline">
              {voce.testo}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span>
            {utente.nome} {utente.cognome} <span className="text-gray-600">({utente.ruolo})</span>
          </span>
          <ModuloEsci area={area} />
        </div>
      </div>
    </header>
  );
}
