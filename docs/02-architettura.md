# 02 — Architettura, Docker, tenancy e routing

## Tre repository

GestiLab è diviso in tre repository: questo (`gestilab-app`, codice applicativo, Dockerfile, CI/CD, ambiente di sviluppo locale), [`gestilab-auth-service`](https://github.com/mario-sica/gestilab-auth-service) (autenticazione, **privato**) e [`gestilab-infra`](https://github.com/mario-sica/gestilab-infra) (deploy di produzione, `compose.prod.yaml`, Traefik prod). Il `README.md` di questo repository spiega perché; questo documento descrive solo ciò che vive qui.

## Servizi

| Servizio | Immagine / base | Ruolo | Porta interna |
|---|---|---|---|
| `proxy` | traefik:v3 | TLS, routing per host, redirect HTTPS | 80/443 |
| `web` | node:22-alpine (build multi-stage) | Next.js 15, SSR + PWA | 3000 |
| `api` | node:22-alpine | Fastify, REST + OpenAPI | 3001 |
| `worker` | stessa immagine di `api`, entrypoint diverso | BullMQ: PDF, email, ricorrenze, notifiche | — |
| `db` | postgres:16-alpine | dati, RLS | 5432 |
| `redis` | redis:7-alpine | code e cache | 6379 |
| `storage` | minio/minio | S3-compatibile (in produzione può essere un servizio esterno UE) | 9000/9001 |
| `mailpit` | axllent/mailpit | cattura email in locale; in produzione sostituito da un provider SMTP via env | 8025 |
| `glitchtip` | glitchtip/glitchtip | error tracking, API compatibile con l'SDK Sentry; solo un cambio di DSN per passare a Sentry | 8000 |

## File compose e profili

Un solo stack, tre profili. **Non esistono rami di codice diversi fra locale e produzione**: cambiano solo le variabili d'ambiente.

| File | Profilo | Dove vive | Quando |
|---|---|---|---|
| `compose.yaml` | base | questo repository | definizione condivisa dei servizi |
| `compose.dev.yaml` | `dev` | questo repository | sviluppo quotidiano: bind mount, hot reload, porte su localhost, mailpit, adminer, seed |
| `compose.local-prod.yaml` | `local-prod` | questo repository | verifica di prontezza: immagini buildate, Traefik con CA locale, HTTPS su `*.gestilab.test`, backup attivi, nessun bind mount |
| `compose.prod.yaml` | `prod` | [`gestilab-infra`](https://github.com/mario-sica/gestilab-infra) | scritto e versionato, **non ancora eseguito**: Traefik con Let's Encrypt DNS-01, restart policy, limiti risorse |

`local-prod` è il profilo che dimostra la prontezza alla produzione senza spendere nulla: è identico a `prod` tranne l'emittente del certificato e il dominio di base. Ogni volta che si tocca infrastruttura, si riverifica lì.

`compose.prod.yaml` vive in un repository diverso (`gestilab-infra`) come overlay di `compose.yaml`: è un artefatto di *deploy*, non di sviluppo, coerente con la separazione in tre repository (vedi `README.md` di questo repository per il quadro completo). `compose.local-prod.yaml` resta qui perché è uno strumento di verifica locale, non un artefatto che si esegue mai fuori dalla macchina di sviluppo.

Regole:
- Immagini multi-stage: `deps` → `build` → `runner`. `runner` contiene solo dipendenze di produzione e output di build; utente `node`, non root.
- Nessun segreto nelle immagini o nei compose versionati: `.env.example` versionato, `.env` in `.gitignore`.
- Healthcheck su tutti i servizi; `depends_on` con `condition: service_healthy`.
- Migrazioni in container one-shot, mai all'avvio dell'app.
- Volumi nominati: `pgdata`, `miniodata`, `glitchtipdata`. Mai bind mount di dati.
- `.dockerignore` esclude `node_modules`, `.next`, `dist`, `.git`, `*.md`.
- **Nessun servizio a pagamento nel percorso.** Ogni dipendenza esterna ha un equivalente in container: MinIO per S3, Mailpit per l'email, GlitchTip per l'error tracking, mkcert per i certificati. Il passaggio a un servizio esterno è un cambio di variabile.

## Multi-tenancy

### Indirizzi

**Oggi (locale, costo zero).** Il TLD `.test` è riservato dalla RFC 2606: non registrabile, non risolvibile su Internet, nessun rischio di fuga di dati verso l'esterno.

| Host locale | Servizio |
|---|---|
| `dellaquila.gestilab.test` | tenant pilota |
| `demo.gestilab.test` | secondo tenant, verifica isolamento |
| `app.gestilab.test` | "trova il tuo istituto" |
| `console.gestilab.test` | back-office fornitore |

**Domani (produzione).** Gli stessi host su `gestilab.it`, più il sito vetrina su apex e `www`.

Slug riservati (identici nei due ambienti): elenco in `SLUG_RISERVATI`, `packages/shared/src/slug.ts` — unica fonte di verità, non ripetere l'elenco in questo documento.

La variabile `BASE_DOMAIN` (`gestilab.test` oppure `gestilab.it`) è l'unico punto in cui il dominio compare. **Nessun dominio hardcoded nel codice**, nemmeno nei test o nella generazione dei QR: un dominio scritto a mano da qualche parte è un difetto bloccante.

### Risoluzione del tenant
1. `middleware.ts` di Next.js legge l'`Host`, estrae lo slug, esclude i riservati.
2. Lookup su cache in memoria (TTL 60 s) → tabella `istituti`. Tenant inesistente, cessato, o slug non valido → **404**, mai un messaggio che riveli l'esistenza di altri tenant.
3. Lo slug viene messo nei request headers interni (`x-tenant-slug`, `x-tenant-id`) e consumato dai server component.
4. Le chiamate del browser vanno a `/api/*` sullo stesso host; il proxy Next.js inoltra all'API aggiungendo il tenant risolto lato server. **L'header del client non è mai attendibile**: l'API lo rivalida contro la sessione.

### Isolamento a livello database
```sql
-- ruolo applicativo, non proprietario, senza BYPASSRLS
CREATE ROLE app_user NOLOGIN;
ALTER TABLE asset ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON asset
  USING (istituto_id = current_setting('app.tenant_id', true)::uuid);
```
Ogni richiesta apre una transazione con:
```sql
SET LOCAL ROLE app_user;
SET LOCAL app.tenant_id = '<uuid>';
```
Incapsulato in un helper `withTenant(tenantId, fn)`; nessuna query di dominio fuori da quell'helper. Le migrazioni usano una connessione separata con l'utente owner.

**Test obbligatorio in CI**: per ogni endpoint, richiesta autenticata come tenant A su risorsa del tenant B → 404.

### Provisioning tenant (task 1.6)
Comando per il fornitore, non per l'admin dell'istituto (che a questo punto non esiste ancora):
```
pnpm tenant:create --slug dellaquila --nome "IISS M. Dell'Aquila - S. Staffa" \
  --meccanografico FGIS00100X --tipologia IISS \
  --admin-email admin@dellaquila.it --admin-nome Mario --admin-cognome Rossi
```
Crea istituto, anno scolastico corrente (convenzione settembre–agosto, dedotta dalla data di sistema) e admin iniziale con invito — chiama `POST /inviti` di gestilab-auth-service come farebbe `apps/api`, e stampa il link in console (nessuna coda email: per un comando eseguito una volta dal fornitore non serve `apps/worker`). Uno slug già esistente è un errore bloccante, a differenza di `pnpm db:seed` che è idempotente sui dati demo.

Non precarica tipi asset, guide rapide, template risposta o checklist di sistema: quegli schemi non esistono ancora (arrivano con le fasi 2 e 4) — precaricarli ora userebbe dati inventati per un contratto destinato a cambiare. Il tenant nasce navigabile e pronto per l'onboarding via invito; il resto del censimento è responsabilità dell'admin una volta dentro.

## Routing applicativo

```
/                     -> se sessione valida, redirect all'area; altrimenti scelta area
/q/{token}            -> pagina pubblica QR (nessun login); senza token, form per il codice breve
/s/{token_tracking}   -> stato segnalazione per il segnalante

/docente/login        -> nome da elenco + PIN (o SSO)
/docente              -> le mie segnalazioni
/docente/nuova        -> nuova segnalazione senza QR
/docente/segnalazioni/{id}

/tecnico/login        -> email + password | SSO, 2FA opzionale
/tecnico              -> "Oggi": task in scadenza, segnalazioni aperte, alert
/tecnico/scan         -> scansione QR (camera)
/tecnico/asset, /tecnico/asset/{id}
/tecnico/interventi, /tecnico/segnalazioni, /tecnico/task
/tecnico/ricognizione

/admin/login          -> email + password | SSO, 2FA obbligatoria
/admin                -> cruscotto
/admin/istituto, /admin/plessi, /admin/ambienti
/admin/personale, /admin/utenti, /admin/affidamenti
/admin/asset, /admin/etichette
/admin/task, /admin/richieste, /admin/report, /admin/ricognizioni
/admin/impostazioni   -> PIN docente, pagina pubblica, captcha, branding
```

Regole:
- Ruolo sbagliato per l'area → **403 con link all'area corretta**, non redirect al login.
- Cookie distinti per area: `gl_s_doc`, `gl_s_tec`, `gl_s_adm`. `HttpOnly`, `Secure`, `SameSite=Lax`, `Domain` limitato al sottodominio del tenant.
- Durate: docente 12 h, tecnico 30 giorni con refresh scorrevole, admin 8 h.
- Il Supervisore entra da `/admin/login` e vede l'area admin in sola lettura.
- Le pagine `/q/...` e `/s/...` sono renderizzate server-side, senza JS bloccante, budget < 150 KB di JS, nessun accesso alle API autenticate.

## Ambienti

### Sviluppo (`pnpm dev`)
- `http://dellaquila.localhost:3000`: i browser risolvono `*.localhost` da soli, niente DNS da configurare, hot reload immediato.
- Adatto al 90% del lavoro. Non adatto a Service Worker, Web Push e camera: quelli richiedono HTTPS.
- Seed con due tenant (`dellaquila`, `demo`) per verificare l'isolamento a occhio.

### Locale con TLS (`pnpm local-prod`)
- `https://dellaquila.gestilab.test`: immagini buildate, Traefik, certificato emesso da una CA locale mkcert, cookie `Secure` attivi, service worker registrato, push funzionante.
- Risoluzione DNS via `dnsmasq` (`address=/gestilab.test/127.0.0.1`) oppure poche righe in `/etc/hosts`.
- È qui che si provano: PWA installabile, notifiche push, scansione da telefono sulla stessa rete, backup e ripristino.
- **Un cambiamento infrastrutturale non è concluso finché non è verificato in questo profilo.**

### Produzione (non ancora attiva)
`compose.prod.yaml` vive in [`gestilab-infra`](https://github.com/mario-sica/gestilab-infra), non in questo repository: esiste, versionato e mantenuto, ma non è mai stato eseguito. Contiene: Traefik con Let's Encrypt DNS-01 per il wildcard, `restart: unless-stopped`, limiti CPU e memoria, nessuna porta esposta oltre 80 e 443, log a livello `info`.

Quando arriverà il momento, il passaggio è: registrare il dominio, puntare il DNS wildcard al VPS, impostare `BASE_DOMAIN`, il token del provider DNS e i DSN dei servizi esterni, poi la procedura di deploy documentata nel `README.md` di `gestilab-infra` (clona la release di questo repository, invoca `docker compose` con entrambi gli overlay). Nessuna modifica al codice.

## Prontezza alla produzione, dimostrata in locale

Non si dichiara "production ready" un sistema mai messo alla prova. Queste tre prove si eseguono nel profilo `local-prod` e si documentano con esito e data:

1. **Ripristino**: distruggi il volume `pgdata`, ripristina dall'ultimo backup, verifica che i dati del seed e le foto su MinIO tornino. Misura il tempo.
2. **Aggiornamento con migrazione**: versione N in esecuzione, build della N+1 con una migrazione, avvio, verifica che nessuna richiesta fallisca durante il passaggio.
3. **Rollback**: torna alla N con il database già migrato alla N+1. Se non funziona, la migrazione non era retro-compatibile ed è un difetto da correggere subito, non alla prima emergenza.

Ripetile a ogni modifica strutturale. Il registro di queste prove serve anche come allegato tecnico nella trattativa con la scuola.

## Osservabilità senza costi
- Log JSON su stdout, raccolti da `docker compose logs`; in produzione, driver di log con rotazione.
- **GlitchTip** in container: API compatibile con l'SDK Sentry, quindi si integra con `@sentry/node` e `@sentry/nextjs` cambiando solo il DSN. Se un giorno si passa a Sentry gestito, cambia una variabile.
- Healthcheck interni su ogni servizio; controllo esterno solo quando il sistema sarà pubblico.
- Metriche delle code BullMQ esposte su un endpoint interno protetto.

## Backup in locale
Stessa procedura che userai in produzione, eseguita fin da subito:
- Dump giornaliero con `pg_dump` in un volume dedicato, retention 7 giorni in locale (30 in produzione).
- Archiviazione WAL configurata nel profilo `local-prod` per provare il ripristino a un istante preciso.
- MinIO replicato in una seconda cartella con `mc mirror`.
- Uno script `pnpm backup:verifica` che ripristina su un database temporaneo e conta le righe: un backup mai ripristinato non è un backup.

## Opzione self-hosted (scuola che vuole i dati in casa)
Stesso `compose.yaml` con un solo tenant, MinIO locale, Traefik con certificato interno o Let's Encrypt sul dominio della scuola. **Nessun ramo di codice separato**: vietato introdurre dipendenze da servizi cloud proprietari non sostituibili.

Nota commerciale: il fatto che il sistema giri interamente in locale non è solo un risparmio in fase di sviluppo, è anche la risposta pronta all'istituto che chiede dove stanno i suoi dati e al problema della qualificazione ACN.
