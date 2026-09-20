import { creaClient, trovaIstitutoAttivoDaSlug, type Db } from '@gestilab/db';
import { leggiEnv, slugValido, SLUG_RISERVATI } from '@gestilab/shared';

// Risoluzione tenant da host (docs/02-architettura.md § Risoluzione del
// tenant): estrae lo slug dal primo segmento dell'host, esclude i riservati,
// cerca l'istituto con una cache in memoria (TTL 60 s) per non interrogare
// il database a ogni richiesta.

const TTL_MS = 60_000;

interface VoceCache {
  istitutoId: string | null;
  scadenza: number;
}

const cache = new Map<string, VoceCache>();

let db: Db | null = null;
function ottieniDb(): Db {
  db ??= creaClient(leggiEnv().DATABASE_URL);
  return db;
}

const REGEX_IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Estrae il primo segmento dell'host (il candidato slug del tenant).
 * `null` se l'host non ha un sottodominio (es. il dominio di base da solo)
 * o se è un indirizzo IP: gli healthcheck Docker (`compose.yaml`) e le
 * chiamate interne al container colpiscono `127.0.0.1`, i cui "segmenti"
 * numerici (`127`, `0`, `0`, `1`) altrimenti verrebbero letti come un
 * tentativo di slug — un IP non è mai un sottodominio di tenant.
 */
export function estraiSlug(host: string): string | null {
  const hostname = host.split(':')[0] ?? '';
  if (REGEX_IPV4.test(hostname)) {
    return null;
  }
  const parti = hostname.split('.');
  if (parti.length < 2) {
    return null;
  }
  return parti[0] || null;
}

export function eSlugRiservato(slug: string): boolean {
  return (SLUG_RISERVATI as readonly string[]).includes(slug);
}

/**
 * Risolve lo slug in un istituto attivo. `null` = nessun istituto con
 * quello slug (host sconosciuto): il chiamante risponde 404, mai un
 * messaggio che riveli l'esistenza di altri tenant.
 */
export async function risolviTenant(slug: string): Promise<{ id: string } | null> {
  const adesso = Date.now();
  const voce = cache.get(slug);
  if (voce && voce.scadenza > adesso) {
    return voce.istitutoId ? { id: voce.istitutoId } : null;
  }

  const istituto = await trovaIstitutoAttivoDaSlug(ottieniDb(), slug);

  cache.set(slug, { istitutoId: istituto?.id ?? null, scadenza: adesso + TTL_MS });
  return istituto;
}

export function validoPerLookup(slug: string): boolean {
  return slugValido(slug);
}
