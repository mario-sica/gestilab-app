// Schema Drizzle. Gruppo A (organizzazione) dal task 0.4; i gruppi
// successivi (beni, software, attività, ricognizione, trasversali) arrivano
// con le fasi corrispondenti del backlog — vedi docs/01-dominio.md.
export * from './istituti.js';
export * from './utenti.js';
export * from './anni-scolastici.js';
export * from './plessi.js';
export * from './ambienti.js';
export * from './affidamenti-ambienti.js';
export * from './persone.js';
export * from './fornitori.js';
export * from './contratti.js';
export * from './tipi-asset.js';
export * from './asset.js';
export * from './movimenti-asset.js';

// Non più solo interno a questo pacchetto (prefisso "_" storico): serve
// anche a gestilab-auth-service (submodule su un tag di questo repo, vedi
// docs/02-architettura.md § Tre repository) per applicare la stessa policy
// alla propria tabella "sessioni", nello stesso database.
export { policyIsolamentoTenant } from './_rls.js';
