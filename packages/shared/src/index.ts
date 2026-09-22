export const VERSIONE_API = 'v1' as const;

export { SLUG_RISERVATI, eSlugRiservato, formatoSlugValido, slugValido } from './slug.js';

export type { Env } from './env.js';
export { leggiEnv } from './env.js';

export { ErroreDominio } from './errori.js';

export { AREE_SESSIONE, AREE_SESSIONE_UTENTE, COOKIE_PER_AREA, eAreaSessione } from './sessione.js';
export type { AreaSessione, AreaSessioneUtente } from './sessione.js';

export { AREA_PER_RUOLO, RUOLI_PER_AREA, RUOLI_UTENTE, eRuoloUtente } from './ruoli.js';
export type { RuoloUtente } from './ruoli.js';

export { CODA_EMAIL, schemaJobEmail, schemaJobEmailInvito } from './email.js';
export type { JobEmail, JobEmailInvito } from './email.js';

export { origineTenant } from './url-pubblico.js';

export { schemaNuovoInvitoUtente, schemaUtenteElenco } from './utenti.js';
export type { NuovoInvitoUtente, UtenteElenco } from './utenti.js';

export {
  MODALITA_ACCESSO_DOCENTE,
  MODALITA_ACCESSO_DOCENTE_SELEZIONABILI,
  schemaAggiornaImpostazioni,
  schemaImpostazioni,
  schemaPinRigenerato,
} from './impostazioni.js';
export type { AggiornaImpostazioni, Impostazioni, ModalitaAccessoDocente, PinRigenerato } from './impostazioni.js';

export { QUALIFICHE_PERSONA, schemaPersonaRicerca } from './persone.js';
export type { PersonaRicerca, QualificaPersona } from './persone.js';

export { schemaAccessoDocente } from './docente.js';
export type { AccessoDocente } from './docente.js';

export { CATEGORIE_ASSET, CATEGORIE_INVENTARIALI_ASSET, PROPRIETA_ASSET, STATI_ASSET, TIPI_CONTRATTO, TIPI_MOVIMENTO_ASSET } from './asset.js';
export type { CategoriaAsset, CategoriaInventarialeAsset, ProprietaAsset, StatoAsset, TipoContratto, TipoMovimentoAsset } from './asset.js';

export { schemaAsset, schemaListaAsset, schemaListaAssetQuery, schemaModificaAsset, schemaNuovoAsset } from './asset-api.js';
export type { Asset, ListaAsset, ListaAssetQuery, ModificaAsset, NuovoAsset } from './asset-api.js';

export { schemaAssetPubblico } from './asset-pubblico.js';
export type { AssetPubblico } from './asset-pubblico.js';
