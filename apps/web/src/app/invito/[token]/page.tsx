import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { leggiEnv } from '@gestilab/shared';

import { ModuloInvito } from './modulo-invito.js';

export const metadata: Metadata = {
  title: 'Invito — GestiLab',
};

// Mai in cache: la pagina dipende dal token e dal suo stato (usato/scaduto).
export const dynamic = 'force-dynamic';

interface Invitato {
  nome: string;
  email: string;
}

// Verifica il token PRIMA di mostrare il form (POST /inviti/verifica,
// che non lo spende): chi apre un link scaduto lo scopre subito, non dopo
// aver scelto una password. Un solo messaggio per sconosciuto/scaduto/
// usato, come risponde l'auth-service.
async function verificaInvito(token: string): Promise<Invitato | null> {
  const tenantId = (await headers()).get('x-tenant-id');
  if (!tenantId) {
    return null;
  }
  try {
    const risposta = await fetch(`${leggiEnv().AUTH_SERVICE_URL}/inviti/verifica`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ istitutoId: tenantId, token }),
      cache: 'no-store',
    });
    return risposta.ok ? ((await risposta.json()) as Invitato) : null;
  } catch {
    return null;
  }
}

export default async function PaginaInvito({ params }: { params: Promise<{ token: string }> }): Promise<React.JSX.Element> {
  const { token } = await params;
  const invitato = await verificaInvito(token);

  if (!invitato) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-2xl font-semibold">Invito non valido</h1>
        <p role="alert" className="max-w-sm text-center text-base">
          Questo invito non è più valido o è scaduto. Chiedi un nuovo invito all&apos;amministratore del tuo istituto.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Ciao {invitato.nome}, benvenuto in GestiLab</h1>
      <p className="text-base">
        Imposta la password per <strong>{invitato.email}</strong>.
      </p>
      <ModuloInvito token={token} email={invitato.email} />
    </main>
  );
}
