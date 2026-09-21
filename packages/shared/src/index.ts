export const VERSIONE_API = 'v1' as const;

export { SLUG_RISERVATI, eSlugRiservato, formatoSlugValido, slugValido } from './slug.js';

export type { Env } from './env.js';
export { leggiEnv } from './env.js';

export { ErroreDominio } from './errori.js';

export { AREE_SESSIONE, COOKIE_PER_AREA, eAreaSessione } from './sessione.js';
export type { AreaSessione } from './sessione.js';

export { AREA_PER_RUOLO, RUOLI_PER_AREA, RUOLI_UTENTE, eRuoloUtente } from './ruoli.js';
export type { RuoloUtente } from './ruoli.js';
