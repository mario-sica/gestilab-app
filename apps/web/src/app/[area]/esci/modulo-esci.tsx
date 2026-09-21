'use client';

import { useActionState } from 'react';
import type { AreaSessione } from '@gestilab/shared';

import { esci, type StatoEsci } from './azioni.js';

const STATO_INIZIALE: StatoEsci = {};

// Form di logout riutilizzabile: oggi renderizzato dalla pagina /[area]/esci,
// domani incluso nelle dashboard di area (/admin, /tecnico) quando
// esisteranno. Un <form> con Server Action, non un <a>: vedi azioni.ts.
export function ModuloEsci({ area }: { area: AreaSessione }): React.JSX.Element {
  // Niente esci.bind(null, area): vedi il commento in azioni.ts.
  const [stato, azione, inCorso] = useActionState(esci, STATO_INIZIALE);

  return (
    <form action={azione} className="flex flex-col items-center gap-4">
      <input type="hidden" name="area" value={area} />
      {stato.errore && (
        <p role="alert" className="text-sm text-red-600">
          {stato.errore}
        </p>
      )}
      <button
        type="submit"
        disabled={inCorso}
        className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {inCorso ? 'Uscita in corso…' : 'Esci'}
      </button>
    </form>
  );
}
