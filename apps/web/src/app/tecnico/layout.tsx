import { redirect } from 'next/navigation';

import { AccessoNegato } from '../../componenti/accesso-negato.js';
import { IntestazioneArea } from '../../componenti/intestazione-area.js';
import { verificaAccessoArea } from '../../lib/sessione.js';

export default async function LayoutTecnico({ children }: { children: React.ReactNode }): Promise<React.JSX.Element> {
  const accesso = await verificaAccessoArea('tecnico');
  if (accesso.esito === 'nessuna_sessione') {
    redirect('/tecnico/login');
  }
  if (accesso.esito === 'altra_area') {
    return <AccessoNegato areaRichiesta="tecnico" areaCorretta={accesso.areaCorretta} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <IntestazioneArea area="tecnico" titolo="Tecnico" utente={accesso.utente} voci={[]} />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
