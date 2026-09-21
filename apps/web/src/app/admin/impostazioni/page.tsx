import type { Impostazioni } from '@gestilab/shared';

import { PinDocente } from '../../../funzionalita/impostazioni/pin-docente.js';
import { chiamaApi } from '../../../lib/api.js';
import { richiediSessione } from '../../../lib/sessione.js';

// docs/02: /admin/impostazioni → PIN docente, pagina pubblica, captcha,
// branding. Per ora il PIN (task 1.4); il resto con le sue fasi.
export default async function PaginaImpostazioni(): Promise<React.JSX.Element> {
  const utente = await richiediSessione('admin');
  const impostazioni = await chiamaApi<Impostazioni>('admin', '/api/v1/admin/impostazioni');
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Impostazioni</h1>
      <PinDocente impostazioniIniziali={impostazioni} puoRigenerare={utente.ruolo === 'admin'} />
    </section>
  );
}
