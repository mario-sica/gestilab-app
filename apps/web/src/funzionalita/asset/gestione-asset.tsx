'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { ListaAsset, StatoAsset } from '@gestilab/shared';

import { Bottone } from '../../componenti/bottone.js';
import { chiamaApiClient } from '../../lib/client-api.js';

const NOME_STATO: Record<StatoAsset, string> = {
  attivo: 'Attivo',
  guasto: 'Guasto',
  in_riparazione: 'In riparazione',
  in_prestito: 'In prestito',
  in_magazzino: 'In magazzino',
  dismesso: 'Dismesso',
};

// Elenco in sola lettura degli asset del proprio perimetro affidamenti
// (task 2.2): la prova a occhio che "AT non vede asset di ambienti non
// affidati" funzioni davvero, non solo nei test. Creazione/modifica
// arrivano con i task successivi (2.4 e seguenti).
export function GestioneAsset({ elencoIniziale }: { elencoIniziale: ListaAsset }): React.JSX.Element {
  const [pagina, setPagina] = useState(1);

  const { data = elencoIniziale, isFetching } = useQuery({
    queryKey: ['tecnico', 'asset', pagina] as const,
    queryFn: () => chiamaApiClient<ListaAsset>(`/api/v1/tecnico/asset?pagina=${pagina}`),
    initialData: pagina === 1 ? elencoIniziale : undefined,
    placeholderData: (precedente) => precedente,
  });

  const totalePagine = Math.max(1, Math.ceil(data.totale / data.perPagina));

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Asset</h1>
        <p className="text-sm text-gray-600">Beni degli ambienti a te affidati nell’anno scolastico corrente.</p>
      </div>

      {data.dati.length === 0 ? (
        <p className="text-sm text-gray-600">Nessun asset trovato.</p>
      ) : (
        <table className="w-full border-collapse bg-white text-sm">
          <caption className="sr-only">Elenco asset</caption>
          <thead>
            <tr className="border-b border-gray-300 text-left">
              <th scope="col" className="p-2">
                Etichetta
              </th>
              <th scope="col" className="p-2">
                Marca / modello
              </th>
              <th scope="col" className="p-2">
                Stato
              </th>
            </tr>
          </thead>
          <tbody>
            {data.dati.map((riga) => (
              <tr key={riga.id} className="border-b border-gray-200">
                <td className="p-2 font-mono">{riga.etichetta}</td>
                <td className="p-2">{[riga.marca, riga.modello].filter(Boolean).join(' ') || '—'}</td>
                <td className="p-2">{NOME_STATO[riga.stato]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {totalePagine > 1 && (
        <div className="flex items-center gap-3 text-sm" aria-live="polite">
          <Bottone type="button" variante="secondario" onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina <= 1 || isFetching}>
            Precedente
          </Bottone>
          <span>
            Pagina {pagina} di {totalePagine} ({data.totale} asset)
          </span>
          <Bottone type="button" variante="secondario" onClick={() => setPagina((p) => Math.min(totalePagine, p + 1))} disabled={pagina >= totalePagine || isFetching}>
            Successiva
          </Bottone>
        </div>
      )}
    </section>
  );
}
