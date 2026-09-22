'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ErroreDominio,
  MODALITA_ACCESSO_DOCENTE_SELEZIONABILI,
  type AggiornaImpostazioni,
  type Impostazioni,
  type ModalitaAccessoDocente,
  type PinRigenerato,
} from '@gestilab/shared';

import { Avviso } from '../../componenti/avviso.js';
import { Bottone } from '../../componenti/bottone.js';
import { CampoSelezione } from '../../componenti/campo.js';
import { chiamaApiClient } from '../../lib/client-api.js';

const CHIAVE_IMPOSTAZIONI = ['admin', 'impostazioni'] as const;

const NOME_MODALITA: Record<ModalitaAccessoDocente, string> = {
  solo_qr: 'Solo QR (nessun login docente)',
  pin_istituto: 'PIN unico d’istituto',
  pin_personale: 'PIN personale per docente',
  sso: 'SSO',
};

// Task 1.4: il PIN si vede UNA volta, subito dopo la rigenerazione — non
// esiste da nessuna parte in chiaro (solo l'hash): chi cambia pagina e
// non l'ha annotato deve rigenerarlo, cosa che butta fuori tutti i
// docenti. La conferma esplicita serve a questo.
export function AccessoDocente({ impostazioniIniziali, puoRigenerare }: { impostazioniIniziali: Impostazioni; puoRigenerare: boolean }): React.JSX.Element {
  const queryClient = useQueryClient();
  const [confermaAperta, setConfermaAperta] = useState(false);
  const [ultimo, setUltimo] = useState<PinRigenerato | null>(null);

  const { data: impostazioni = impostazioniIniziali } = useQuery({
    queryKey: CHIAVE_IMPOSTAZIONI,
    queryFn: () => chiamaApiClient<Impostazioni>('/api/v1/admin/impostazioni'),
    initialData: impostazioniIniziali,
  });

  const modificaModalita = useMutation({
    mutationFn: (dati: AggiornaImpostazioni) =>
      chiamaApiClient<Impostazioni>('/api/v1/admin/impostazioni', { method: 'PATCH', body: JSON.stringify(dati) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CHIAVE_IMPOSTAZIONI });
    },
  });

  const rigenera = useMutation({
    mutationFn: () => chiamaApiClient<PinRigenerato>('/api/v1/admin/impostazioni/pin-docente', { method: 'POST' }),
    onSuccess: async (esito) => {
      setUltimo(esito);
      setConfermaAperta(false);
      await queryClient.invalidateQueries({ queryKey: CHIAVE_IMPOSTAZIONI });
    },
  });

  const errore = rigenera.error
    ? rigenera.error instanceof ErroreDominio && rigenera.error.codice === 'AUTH_SERVICE_NON_RAGGIUNGIBILE'
      ? 'Servizio di autenticazione non raggiungibile. Riprova più tardi.'
      : 'Si è verificato un errore. Riprova più tardi.'
    : null;

  return (
    <div className="flex max-w-lg flex-col gap-4 rounded border border-gray-300 bg-white p-4">
      <h2 className="text-lg font-semibold">Accesso docente</h2>

      {puoRigenerare ? (
        <CampoSelezione
          etichetta="Modalità di accesso docente"
          value={impostazioni.modalitaAccessoDocente}
          disabled={modificaModalita.isPending}
          onChange={(evento) =>
            modificaModalita.mutate({
              // Il valore arriva sempre da una delle <option> generate da
              // MODALITA_ACCESSO_DOCENTE_SELEZIONABILI (mai "sso": non è
              // tra le opzioni del menu) — il cast è sicuro quanto quello
              // che il browser stesso applica scegliendo tra le <option>.
              modalitaAccessoDocente: evento.target.value as (typeof MODALITA_ACCESSO_DOCENTE_SELEZIONABILI)[number],
            })
          }
          opzioni={MODALITA_ACCESSO_DOCENTE_SELEZIONABILI.map((valore) => ({ valore, testo: NOME_MODALITA[valore] }))}
        />
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-gray-600">Modalità di accesso docente</dt>
          <dd>{NOME_MODALITA[impostazioni.modalitaAccessoDocente]}</dd>
        </dl>
      )}
      <p className="text-sm">PIN d’istituto: {impostazioni.pinImpostato ? 'impostato' : 'mai generato'}</p>
      {modificaModalita.isError && <Avviso tono="errore">Non è stato possibile cambiare la modalità. Riprova più tardi.</Avviso>}

      {ultimo && (
        <Avviso tono="successo">
          <p>
            Nuovo PIN: <strong className="font-mono text-2xl tracking-widest">{ultimo.pin}</strong>
          </p>
          <p>Annotalo ora: non sarà più visibile. {ultimo.sessioniDocenteRevocate} sessioni docente sono state chiuse.</p>
        </Avviso>
      )}
      {errore && <Avviso tono="errore">{errore}</Avviso>}

      {puoRigenerare && !confermaAperta && (
        <Bottone type="button" variante="secondario" onClick={() => setConfermaAperta(true)}>
          {impostazioni.pinImpostato ? 'Rigenera il PIN' : 'Genera il PIN'}
        </Bottone>
      )}
      {puoRigenerare && confermaAperta && (
        <div role="group" aria-labelledby="conferma-pin" className="flex flex-col gap-3 rounded border border-yellow-400 bg-yellow-50 p-3 text-sm">
          <p id="conferma-pin">
            Il vecchio PIN smetterà di funzionare e tutti i docenti collegati dovranno rientrare. Continuare?
          </p>
          <div className="flex gap-2">
            <Bottone type="button" variante="pericolo" onClick={() => rigenera.mutate()} disabled={rigenera.isPending}>
              {rigenera.isPending ? 'Generazione…' : 'Sì, genera un nuovo PIN'}
            </Bottone>
            <Bottone type="button" variante="secondario" onClick={() => setConfermaAperta(false)} disabled={rigenera.isPending}>
              Annulla
            </Bottone>
          </div>
        </div>
      )}
    </div>
  );
}
