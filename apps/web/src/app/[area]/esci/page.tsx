import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { eAreaSessione } from '@gestilab/shared';

import { ModuloEsci } from './modulo-esci.js';

export const metadata: Metadata = {
  title: 'Esci — GestiLab',
};

// Qui 'docente' È raggiunto davvero: a differenza del login, non esiste
// (né serve) una /docente/esci letterale — il modulo generico basta, il
// logout non ha bisogno di un form diverso per persona (task 1.5).
const TITOLO_PER_AREA = {
  admin: 'Uscire dall’area amministratore?',
  tecnico: 'Uscire dall’area tecnico?',
  docente: 'Uscire dall’area docente?',
} as const;

export default async function PaginaEsci({
  params,
}: {
  params: Promise<{ area: string }>;
}): Promise<React.JSX.Element> {
  const { area } = await params;

  if (!eAreaSessione(area)) {
    notFound();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">{TITOLO_PER_AREA[area]}</h1>
      <ModuloEsci area={area} />
    </main>
  );
}
