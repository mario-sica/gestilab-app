'use client';

import { useActionState } from 'react';

import { accettaInvito, type StatoInvito } from './azioni.js';

const STATO_INIZIALE: StatoInvito = {};

export function ModuloInvito({ token, email }: { token: string; email: string }): React.JSX.Element {
  const [stato, azione, inCorso] = useActionState(accettaInvito, STATO_INIZIALE);

  return (
    <form action={azione} className="flex w-full max-w-sm flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      {/* Solo per i gestori di password (autocomplete=username): non è un campo da compilare. */}
      <input type="hidden" name="email" value={email} autoComplete="username" />
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Nuova password (almeno 12 caratteri)</span>
        <input
          type="password"
          name="password"
          required
          minLength={12}
          autoComplete="new-password"
          className="rounded border border-gray-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Ripeti la password</span>
        <input
          type="password"
          name="conferma"
          required
          minLength={12}
          autoComplete="new-password"
          className="rounded border border-gray-300 px-3 py-2"
        />
      </label>
      {stato.errore && (
        <p role="alert" className="text-sm text-red-600">
          {stato.errore}
        </p>
      )}
      <button type="submit" disabled={inCorso} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">
        {inCorso ? 'Salvataggio in corso…' : 'Imposta la password'}
      </button>
    </form>
  );
}
