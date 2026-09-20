# 04 — Struttura del repository e convenzioni di codice

GestiLab è diviso in tre repository (`docs/02-architettura.md` § Tre repository): questa struttura descrive **solo `gestilab-app`**. L'autenticazione (login, password, PIN, TOTP, emissione sessione) vive in `gestilab-auth-service`, repository separato e privato — non in `apps/api`. `apps/api` legge le sessioni da uno store condiviso (plugin `sessione`, non `auth`) e possiede l'autorizzazione (ruolo, perimetro tenant), non l'autenticazione.

## Struttura
```
gestilab/
├─ apps/
│  ├─ web/                  Next.js 15 (App Router)
│  │  ├─ src/app/
│  │  │  ├─ (pubblico)/q/[token]/      pagina QR
│  │  │  ├─ (pubblico)/s/[token]/      stato segnalazione
│  │  │  ├─ (docente)/docente/...
│  │  │  ├─ (tecnico)/tecnico/...
│  │  │  ├─ (admin)/admin/...
│  │  │  └─ api/[...proxy]/            proxy verso api con tenant risolto
│  │  ├─ src/componenti/    UI condivisa
│  │  ├─ src/funzionalita/  per dominio: asset/, interventi/, segnalazioni/, task/
│  │  ├─ src/lib/           client API, sessione, offline, qr
│  │  └─ middleware.ts      risoluzione tenant
│  ├─ api/
│  │  └─ src/
│  │     ├─ moduli/         asset/, interventi/, segnalazioni/, admin/
│  │     │   └─ <modulo>/{rotte.ts,servizio.ts,repository.ts,test/}
│  │     ├─ plugin/         sessione, tenant, rate-limit, errori, openapi
│  │     └─ server.ts
│  └─ worker/               job BullMQ: pdf, email, ricorrenze, pulizia
├─ packages/
│  ├─ shared/               schemi Zod, tipi, enum, costanti, messaggi errore
│  └─ db/                   schema Drizzle, migrazioni, seed, policy RLS
├─ docs/
├─ compose.yaml, compose.dev.yaml, compose.local-prod.yaml
└─ .env.example
```

## Regole di architettura interna
- **Un modulo API = rotte + servizio + repository.** Le rotte validano e chiamano il servizio; il servizio contiene le regole di dominio; il repository è l'unico posto che parla con Drizzle.
- Nessuna query nel livello rotte. Nessuna logica di dominio nel repository.
- Gli schemi Zod vivono in `packages/shared` e sono importati da API e web: **mai duplicare un tipo**.
- I tipi dedotti da Zod (`z.infer`) sono la fonte di verità per i DTO; i tipi Drizzle restano interni al repository.
- Nessun accesso al database fuori da `withTenant(...)`, tranne migrazioni e console fornitore (che usa un contesto esplicito e loggato).

## Naming
| Elemento | Regola | Esempio |
|---|---|---|
| Cartelle e file | `kebab-case`, italiano di dominio | `segnalazioni/chiudi-segnalazione.ts` |
| Componenti React | `PascalCase`, italiano | `SchedaAsset.tsx`, `FormSegnalazione.tsx` |
| Funzioni e variabili | `camelCase`, italiano per il dominio | `creaIntervento`, `ambientiAffidati` |
| Tabelle e colonne DB | `snake_case`, italiano | `interventi.data_ora` |
| Costanti | `SCREAMING_SNAKE_CASE` | `MAX_ALLEGATI_SEGNALAZIONE` |
| Test | `*.test.ts` accanto al file, e2e in `apps/web/e2e` | |
| Branch | `tipo/descrizione-breve` | `feat/segnalazioni-chiusura` |
| Commit | Conventional Commits in inglese | `feat(segnalazioni): add close flow` |

Italiano per il dominio, inglese per i termini tecnici del framework (`useState`, `middleware`, `handler`). Non tradurre "asset": è già entrato nel linguaggio della scuola ed è più corto di "attrezzatura".

## TypeScript
- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- **Vietato `any`.** Per l'ignoto si usa `unknown` più un parse Zod.
- Nessun `as` se non per branded types o dopo una verifica esplicita.
- Errori di dominio come classi tipizzate (`ErroreDominio` con `codice`), mai stringhe.
- Nessuna funzione esportata senza tipo di ritorno esplicito nelle API pubbliche dei moduli.

## React / Next.js
- Server Component per default; `"use client"` solo dove serve interattività (scansione, form, code offline).
- Recupero dati nei server component o tramite TanStack Query nei client component; niente `useEffect` per il fetch iniziale.
- Form con React Hook Form + resolver Zod dello schema condiviso.
- Nessuno stato globale se non necessario: contesto sessione, contesto coda offline, resto locale.
- Tailwind per lo stile; niente CSS-in-JS. Componenti base propri (bottone, campo, dialogo) invece di una libreria completa, per tenere il bundle della pagina pubblica sotto i 150 KB.
- L'area pubblica non importa nulla dalle aree autenticate: confine verificato da regola ESLint sugli import.

