import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { eAreaSessione } from '@gestilab/shared';

import { ModuloLogin } from './modulo-login.js';

export const metadata: Metadata = {
  title: 'Accedi — GestiLab',
};

export default async function PaginaLogin({
  params,
}: {
  params: Promise<{ area: string }>;
}): Promise<React.JSX.Element> {
  const { area } = await params;

  if (!eAreaSessione(area)) {
    notFound();
  }

  return <ModuloLogin area={area} />;
}
