import Link from 'next/link';
import type { AreaSessioneUtente } from '@gestilab/shared';

const NOME_AREA: Record<AreaSessioneUtente, string> = { admin: 'amministratore', tecnico: 'tecnico' };

// docs/02-architettura.md § Aree: ruolo sbagliato → 403 con link all'area
// corretta, non redirect al login. Il layout dell'area lo renderizza al
// posto dei figli (status HTTP resta 200: Next non permette di cambiarlo
// da un layout senza `forbidden()`, ancora sperimentale — il contenuto
// dice chiaramente cosa è successo). Solo admin/tecnico: vedi il commento
// su leggiSessione in lib/sessione.ts sul perché il docente non c'entra.
export function AccessoNegato({
  areaRichiesta,
  areaCorretta,
}: {
  areaRichiesta: AreaSessioneUtente;
  areaCorretta: AreaSessioneUtente;
}): React.JSX.Element {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">Non hai accesso all&apos;area {NOME_AREA[areaRichiesta]}</h1>
      <p role="alert" className="max-w-md text-center">
        Sei connesso come {NOME_AREA[areaCorretta]}: la tua area è un&apos;altra.
      </p>
      <Link href={`/${areaCorretta}`} className="rounded bg-gray-900 px-4 py-2 text-white">
        Vai all&apos;area {NOME_AREA[areaCorretta]}
      </Link>
    </main>
  );
}
