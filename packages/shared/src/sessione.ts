// Nomi dei cookie di sessione, uno per area (docs/06-sicurezza-gdpr.md §
// 2.2): fonte unica condivisa tra chi li legge (apps/api/src/plugin/
// sessione.ts) e chi li scrive dopo il login (apps/web) — altrimenti i due
// andrebbero mantenuti sincronizzati a mano. Solo admin/tecnico per ora:
// gestilab-auth-service non emette ancora sessioni docente (persona + PIN,
// task 1.5).
export const AREE_SESSIONE = ['admin', 'tecnico'] as const;

export type AreaSessione = (typeof AREE_SESSIONE)[number];

export const COOKIE_PER_AREA: Record<AreaSessione, string> = {
  admin: 'gl_s_adm',
  tecnico: 'gl_s_tec',
};

export function eAreaSessione(valore: string): valore is AreaSessione {
  return (AREE_SESSIONE as readonly string[]).includes(valore);
}
