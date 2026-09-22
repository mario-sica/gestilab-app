'use client';

import { useState } from 'react';
import { ErroreDominio, type AssetPubblico } from '@gestilab/shared';

import { Bottone } from '../../componenti/bottone.js';
import { Campo } from '../../componenti/campo.js';
import { chiamaApiClient } from '../../lib/client-api.js';
import { AssetPubblicoNonTrovato, SchedaAssetPubblico } from './scheda-asset-pubblico.js';

type Esito = { tipo: 'trovato'; asset: AssetPubblico } | { tipo: 'non_trovato' } | { tipo: 'errore' } | null;

// Per chi non può scansionare il QR (etichetta danneggiata, fotocamera
// non disponibile): il codice a 6 caratteri stampato sotto, digitato a
// mano (task 2.3). Non un redirect a /q/{codice}: quel percorso si
// aspetta il qr_token vero, un codice breve non lo è (unique solo per
// istituto, non globale) — la ricerca resta su questa pagina.
export function ModuloCodiceBreve(): React.JSX.Element {
  const [codice, setCodice] = useState('');
  const [inCorso, setInCorso] = useState(false);
  const [esito, setEsito] = useState<Esito>(null);

  async function cerca(evento: React.FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    setInCorso(true);
    try {
      const trovato = await chiamaApiClient<AssetPubblico>(`/api/v1/pubblico/asset/codice-breve/${encodeURIComponent(codice)}`);
      setEsito({ tipo: 'trovato', asset: trovato });
    } catch (errore) {
      setEsito({ tipo: errore instanceof ErroreDominio && errore.codice === 'ASSET_NON_TROVATO' ? 'non_trovato' : 'errore' });
    } finally {
      setInCorso(false);
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <form onSubmit={(evento) => void cerca(evento)} noValidate className="flex flex-col gap-3">
        <Campo
          etichetta="Codice a 6 caratteri (sotto il QR)"
          value={codice}
          onChange={(evento) => setCodice(evento.target.value.toUpperCase())}
          maxLength={6}
          autoComplete="off"
        />
        <Bottone type="submit" disabled={inCorso || codice.trim().length === 0}>
          {inCorso ? 'Ricerca in corso…' : 'Cerca'}
        </Bottone>
      </form>

      {esito?.tipo === 'trovato' && <SchedaAssetPubblico asset={esito.asset} />}
      {esito?.tipo === 'non_trovato' && <AssetPubblicoNonTrovato />}
      {esito?.tipo === 'errore' && <p role="alert">Si è verificato un errore. Riprova più tardi.</p>}
    </div>
  );
}
