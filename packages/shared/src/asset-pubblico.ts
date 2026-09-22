import { z } from 'zod';

import { CATEGORIE_ASSET, STATI_ASSET } from './asset.js';

// GET /api/v1/pubblico/asset/{qr|codice-breve}/... (task 2.3): payload
// minimo per la pagina pubblica /q/{token} (docs/02-architettura.md § Routing,
// CLAUDE.md regola non negoziabile #6). Deliberatamente NON è schemaAsset:
// niente seriale, numero_inventario, valore_acquisto, fornitore/contratto,
// date — nulla che sia "dato patrimoniale" o utile a chi non ha nulla a che
// fare con quell'istituto. Solo ciò che conferma "hai inquadrato il bene
// giusto, ed è in questo stato".
export const schemaAssetPubblico = z.object({
  etichetta: z.string(),
  tipoAsset: z.string(),
  categoria: z.enum(CATEGORIE_ASSET),
  marca: z.string().nullable(),
  modello: z.string().nullable(),
  ambiente: z.string(),
  stato: z.enum(STATI_ASSET),
});
export type AssetPubblico = z.infer<typeof schemaAssetPubblico>;
