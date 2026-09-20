# 07 — Backlog MVP

Ordine di esecuzione consigliato. Ogni riga è un'unità di lavoro con una verifica esplicita: se la verifica non passa, il task non è chiuso.

Legenda dimensione: **S** ≤ mezza giornata, **M** 1-2 giorni, **L** 3-5 giorni.

## Vincolo di fase
Tutto l'MVP gira **in locale**. Nessun dominio registrato, nessun VPS, nessun servizio a pagamento. La prontezza alla produzione si dimostra col profilo `local-prod` e con le tre prove della Fase 7, non con un deploy.

## Fase 0 — Fondamenta

| # | Task | Dim | Fatto quando |
|---|---|---|---|
| 0.1 | Monorepo pnpm + Turborepo, `apps/web`, `apps/api`, `packages/shared`, `packages/db`, lint, typecheck | M | `pnpm lint && pnpm typecheck` verdi su repo vuoto |
| 0.2 | `compose.yaml` + `compose.dev.yaml` con web, api, db, redis, storage, mailpit, glitchtip; healthcheck e `.env.example` | M | `pnpm dev` avvia tutto; `http://localhost:3000` risponde |
| 0.2b | `compose.local-prod.yaml`: immagini buildate, Traefik, mkcert, `BASE_DOMAIN=gestilab.test` | M | `https://dellaquila.gestilab.test` risponde con certificato valido |
| 0.2c | `compose.prod.yaml` scritto e versionato, mai eseguito; differenze solo in env ed emittente TLS | S | Revisione a vista: nessuna differenza strutturale rispetto a `local-prod` |
| 0.3 | Drizzle: connessione, migrazioni, ruolo `app_user`, helper `withTenant` | M | Una migrazione applicata in container; helper testato |
| 0.4 | Schema iniziale: istituti, anni_scolastici, plessi, ambienti, utenti, affidamenti, persone | M | Migrazione + seed di 2 tenant |
| 0.5 | RLS su tutte le tabelle tenant + test che una query senza contesto tenant fallisce | M | Test di integrazione verde |
| 0.6 | Middleware Next.js: risoluzione tenant da host, cache 60 s, 404 su host ignoto | M | `dellaquila.localhost:3000` ok, `pippo.localhost:3000` → 404 |
| 0.7 | Plugin Fastify: errori, rate limit, OpenAPI, contesto tenant, logger | M | `/api/v1/salute` risponde; OpenAPI generato |
| 0.8 | CI: lint, typecheck, test, build immagini | S | Pipeline verde su main |
| 0.9 | Regola che vieta domini hardcoded (lint o test): tutto passa da `BASE_DOMAIN` | S | Un `gestilab.it` in un sorgente fa fallire la CI |
| 0.10 | Script `backup:crea` e `backup:verifica` | M | Ripristino su db temporaneo con conteggio righe corretto |

## Fase 1 — Accessi

| # | Task | Dim | Fatto quando |
|---|---|---|---|
| 1.1 | Sessioni server-side, cookie per area, helper `richiediRuolo()` | M | Test: ruolo errato → 403 con link corretto |
| 1.2 | `/admin/login` e `/tecnico/login`: email + password Argon2id, rate limit | M | Login e logout funzionanti, tentativi limitati |
| 1.3 | Invito utente via magic link e impostazione password | M | Flusso completo con mailpit |
| 1.4 | PIN d'istituto: generazione, hash, rigenerazione con revoca sessioni | M | Test di revoca |
| 1.5 | `/docente/login`: autocomplete persone + PIN, sessione 12 h | M | Ricerca "ros" trova "Rossi Mario"; PIN errato limitato |
| 1.6 | Console fornitore: creazione tenant con seed dati di base | M | `pnpm tenant:create` genera tenant navigabile |
| 1.7 | Test di sicurezza cross-tenant parametrico su tutti gli endpoint esistenti | M | Suite verde, eseguita in CI |