## Accessibilità (obbligatoria, non opzionale)
- Ogni campo ha una `label` associata; niente placeholder al posto della label.
- Target touch ≥ 44×44 px: l'AT usa l'app in piedi, con una mano.
- Contrasto ≥ 4.5:1; stato mai comunicato dal solo colore (icona + testo).
- Esiti di scansione e sincronizzazione annunciati con `aria-live="polite"`.
- Navigazione completa da tastiera nell'area admin; focus visibile mai rimosso.

## Test
| Livello | Strumento | Cosa copre |
|---|---|---|
| Unit | Vitest | regole di dominio, transizioni di stato, validazioni |
| Integrazione | Vitest + Postgres in container | repository, RLS, permessi, idempotenza |
| E2E | Playwright | flussi: docente segnala, AT chiude, admin genera report |
| Sicurezza | suite dedicata in CI | cross-tenant su ogni endpoint, ruolo errato, rate limit |

Regola: ogni bug corretto porta con sé un test che fallisce senza la correzione.

## CI (GitHub Actions)
Trigger: push su `dev` e pull request verso `dev` — non `main`. `main` (regola permanente, vedi "Flusso di lavoro git" più sotto) contiene solo lo scheletro del task 0.1 e non riceve altri commit: è `dev` il branch di integrazione reale, quello che la CI deve tenere verde.

Pipeline (task 0.8): `lint` → `typecheck` → `test` → `pnpm audit` → `build immagini`. Nessun push su registry: oggi non esiste un ambiente remoto che consumerebbe le immagini (il progetto gira solo in locale, vedi `docs/CLAUDE.md` — vincolo "locale, a costo zero"); si aggiunge quando servirà un vero deploy.

Passi ancora da aggiungere quando i loro prerequisiti esisteranno, non nel task 0.8: `e2e su compose` (Playwright non è ancora installato), coverage dei moduli di dominio < 70% (nessun modulo di dominio esiste ancora oltre `salute`), un endpoint senza dichiarazione di ruolo (l'autenticazione è Fase 1), un import che attraversa il confine pubblico/autenticato (quel confine non esiste ancora nel codice).

## Configurazione
- Ogni URL, dominio, credenziale ed endpoint viene da variabili d'ambiente, validate all'avvio con uno schema Zod (`packages/shared/env.ts`): un avvio con configurazione incompleta fallisce subito e con un messaggio chiaro, non alla prima richiesta.
- `BASE_DOMAIN` è l'unica fonte del dominio. La generazione degli URL QR la usa; nessun test contiene un dominio letterale.
- Nessun `if (NODE_ENV === 'production')` nella logica di dominio. Le differenze fra ambienti stanno nella configurazione.
- `.env.example` elenca ogni variabile con un commento e un valore di esempio locale; è il documento che spiega la configurazione.

## Cose da non fare
- Non aggiungere ORM, state manager o librerie UI alternative senza discussione.
- Non introdurre `console.log` in codice di produzione: logger strutturato.
- Non scrivere migrazioni distruttive in un solo passo (prima aggiungi, poi migra i dati, poi rimuovi in una release successiva).
- Non modificare mai a mano un file di migrazione già generato da `drizzle-kit` (nemmeno subito dopo averlo generato, prima di applicarlo): se serve SQL che Drizzle non emette da solo (es. `FORCE ROW LEVEL SECURITY`), va creata una migrazione aggiuntiva dedicata con `drizzle-kit generate --custom`, mai un'edit sul file esistente. Il registro delle migrazioni (`__drizzle_migrations`) traccia un hash del contenuto di ogni file: un file modificato dopo essere stato letto (o applicato) produce un disallineamento tra ciò che il registro dice essere girato e ciò che è realmente sul disco.
- Non mettere logica di business nelle route handler di Next.js: il frontend non è la fonte di verità.
- Non salvare dati personali nei log, nemmeno per debug.
- Non scrivere un dominio, un URL di servizio o una porta direttamente nel codice.
- Non introdurre dipendenze da servizi a pagamento o da API esterne non sostituibili: il sistema deve poter girare su una macchina scollegata da Internet.
- Non aggiungere una variabile d'ambiente letta con `process.env` in un nuovo test senza aggiungerla anche a `turbo.json` (`tasks.test.env`): Turborepo 2 gira in `envMode: strict` di default e filtra silenziosamente ogni variabile non dichiarata lì prima di lanciare lo script. Il test fallisce solo quando eseguito con `pnpm test` dalla radice (che passa da Turbo); eseguito direttamente con `pnpm --filter <pacchetto> test` funziona comunque, perché bypassa Turbo — un modo facile per non accorgersi del problema finché non lo esegue la CI.
