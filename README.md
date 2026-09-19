# GestiLab

Piattaforma SaaS multi-tenant per gli assistenti tecnici delle scuole superiori italiane: censimento attrezzature con QR, registro interventi, segnalazioni guasti dai docenti, task del DSGA, report patrimoniali. Questo repository è uno scheletro di monorepo (task 0.1 del backlog MVP): non contiene ancora logica applicativa, database o infrastruttura Docker.

## Come si avvia

Requisiti: Node.js 22 (vedi `.node-version`) e pnpm. Installa le dipendenze con `pnpm install`, poi verifica il codice con `pnpm lint`, `pnpm typecheck` e `pnpm build` (pipeline gestita da Turborepo). Copia `.env.example` in `.env` e valorizza le variabili prima di avviare `apps/api` in sviluppo con `pnpm --filter @gestilab/api dev`; `apps/web` si avvia con `pnpm --filter @gestilab/web dev`. La documentazione di riferimento del progetto è in `gestilab_doc/`.