## Fase 2 — Beni e QR

| # | Task | Dim | Fatto quando |
|---|---|---|---|
| 2.1 | Schema asset, tipi_asset, movimenti, fornitori, contratti + seed catalogo tipi | M | Migrazione + 30 asset demo |
| 2.2 | CRUD asset area tecnico con perimetro affidamenti | L | AT non vede asset di ambienti non affidati (404) |
| 2.3 | Generazione `qr_token` e `codice_breve`, endpoint di risoluzione | S | Scansione risolve; codice breve risolve |
| 2.4 | Creazione asset da mobile in 5 campi + "crea N copie" | M | 25 PC creati in un'operazione |
| 2.5 | Import asset da CSV/Excel con report errori riga per riga | L | File con 3 righe errate → 3 errori puntuali, resto importato |
| 2.6 | PDF etichette (a4-24, a4-40, a4-65) con QR e codice breve | M | PDF stampato e scansionato con successo da telefono |
| 2.7 | Movimenti asset e storico ubicazioni | M | Cambio ambiente solo via movimento (test) |
| 2.8 | Rotazione QR con 410 per 90 giorni | S | Vecchio token → 410 con istruzioni |

## Fase 3 — Interventi

| # | Task | Dim | Fatto quando |
|---|---|---|---|
| 3.1 | Schema interventi append-only + revoca UPDATE/DELETE a livello DB | M | Tentativo di UPDATE fallisce dal ruolo applicativo |
| 3.2 | Registrazione intervento in ≤ 3 tap dalla scheda asset | M | Prova cronometrata su telefono reale |
| 3.3 | Correzione entro 24 h come nuovo record collegato | S | Originale visibile barrato |
| 3.4 | Intervento in bulk su N asset in una transazione | M | 25 interventi, un solo `gruppo_bulk_id` |
| 3.5 | Catalogo software e installazioni, vista "quali PC hanno X" | M | Vincolo unico parziale rispettato |
| 3.6 | Trigger audit log su asset, interventi, segnalazioni | M | Diff registrati e leggibili |

## Fase 4 — Segnalazioni (il cuore del valore percepito)

| # | Task | Dim | Fatto quando |
|---|---|---|---|
| 4.1 | Schema segnalazioni, messaggi, template, guide rapide + seed guide comuni | M | Guide "PC non si accende", "Proiettore senza segnale", "Stampante non stampa" |
| 4.2 | Pagina pubblica `/q/{token}` SSR, < 150 KB JS, senza dati personali | L | Lighthouse: performance ≥ 90 su 3G simulato |
| 4.3 | Guida rapida a passi con esito "risolto" registrato | M | Auto-risoluzione senza creare segnalazione |
| 4.4 | Form segnalazione con autocomplete persone, fallback nome libero, foto | L | Compilazione completa in < 30 s su telefono |
| 4.5 | "Anche io" su segnalazione aperta invece di duplicato | S | Nessun duplicato creato |
| 4.6 | Rate limit, captcha attivabile, cestino spam | M | 6ª segnalazione in un'ora → 429 |
| 4.7 | Gestione AT: stati, assegnazione, priorità, fuori competenza | M | Transizioni non valide → 409 |
| 4.8 | Risposta con template al segnalante e pagina `/s/{token}` | M | Docente vede "prova a controllare la spina" |
| 4.9 | Chiusura con esito e creazione intervento collegato | M | Un clic crea l'intervento |
| 4.10 | Notifica push + email all'AT affidatario | M | Push su Android, fallback email su iOS |
| 4.11 | Area `/docente`: le mie segnalazioni, nuova senza QR | M | Nome precompilato non modificabile |

## Fase 5 — Task e vista "Oggi"

