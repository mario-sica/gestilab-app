// Nomi dei cookie di sessione, uno per area (docs/06-sicurezza-gdpr.md §
// 2.2): fonte unica condivisa tra chi li legge (apps/api/src/plugin/
// sessione.ts) e chi li scrive dopo il login (apps/web) — altrimenti i due
// andrebbero mantenuti sincronizzati a mano.
export const AREE_SESSIONE = ['admin', 'tecnico', 'docente'] as const;

export type AreaSessione = (typeof AREE_SESSIONE)[number];

// Le due aree i cui soggetti sono "utenti" (un ruolo in packages/db/utenti:
// admin/AT/supervisore, docs/01-dominio.md). L'area docente ha un'identità
// diversa — una "persona" dell'elenco segnalanti, niente ruolo, niente
// tabella utenti, PIN invece di password (task 1.5) — quindi non entra da
// /accedi né ha un ruolo che la mappi. Tipo separato, non un terzo valore
// buttato dentro RUOLI_PER_AREA/AREA_PER_RUOLO (ruoli.ts) o nella lettura
// sessione admin/tecnico (gestilab-auth-service/lettura,
// apps/api/src/plugin/sessione.ts, apps/web/src/lib/sessione.ts): quelle
// funzioni non saprebbero servire 'docente', ed è la funzione giusta a
// dover restare tipata sulle sole due aree che sa gestire, non a chi la
// chiama a ricordarsi di escludere 'docente' ogni volta.
export const AREE_SESSIONE_UTENTE = ['admin', 'tecnico'] as const;

export type AreaSessioneUtente = (typeof AREE_SESSIONE_UTENTE)[number];

export const COOKIE_PER_AREA: Record<AreaSessione, string> = {
  admin: 'gl_s_adm',
  tecnico: 'gl_s_tec',
  docente: 'gl_s_doc',
};

export function eAreaSessione(valore: string): valore is AreaSessione {
  return (AREE_SESSIONE as readonly string[]).includes(valore);
}
