import type { Metadata } from 'next';

import { ModuloCodiceBreve } from '../../funzionalita/risoluzione-pubblica/modulo-codice-breve.js';

export const metadata: Metadata = { title: 'Cerca un bene — GestiLab' };

// /q senza segmento: chi non può scansionare (QR danneggiato, fotocamera
// non disponibile) digita il codice a 6 caratteri stampato sotto (task 2.3).
export default function PaginaRicercaCodiceBreve(): React.JSX.Element {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Cerca un bene</h1>
      <ModuloCodiceBreve />
    </main>
  );
}
