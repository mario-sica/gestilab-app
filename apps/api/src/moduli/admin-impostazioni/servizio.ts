import type { Db } from '@gestilab/db';
import type { Impostazioni, PinRigenerato } from '@gestilab/shared';

import type { ClientAuthService } from '../../servizi/auth-service.js';
import { leggiImpostazioni } from './repository.js';

export interface DipendenzeAdminImpostazioni {
  db: Db;
  authService: ClientAuthService;
}

export async function impostazioni(deps: DipendenzeAdminImpostazioni, tenantId: string): Promise<Impostazioni> {
  return leggiImpostazioni(deps.db, tenantId);
}

/**
 * Task 1.4: la rigenerazione la fa gestilab-auth-service (hash Argon2id +
 * revoca delle sessioni docente nella stessa transazione); apps/api decide
 * solo CHI può chiederla (ruolo admin, rotte.ts) e passa il PIN al
 * chiamante una volta — non lo conserva né lo logga (redact su "pin").
 */
export async function rigeneraPinDocente(deps: DipendenzeAdminImpostazioni, tenantId: string): Promise<PinRigenerato> {
  return deps.authService.rigeneraPinIstituto(tenantId);
}
