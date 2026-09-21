import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { eAreaSessione } from '@gestilab/shared';

import { ModuloLogin } from './modulo-login.js';

export const metadata: Metadata = {
  title: 'Accedi — GestiLab',
};

export default async function PaginaLogin({
  params,
  searchParams,
}: {
  params: Promise<{ area: string }>;
  searchParams: Promise<{ invito?: string }>;
}): Promise<React.JSX.Element> {
  const { area } = await params;

  if (!eAreaSessione(area)) {
    notFound();
  }

  // ?invito=ok: arrivo da /invito/[token] dopo aver impostato la password
  // (task 1.3). Solo un messaggio di conferma, nessun dato: chi lo aggiunge
  // a mano all'URL vede una frase innocua.
  const { invito } = await searchParams;
  const messaggio = invito === 'ok' ? 'Password impostata. Ora puoi accedere.' : undefined;

  return <ModuloLogin area={area} {...(messaggio ? { messaggio } : {})} />;
}
