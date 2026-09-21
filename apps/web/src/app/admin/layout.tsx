import { redirect } from 'next/navigation';

import { AccessoNegato } from '../../componenti/accesso-negato.js';
import { IntestazioneArea } from '../../componenti/intestazione-area.js';
import { verificaAccessoArea } from '../../lib/sessione.js';

// Area admin (docs/02 § Routing): tutto sotto /admin passa da qui, tranne
// /admin/login e /admin/esci che vivono in app/[area]/ (segmento dinamico,
// fuori da questo layout — il login non deve richiedere una sessione).
export default async function LayoutAdmin({ children }: { children: React.ReactNode }): Promise<React.JSX.Element> {
  const accesso = await verificaAccessoArea('admin');
  if (accesso.esito === 'nessuna_sessione') {
    redirect('/admin/login');
  }
  if (accesso.esito === 'altra_area') {
    return <AccessoNegato areaRichiesta="admin" areaCorretta={accesso.areaCorretta} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <IntestazioneArea
        area="admin"
        titolo="Amministrazione"
        utente={accesso.utente}
        voci={[
          { href: '/admin/utenti', testo: 'Utenti' },
          { href: '/admin/impostazioni', testo: 'Impostazioni' },
        ]}
      />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
