import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { schemaAssetPubblico } from '@gestilab/shared';
import { z } from 'zod';

import { risolviDaCodiceBreve, risolviDaQrToken, type DipendenzePubblicoAsset } from './servizio.js';

const schemaParametroToken = z.object({ token: z.string().min(1).max(64) });
const schemaParametroCodice = z.object({ codice: z.string().min(1).max(12) });

// Superficie più esposta del sistema (docs/CLAUDE.md regola 6, docs/06-
// sicurezza-gdpr.md § 2.5): pubblico (nessuna sessione, come /docente/*),
// ma tenant-scoped — pluginTenant, registrato dal chiamante. Nessun id
// incrementale nell'URL: solo il token/codice opachi.
export async function rottePubblicoAsset(app: FastifyInstance, deps: DipendenzePubblicoAsset): Promise<void> {
  const tipizzata = app.withTypeProvider<ZodTypeProvider>();

  tipizzata.get(
    '/asset/qr/:token',
    {
      schema: { params: schemaParametroToken, response: { 200: schemaAssetPubblico } },
      // Per il token, non per IP (quello lo copre già il limite globale di
      // default, plugin/rate-limit.ts): una classe intera che scansiona lo
      // stesso QR in pochi minuti da dispositivi diversi non deve bloccarsi
      // a vicenda — ma uno scraping aggressivo sullo stesso bene sì.
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute',
          keyGenerator: (richiesta: FastifyRequest) => (richiesta.params as { token: string }).token,
        },
      },
    },
    async (richiesta, risposta) => {
      const esito = await risolviDaQrToken(deps, richiesta.tenantId!, richiesta.params.token);
      return risposta.header('cache-control', 'no-store').send(esito);
    },
  );

  tipizzata.get(
    '/asset/codice-breve/:codice',
    {
      schema: { params: schemaParametroCodice, response: { 200: schemaAssetPubblico } },
      // Più stretto del QR: un codice a 6 caratteri ha molta meno entropia
      // di un token a 22 (docs/01-dominio.md) — un limite basso per chiave
      // scoraggia un tentativo di indovinarlo per tentativi.
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute',
          keyGenerator: (richiesta: FastifyRequest) => (richiesta.params as { codice: string }).codice.toUpperCase(),
        },
      },
    },
    async (richiesta, risposta) => {
      const esito = await risolviDaCodiceBreve(deps, richiesta.tenantId!, richiesta.params.codice);
      return risposta.header('cache-control', 'no-store').send(esito);
    },
  );
}
