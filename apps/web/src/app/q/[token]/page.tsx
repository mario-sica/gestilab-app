import Link from 'next/link';
import type { Metadata } from 'next';
import { ErroreDominio, type AssetPubblico } from '@gestilab/shared';

import { AssetPubblicoNonTrovato, SchedaAssetPubblico } from '../../../funzionalita/risoluzione-pubblica/scheda-asset-pubblico.js';
import { chiamaApiPubblica } from '../../../lib/api.js';

export const metadata: Metadata = { title: 'Bene inquadrato — GestiLab' };

// Pagina pubblica del QR (task 2.3, docs/02 § Routing): nessuna sessione,
// nessun login. Sempre dinamica: interroga l'API a ogni visita, mai in
// cache (Cache-Control: no-store, già impostato dall'API stessa).
export const dynamic = 'force-dynamic';

export default async function PaginaRisoluzioneQr({ params }: { params: Promise<{ token: string }> }): Promise<React.JSX.Element> {
  const { token } = await params;

  let asset: AssetPubblico | null = null;
  try {
    asset = await chiamaApiPubblica<AssetPubblico>(`/api/v1/pubblico/asset/qr/${encodeURIComponent(token)}`);
  } catch (errore) {
    if (!(errore instanceof ErroreDominio) || errore.codice !== 'ASSET_NON_TROVATO') {
      throw errore;
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      {asset ? (
        <SchedaAssetPubblico asset={asset} />
      ) : (
        <>
          <AssetPubblicoNonTrovato />
          <Link href="/q" className="text-sm underline-offset-4 hover:underline">
            Prova con il codice breve stampato sotto il QR
          </Link>
        </>
      )}
    </main>
  );
}
