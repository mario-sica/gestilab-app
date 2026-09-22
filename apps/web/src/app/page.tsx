import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AREE_SESSIONE_UTENTE } from '@gestilab/shared';

import { leggiSessione, leggiSessioneDocente } from '../lib/sessione.js';

// docs/02 § Routing: "/ → se sessione valida, redirect all'area; altrimenti
// scelta area". Ordine di AREE_SESSIONE_UTENTE: chi ha più sessioni (raro)
// va alla prima. Il docente si controlla a parte (leggiSessioneDocente:
// niente ruolo, tabella diversa) — non prima delle altre due, per una
// ragione pratica: /docente esiste da questo task (1.5) solo come
// segnaposto, mentre /admin e /tecnico sono aree vere; un admin che ha
// anche un accesso docente attivo non deve ritrovarsi spedito lì.
export default async function PaginaHome(): Promise<React.JSX.Element> {
  for (const area of AREE_SESSIONE_UTENTE) {
    if (await leggiSessione(area)) {
      redirect(`/${area}`);
    }
  }
  if (await leggiSessioneDocente()) {
    redirect('/docente');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">GestiLab</h1>
      <p>Scegli come vuoi accedere.</p>
      <nav aria-label="Aree" className="flex flex-col gap-3 sm:flex-row">
        <Link href="/admin/login" className="min-h-11 rounded bg-gray-900 px-6 py-3 text-center text-white">
          Amministratore
        </Link>
        <Link href="/tecnico/login" className="min-h-11 rounded border border-gray-400 bg-white px-6 py-3 text-center">
          Assistente tecnico
        </Link>
      </nav>
    </main>
  );
}
