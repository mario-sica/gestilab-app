export const VERSIONE_API = 'v1' as const;

export { SLUG_RISERVATI, eSlugRiservato, formatoSlugValido, slugValido } from './slug.js';

export type { Env } from './env.js';
export { leggiEnv } from './env.js';

export { ErroreDominio } from './errori.js';

export { AREE_SESSIONE, COOKIE_PER_AREA, eAreaSessione } from './sessione.js';
export type { AreaSessione } from './sessione.js';

export { AREA_PER_RUOLO, RUOLI_PER_AREA, RUOLI_UTENTE, eRuoloUtente } from './ruoli.js';
export type { RuoloUtente } from './ruoli.js';

export { CODA_EMAIL, schemaJobEmail, schemaJobEmailInvito } from './email.js';
export type { JobEmail, JobEmailInvito } from './email.js';

export { origineTenant } from './url-pubblico.js';

export { schemaNuovoInvitoUtente, schemaUtenteElenco } from './utenti.js';
export type { NuovoInvitoUtente, UtenteElenco } from './utenti.js';

export { MODALITA_ACCESSO_DOCENTE, schemaImpostazioni, schemaPinRigenerato } from './impostazioni.js';
export type { Impostazioni, ModalitaAccessoDocente, PinRigenerato } from './impostazioni.js';
