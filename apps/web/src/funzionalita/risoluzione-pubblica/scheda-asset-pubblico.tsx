import type { AssetPubblico, StatoAsset } from '@gestilab/shared';

import { Avviso } from '../../componenti/avviso.js';

const NOME_STATO: Record<StatoAsset, string> = {
  attivo: 'Attivo',
  guasto: 'Guasto',
  in_riparazione: 'In riparazione',
  in_prestito: 'In prestito',
  in_magazzino: 'In magazzino',
  dismesso: 'Dismesso',
};

// Payload minimo (task 2.3, docs/03-api.md § Area pubblica): solo ciò che
// conferma "hai inquadrato il bene giusto ed è in questo stato" — niente
// seriale, numero d'inventario o altro dato patrimoniale.
export function SchedaAssetPubblico({ asset }: { asset: AssetPubblico }): React.JSX.Element {
  return (
    <div className="flex w-full max-w-sm flex-col gap-3 rounded border border-gray-300 bg-white p-4">
      <h1 className="text-xl font-semibold">{asset.etichetta}</h1>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-gray-600">Tipo</dt>
        <dd>{asset.tipoAsset}</dd>
        {(asset.marca ?? asset.modello) && (
          <>
            <dt className="text-gray-600">Marca / modello</dt>
            <dd>{[asset.marca, asset.modello].filter(Boolean).join(' ')}</dd>
          </>
        )}
        <dt className="text-gray-600">Ambiente</dt>
        <dd>{asset.ambiente}</dd>
        <dt className="text-gray-600">Stato</dt>
        <dd>{NOME_STATO[asset.stato]}</dd>
      </dl>
    </div>
  );
}

export function AssetPubblicoNonTrovato(): React.JSX.Element {
  return <Avviso tono="errore">Nessun bene trovato con questo codice: controlla di aver inquadrato il QR giusto, o riprova più tardi.</Avviso>;
}
