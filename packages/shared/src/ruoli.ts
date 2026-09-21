import type { AreaSessione } from './sessione.js';

// Ruoli degli utenti (docs/01-dominio.md — Gruppo A: admin/AT/supervisore,
// non i docenti, che sono "persone"). Fonte unica: packages/db ne deriva
// l'enum Postgres (schema/utenti.ts), così la lista non vive in due posti.
export const RUOLI_UTENTE = ['admin', 'at', 'supervisore'] as const;

export type RuoloUtente = (typeof RUOLI_UTENTE)[number];

// docs/02-architettura.md § Aree: il Supervisore entra da /admin/login e
// vede l'area admin in sola lettura — stessa area dell'admin, ruolo
// diverso. Ogni ruolo ha una sola area: è ciò che permette di dire "vai
// all'area corretta" su un 403 (task 1.1) senza indovinare.
export const AREA_PER_RUOLO: Record<RuoloUtente, AreaSessione> = {
  admin: 'admin',
  supervisore: 'admin',
  at: 'tecnico',
};

// Vista inversa, derivata (non scritta a mano, altrimenti le due
// andrebbero mantenute sincronizzate): usata da gestilab-auth-service per
// rifiutare un login sull'area sbagliata.
export const RUOLI_PER_AREA: Record<AreaSessione, readonly RuoloUtente[]> = {
  admin: RUOLI_UTENTE.filter((ruolo) => AREA_PER_RUOLO[ruolo] === 'admin'),
  tecnico: RUOLI_UTENTE.filter((ruolo) => AREA_PER_RUOLO[ruolo] === 'tecnico'),
};

export function eRuoloUtente(valore: string): valore is RuoloUtente {
  return (RUOLI_UTENTE as readonly string[]).includes(valore);
}
