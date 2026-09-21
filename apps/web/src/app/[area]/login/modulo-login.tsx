'use client';

import { useActionState } from 'react';
import type { AreaSessione } from '@gestilab/shared';

import { accedi, type StatoLogin } from './azioni.js';

const TITOLO_PER_AREA: Record<AreaSessione, string> = {
  admin: 'Accesso amministratore',
  tecnico: 'Accesso tecnico',
};

const STATO_INIZIALE: StatoLogin = {};

export function ModuloLogin({ area }: { area: AreaSessione }): React.JSX.Element {
  // Niente accedi.bind(null, area): vedi il commento in azioni.ts.
  const [stato, azione, inCorso] = useActionState(accedi, STATO_INIZIALE);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">{TITOLO_PER_AREA[area]}</h1>
      <form action={azione} className="flex w-full max-w-sm flex-col gap-4">
        <input type="hidden" name="area" value={area} />
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Email</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="username"
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Password</span>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        {stato.errore && (
          <p role="alert" className="text-sm text-red-600">
            {stato.errore}
          </p>
        )}
        <button
          type="submit"
          disabled={inCorso}
          className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {inCorso ? 'Accesso in corso…' : 'Accedi'}
        </button>
      </form>
    </main>
  );
}
