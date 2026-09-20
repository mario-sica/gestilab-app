import { sql } from 'drizzle-orm';
import { pgPolicy } from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

// Policy identica per ogni tabella tenant-scoped (docs/02-architettura.md
// § Isolamento a livello database): una riga è visibile solo se il suo
// istituto_id coincide con app.tenant_id, impostato da withTenant per la
// durata della transazione. FORCE ROW LEVEL SECURITY va aggiunto a parte
// nella migrazione: enableRLS() di Drizzle emette solo ENABLE.
export function policyIsolamentoTenant(istitutoId: AnyPgColumn) {
  return pgPolicy('tenant_isolation', {
    using: sql`${istitutoId} = current_setting('app.tenant_id', true)::uuid`,
  });
}
