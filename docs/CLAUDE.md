# GestiLab — istruzioni di progetto

Piattaforma SaaS multi-tenant per gli assistenti tecnici delle scuole superiori italiane: censimento attrezzature con QR, registro interventi, segnalazioni guasti dai docenti, task del DSGA, report patrimoniali.

## Documenti di riferimento
Leggi il documento pertinente **prima** di scrivere codice in quell'area. Non dedurre il modello dati dal codice esistente se il documento dice altro: il documento vince, e se il codice diverge segnalalo.

| File | Quando leggerlo |
|---|---|
| `docs/00-ripresa-sessione.md` | **Sempre, come primo passo di ogni nuova conversazione** |
| `docs/01-dominio.md` | Qualsiasi modifica a schema, entità, migrazioni, regole di dominio |
| `docs/02-architettura.md` | Docker, tenancy, routing, deploy, servizi |
| `docs/03-api.md` | Nuovi endpoint, contratti, errori, paginazione |
| `docs/04-convenzioni-codice.md` | Sempre, prima di creare file o cartelle |
| `docs/05-offline-pwa.md` | Sync, IndexedDB, service worker, mutazioni client |
| `docs/06-sicurezza-gdpr.md` | Auth, permessi, dati personali, log, allegati |
| `docs/07-backlog-mvp.md` | Scelta del prossimo task e definizione di "fatto" |

## Vincolo trasversale: locale, a costo zero, pronto per la produzione

Il progetto gira **interamente sulla macchina di sviluppo**. Nessun servizio a pagamento, nessun dominio registrato, nessun server remoto. Ma la qualità è quella di un sistema destinato alla produzione: il passaggio a un server pubblico deve essere un cambio di variabili d'ambiente.

Conseguenze operative, valide sempre:
- **Nessun dominio hardcoded.** Il dominio viene da `BASE_DOMAIN`. Un `gestilab.it` scritto in un sorgente, in un test o nella generazione dei QR è un difetto bloccante.
- **Nessun `if (NODE_ENV === 'production')` nella logica di dominio.** Le differenze ammesse fra ambienti riguardano solo emittente TLS, endpoint dei servizi, livello di log — e stanno nella configurazione, non nel codice.
- **Ogni dipendenza esterna ha un equivalente in container**: MinIO per S3, Mailpit per l'email, GlitchTip per l'error tracking (SDK Sentry, solo DSN diverso), mkcert per i certificati. Non proporre servizi a pagamento.
- **Non scrivere codice che presuppone di essere online**: niente chiamate a CDN esterne, niente font remoti, niente API di terze parti non sostituibili.
- Il profilo `local-prod` (HTTPS su `*.gestilab.test`) è dove si verificano service worker, push, cookie `Secure` e camera. Una modifica infrastrutturale non è conclusa finché non passa lì.

## Stack
- Monorepo pnpm + Turborepo: `apps/web` (Next.js 15, App Router, TS), `apps/api` (Fastify, TS), `apps/worker` (BullMQ), `packages/shared` (schemi Zod, tipi, costanti), `packages/db` (Drizzle: schema, migrazioni, seed).
- PostgreSQL 16 con Row Level Security. Drizzle ORM. Redis per le code. Storage S3-compatibile (MinIO in locale).
- Tutto gira in Docker Compose. Nessun comando che presupponga Postgres installato sull'host.

## Regole non negoziabili

1. **Isolamento tenant.** Ogni query su dati di tenant passa per una transazione con `app.tenant_id` impostato. Non scrivere mai un filtro `istituto_id` a mano come unica difesa, e non usare mai la connessione owner del database nel codice applicativo.
2. **Il tenant si ricava dall'host.** Mai da body, query string o header inviato dal client senza verifica. L'API accetta `X-Tenant-Slug` solo dal proprio frontend e lo rivalida.
3. **Interventi e audit log sono append-only.** Niente UPDATE o DELETE: una correzione è un nuovo record che referenzia il precedente.
4. **Nessun dato di studenti, mai.** Nessun campo, nessun import, nessun log.
5. **Nessuna metrica di produttività per persona.** Vincolo art. 4 L. 300/1970: niente geolocalizzazione, niente tempi automatici, niente classifiche tra AT. I report sono aggregati per ambiente. Se un requisito sembra chiederlo, fermati e chiedi.
6. **La pagina pubblica `/q/{token}` è la superficie più esposta.** Payload minimo, nessun dato personale, nessun seriale o numero d'inventario, rate limit sempre attivo.
7. **Offline-first per l'area tecnico.** Ogni mutazione dell'AT deve essere idempotente su un id generato dal client e accodabile.
8. **Validazione con Zod condivisa** tra `apps/web` e `apps/api` da `packages/shared`. Nessuno schema duplicato.
9. **Italiano** per interfaccia, contenuti, commenti di dominio, nomi di entità e colonne. Inglese per i termini tecnici di framework.
10. **Accessibilità WCAG 2.1 AA**: elementi interattivi raggiungibili da tastiera, label esplicite, contrasto verificato, `aria-live` sugli esiti di scansione.

## Come lavorare
- Prima di una modifica strutturale, proponi il piano e attendi conferma.
- Una modifica = un ambito. Non riscrivere file non richiesti, non riformattare codice estraneo al task.
- Ogni feature include: migrazione (se serve), schema Zod, endpoint, UI, test, aggiornamento del documento di riferimento se il contratto cambia.
- Se una specifica è ambigua o in conflitto, **chiedi**; non scegliere in silenzio.
- Non introdurre dipendenze nuove senza motivarlo. Preferisci la libreria standard.
- I test toccano: RLS cross-tenant, permessi per ruolo, sync offline, generazione e rotazione QR.

## Comandi
```bash
pnpm dev                 # profilo dev: http://dellaquila.localhost:3000, hot reload
pnpm local-prod          # profilo local-prod: https://dellaquila.gestilab.test, immagini buildate
pnpm db:migrate          # migrazioni Drizzle nel container api
pnpm db:seed             # dati demo (istituto "dellaquila", 2 lab, 30 asset); utenti admin@… e at@… con password "GestiLabDemo2026!"
pnpm tenant:create       # provisioning di un tenant reale: --slug --nome --meccanografico --tipologia --admin-email --admin-nome --admin-cognome (docs/02)
pnpm test                # unit + integrazione (Vitest)
pnpm e2e                 # Playwright (apps/web/e2e) contro lo stack dev già avviato con pnpm dev:auth
pnpm lint && pnpm typecheck
```
```bash
pnpm backup:crea         # dump + snapshot MinIO
pnpm backup:verifica     # ripristino su db temporaneo e conteggio righe
```
Accessi: app `http://dellaquila.localhost:3000` (dev) o `https://dellaquila.gestilab.test` (local-prod), API `:3001`, Mailpit `:8025`, MinIO `:9001`, GlitchTip `:8000`.

## Stato del progetto
Fase: MVP per il pilota su un singolo istituto, **eseguito solo in locale**. Priorità in `docs/07-backlog-mvp.md`. Non anticipare funzionalità V1/V2 se non richiesto esplicitamente, e non proporre attività che richiedano spesa (dominio, VPS, servizi gestiti): vanno segnalate come prerequisiti futuri, non incluse nel lavoro.
