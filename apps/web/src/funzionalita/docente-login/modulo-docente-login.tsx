'use client';

import { useActionState, useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { PersonaRicerca } from '@gestilab/shared';

import { Avviso } from '../../componenti/avviso.js';
import { Bottone } from '../../componenti/bottone.js';
import { Campo } from '../../componenti/campo.js';
import { chiamaApiClient } from '../../lib/client-api.js';
import { accediDocente, type StatoAccessoDocente } from '../../app/docente/login/azioni.js';

const STATO_INIZIALE: StatoAccessoDocente = {};
const LUNGHEZZA_MINIMA_QUERY = 2;

const NOME_QUALIFICA: Record<string, string> = {
  docente: 'docente',
  collaboratore: 'collaboratore scolastico',
  amministrativo: 'personale amministrativo',
  altro: 'altro',
};

/**
 * Combobox pragmatico, non il pattern ARIA completo (frontend minimo,
 * docs/04): un campo di ricerca più un elenco di risultati sotto, ognuno
 * un bottone — raggiungibile da tastiera con Tab (non con le frecce),
 * niente roving focus. Basta a un elenco di poche decine di nomi.
 */
export function ModuloDocenteLogin(): React.JSX.Element {
  const idRisultati = useId();
  const [query, setQuery] = useState('');
  const [selezionata, setSelezionata] = useState<PersonaRicerca | null>(null);
  const [stato, azione, inCorso] = useActionState(accediDocente, STATO_INIZIALE);

  const ricerca = useQuery({
    queryKey: ['docente', 'persone', query],
    queryFn: () => chiamaApiClient<PersonaRicerca[]>(`/api/v1/docente/persone?query=${encodeURIComponent(query)}`),
    enabled: query.trim().length >= LUNGHEZZA_MINIMA_QUERY && !selezionata,
  });

  if (!selezionata) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-2">
        <Campo
          etichetta="Il tuo nome"
          value={query}
          onChange={(evento) => setQuery(evento.target.value)}
          autoComplete="off"
          role="combobox"
          aria-expanded={ricerca.data !== undefined && ricerca.data.length > 0}
          aria-controls={idRisultati}
          suggerimento="Scrivi almeno due lettere di nome o cognome."
        />
        <ul id={idRisultati} className="flex flex-col gap-1">
          {ricerca.data?.map((persona) => (
            <li key={persona.id}>
              <button
                type="button"
                onClick={() => setSelezionata(persona)}
                className="min-h-11 w-full rounded border border-gray-300 bg-white px-3 py-2 text-left hover:bg-gray-100"
              >
                {persona.cognome} {persona.nome}{' '}
                <span className="text-sm text-gray-600">({NOME_QUALIFICA[persona.qualifica] ?? persona.qualifica})</span>
              </button>
            </li>
          ))}
        </ul>
        {ricerca.data?.length === 0 && query.trim().length >= LUNGHEZZA_MINIMA_QUERY && (
          <p className="text-sm text-gray-600">Nessun nome trovato.</p>
        )}
      </div>
    );
  }

  return (
    <form action={azione} className="flex w-full max-w-sm flex-col gap-4">
      <input type="hidden" name="personaId" value={selezionata.id} />
      <div className="flex items-center justify-between rounded border border-gray-300 bg-gray-50 px-3 py-2">
        <span>
          {selezionata.cognome} {selezionata.nome}
        </span>
        <button type="button" onClick={() => setSelezionata(null)} className="text-sm underline">
          Non sei tu?
        </button>
      </div>
      <Campo
        etichetta="PIN"
        name="pin"
        type="password"
        inputMode="numeric"
        maxLength={6}
        autoComplete="off"
        required
        autoFocus
      />
      {stato.errore && <Avviso tono="errore">{stato.errore}</Avviso>}
      <Bottone type="submit" disabled={inCorso}>
        {inCorso ? 'Accesso in corso…' : 'Accedi'}
      </Bottone>
    </form>
  );
}