| # | Task | Dim | Fatto quando |
|---|---|---|---|
| 5.1 | Schema task + creazione da Admin e da AT | M | Assegnazione e notifica |
| 5.2 | Completamento con evidenza (interventi, foto, nota) | M | Admin vede l'evidenza |
| 5.3 | Vista "Oggi" per l'AT: task, segnalazioni per priorità, alert | M | Caricamento < 1 s su dati demo |

## Fase 6 — Offline

| # | Task | Dim | Fatto quando |
|---|---|---|---|
| 6.1 | Cache IndexedDB per tenant+utente, sync delta | L | Schede asset consultabili offline |
| 6.2 | Outbox con validazione all'accodamento e backoff | L | 50 mutazioni offline sincronizzate senza duplicati |
| 6.3 | `POST /sync` batch idempotente con esito per mutazione | M | Doppio invio → nessun duplicato |
| 6.4 | Indicatore di stato e gestione mutazioni fallite | M | Nulla sparisce senza azione dell'utente |
| 6.5 | Service worker, app shell, prompt aggiornamento | M | App apribile senza rete |
| 6.6 | Foto offline compresse e inviate dopo la mutazione | M | 10 foto in coda inviate correttamente |

## Fase 7 — Report e chiusura MVP

| # | Task | Dim | Fatto quando |
|---|---|---|---|
| 7.1 | Registro interventi filtrabile + export CSV | M | Filtri per asset, ambiente, periodo, tipo |
| 7.2 | Relazione stato beni in PDF per ambiente e affidatario | L | PDF accettato dal DSGA pilota |
| 7.3 | Cruscotto Admin aggregato per ambiente (nessuna metrica per persona) | M | Revisione rispetto a `06-sicurezza-gdpr.md` §1.1 |
| 7.4 | Informative, bozza DPA, dichiarazione di accessibilità, modello per la RSU | M | Documenti consegnabili (la revisione legale è esterna) |
| 7.5 | **Prova di ripristino** nel profilo `local-prod` | M | Volume `pgdata` distrutto e ripristinato; dati e foto integri; tempo misurato e annotato |
| 7.6 | **Prova di aggiornamento con migrazione** | M | Versione N → N+1 senza richieste fallite durante il passaggio |
| 7.7 | **Prova di rollback** | M | N+1 → N con database già migrato: funziona. Se non funziona, la migrazione non era retro-compatibile |
| 7.8 | Prove su telefono reale via `local-prod` sulla LAN | M | Scansione QR, PWA installata, push ricevuta, foto caricata |
| 7.9 | Registro delle prove (esiti e date) come allegato tecnico | S | File versionato in `docs/prove/` |

### Prerequisiti a spesa, fuori da questa fase
Da affrontare **solo dopo** che l'AT pilota ha validato il sistema in locale:
- Registrazione dominio (~10-15 €/anno). È il prerequisito alle etichette QR definitive: prima si usano etichette provvisorie su carta.
- VPS in UE (~5-10 €/mese) e token API del provider DNS per il certificato wildcard.
- Eventuale provider email transazionale (i piani gratuiti coprono ampiamente un pilota).

## Definizione di "fatto" (vale per ogni task)
1. Test unitari e di integrazione per le regole nuove.
2. Nessuna regressione nella suite cross-tenant.
3. Nuove schermate verificate da tastiera e per contrasto.
4. Documento di riferimento aggiornato se il contratto è cambiato.
5. Nessun dato personale aggiunto ai log.
6. Provato su telefono reale, non solo nel simulatore del browser, per tutto ciò che l'AT o il docente useranno in piedi.
7. Nessun dominio, URL di servizio o credenziale scritti nel codice: tutto da variabili d'ambiente.
8. Se il task tocca infrastruttura, verificato anche nel profilo `local-prod`, non solo in `dev`.

## Fuori MVP (non implementare senza richiesta)
SSO, 2FA, consumabili e scorte, task ricorrenti e checklist template, richieste materiale, ricognizione, passaggio consegne, contratti e garanzie con alert, campi custom avanzati, branding, dominio personalizzato, SLA configurabili.
