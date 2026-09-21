'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ErroreDominio, RUOLI_UTENTE, schemaNuovoInvitoUtente, type NuovoInvitoUtente, type UtenteElenco } from '@gestilab/shared';

import { Avviso } from '../../componenti/avviso.js';
import { Bottone } from '../../componenti/bottone.js';
import { Campo, CampoSelezione } from '../../componenti/campo.js';
import { chiamaApiClient } from '../../lib/client-api.js';

const CHIAVE_UTENTI = ['admin', 'utenti'] as const;

const NOME_RUOLO: Record<(typeof RUOLI_UTENTE)[number], string> = {
  admin: 'Amministratore',
  at: 'Assistente tecnico',
  supervisore: 'Supervisore (sola lettura)',
};

const MESSAGGIO_ERRORE: Record<string, string> = {
  EMAIL_GIA_PRESENTE: 'Esiste già un utente con questa email.',
  AUTH_SERVICE_NON_RAGGIUNGIBILE: 'Servizio di autenticazione non raggiungibile: l’utente è stato creato, reinvitalo più tardi.',
};

export function GestioneUtenti({ elencoIniziale, puoInvitare }: { elencoIniziale: UtenteElenco[]; puoInvitare: boolean }): React.JSX.Element {
  const queryClient = useQueryClient();
  const [ultimoInvito, setUltimoInvito] = useState<string | null>(null);

  const { data: utenti = elencoIniziale } = useQuery({
    queryKey: CHIAVE_UTENTI,
    queryFn: () => chiamaApiClient<UtenteElenco[]>('/api/v1/admin/utenti'),
    initialData: elencoIniziale,
  });

  // React Hook Form + resolver Zod dello schema condiviso (docs/04): gli
  // stessi vincoli che apps/api applica al corpo della richiesta.
  const form = useForm<NuovoInvitoUtente>({
    resolver: zodResolver(schemaNuovoInvitoUtente),
    defaultValues: { email: '', nome: '', cognome: '', ruolo: 'at' },
  });

  const invita = useMutation({
    mutationFn: (dati: NuovoInvitoUtente) =>
      chiamaApiClient<{ utenteId: string; scadeIl: string }>('/api/v1/admin/utenti/inviti', { method: 'POST', body: JSON.stringify(dati) }),
    onSuccess: async (_esito, dati) => {
      setUltimoInvito(dati.email);
      form.reset();
      await queryClient.invalidateQueries({ queryKey: CHIAVE_UTENTI });
    },
  });

  const erroreInvito =
    invita.error instanceof ErroreDominio
      ? (MESSAGGIO_ERRORE[invita.error.codice] ?? invita.error.message)
      : invita.error
        ? 'Si è verificato un errore. Riprova più tardi.'
        : null;

  return (
    <section className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Utenti</h1>
        <p className="text-sm text-gray-600">Amministratori, assistenti tecnici e supervisori dell’istituto.</p>
      </div>

      <table className="w-full border-collapse bg-white text-sm">
        <caption className="sr-only">Elenco utenti</caption>
        <thead>
          <tr className="border-b border-gray-300 text-left">
            <th scope="col" className="p-2">Nome</th>
            <th scope="col" className="p-2">Email</th>
            <th scope="col" className="p-2">Ruolo</th>
            <th scope="col" className="p-2">Stato</th>
          </tr>
        </thead>
        <tbody>
          {utenti.map((u) => (
            <tr key={u.id} className="border-b border-gray-200">
              <td className="p-2">
                {u.cognome} {u.nome}
              </td>
              <td className="p-2">{u.email}</td>
              <td className="p-2">{NOME_RUOLO[u.ruolo]}</td>
              <td className="p-2">{!u.attivo ? 'Disattivato' : u.passwordImpostata ? 'Attivo' : 'Invito in sospeso'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {puoInvitare && (
        <form onSubmit={form.handleSubmit((dati) => invita.mutate(dati))} noValidate className="flex max-w-lg flex-col gap-4 rounded border border-gray-300 bg-white p-4">
          <h2 className="text-lg font-semibold">Invita un utente</h2>
          <p className="text-sm text-gray-600">Riceverà un’email con un link, valido 72 ore, per impostare la password.</p>
          <Campo etichetta="Nome" autoComplete="off" {...form.register('nome')} errore={form.formState.errors.nome?.message} />
          <Campo etichetta="Cognome" autoComplete="off" {...form.register('cognome')} errore={form.formState.errors.cognome?.message} />
          <Campo etichetta="Email" type="email" autoComplete="off" {...form.register('email')} errore={form.formState.errors.email?.message} />
          <CampoSelezione
            etichetta="Ruolo"
            {...form.register('ruolo')}
            errore={form.formState.errors.ruolo?.message}
            opzioni={RUOLI_UTENTE.map((r) => ({ valore: r, testo: NOME_RUOLO[r] }))}
          />
          {erroreInvito && <Avviso tono="errore">{erroreInvito}</Avviso>}
          {ultimoInvito && !erroreInvito && <Avviso tono="successo">Invito inviato a {ultimoInvito}.</Avviso>}
          <Bottone type="submit" disabled={invita.isPending}>
            {invita.isPending ? 'Invio in corso…' : 'Invia invito'}
          </Bottone>
        </form>
      )}
    </section>
  );
}
