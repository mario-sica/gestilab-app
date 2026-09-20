# Appunti — task 0.2b (profilo local-prod: Traefik + mkcert)

## Stato: FATTO — tutti gli 8 container healthy, HTTPS verificato

`pnpm local-prod` (= `docker compose -f compose.yaml -f compose.local-prod.yaml
up`) porta su tutto lo stack con immagini buildate (nessun bind mount, nessun
target `deps`). Verificato con un ciclo `down` → `up --build` completo.

```
NAME                      SERVICE     STATUS                 PORTS
gestilab-app-api-1        api         healthy                3001/tcp (interno)
gestilab-app-db-1         db          healthy                5432/tcp (interno)
gestilab-app-glitchtip-1  glitchtip   healthy                8000/tcp (interno)
gestilab-app-mailpit-1    mailpit     healthy                1025,1110,8025/tcp (interno)
gestilab-app-proxy-1      proxy       healthy                0.0.0.0:80, 0.0.0.0:443
gestilab-app-redis-1      redis       healthy                6379/tcp (interno)
gestilab-app-storage-1    storage     healthy                9000/tcp (interno)
gestilab-app-web-1        web         healthy                3000/tcp (interno)
```

Solo `proxy` pubblica porte sull'host (80/443): tutti gli altri servizi sono
raggiungibili solo sulla rete Docker interna, come richiesto ("nessuna porta
esposta oltre 80 e 443").

`https://dellaquila.gestilab.test` → `200`, certificato verificato senza
warning (niente `curl -k`): emesso da mkcert, riconosciuto perché la CA
locale è installata nel trust store di sistema (`mkcert -install`).
`http://dellaquila.gestilab.test` → `301` verso l'equivalente HTTPS.
Stessa verifica ripetuta con successo su `demo.`, `app.`, `console.` —
l'intero host table documentato in `docs/02-architettura.md`.

## Cosa ha richiesto l'intervento dell'utente (sudo)

Non ho sudo passwordless in questa sessione. L'utente ha eseguito, nell'ordine:

```bash
sudo dnf install -y mkcert nss-tools
mkcert -install                 # NON con sudo davanti: aggiorna il trust
                                 # store dell'utente (browser), non quello
                                 # di root; mkcert chiede lui la password se
                                 # deve toccare anche lo store di sistema.
echo '127.0.0.1 dellaquila.gestilab.test demo.gestilab.test app.gestilab.test console.gestilab.test' | sudo tee -a /etc/hosts
```

Ho generato io il certificato dopo (non serve sudo, solo il binario mkcert e
la CA già create):

```bash
mkcert -cert-file docker/traefik/certs/gestilab.test.pem \
       -key-file docker/traefik/certs/gestilab.test-key.pem \
       "*.gestilab.test" gestilab.test
```

I `.pem` non sono versionati (vedi `.gitignore`): sono legati alla CA locale
di questa macchina. Chi clona il repo deve rigenerarli — istruzioni in
`docker/traefik/certs/README.md`.

## Bug trovati e corretti durante la verifica reale

Quattro problemi, tutti scoperti solo mettendo davvero in piedi il profilo
(la build `runner` non era mai stata eseguita end-to-end prima: il profilo
dev usa lo stage `deps` con bind mount, mai `runner`):

1. **`apps/web/public` non esisteva** (task 0.1 non l'aveva creata: "solo la
   pagina di default"). Il Dockerfile la copia nello stage `runner` e la
   build falliva (`"/app/apps/web/public": not found`). Creata la cartella
   con un `.gitkeep`.
2. **`apps/api` runner: `Command "tsx" not found`**. Il `CMD` faceva
   `pnpm exec tsx ...` con `WORKDIR=/app` (radice del monorepo): in un
   workspace pnpm i binari di un pacchetto vivono nel `node_modules/.bin`
   di *quel* pacchetto (`apps/api/node_modules/.bin/tsx`), non alla radice.
   Corretto con `pnpm --filter @gestilab/api exec tsx src/server.ts`, che
   esegue nel contesto giusto.
3. **`apps/web` runner: healthcheck sempre `Connection refused` su
   `127.0.0.1:3000`, pur con server "Ready"**. Causa: Docker imposta di
   default la variabile d'ambiente `HOSTNAME` (l'id del container, es.
   `241420cd7378`); il server standalone di Next.js la legge proprio come
   indirizzo di bind (`process.env.HOSTNAME || '0.0.0.0'`), quindi ascoltava
   su un hostname irraggiungibile invece che su `0.0.0.0`. Corretto
   sovrascrivendo esplicitamente `HOSTNAME=0.0.0.0` nell'environment del
   servizio `web` in `compose.yaml` (si applica a qualunque profilo usi lo
   stage `runner`, quindi anche al futuro `prod`).
4. **Traefik: `Host()` con più argomenti rifiutato** — `error while adding
   rule Host: unexpected number of parameters; got 4, expected one of [1]`.
   In Traefik v3 (diversamente da v2) `Host()` accetta un solo hostname per
   chiamata; per più host si combina con `||`. Corretta la label del router
   in `compose.local-prod.yaml`.

## Decisioni prese dove la specifica era ambigua

- **Routing**: solo `web` è esposto da Traefik, sui quattro host documentati
  in `docs/02-architettura.md` (dellaquila/demo/app/console.gestilab.test).
  `api` resta raggiungibile solo sulla rete Docker interna: l'architettura
  descrive `/api/*` come proxato dal frontend Next.js verso l'API (non
  ancora implementato, task successivo), non come un host Traefik a parte.
- **Nessuna route per mailpit/minio/glitchtip in local-prod**: coerente con
  "nessuna porta esposta oltre 80 e 443". Per ispezionarli in questo
  profilo serve `docker compose exec`/`logs`, non il browser — comportamento
  corretto per un profilo che imita la produzione.
- **CA e certificato non versionati**: solo `docker/traefik/certs/README.md`
  è in git: istruzioni, non segreti. `docker/traefik/certs/*.pem` è in
  `.gitignore`.
- **`/etc/hosts` invece di `dnsmasq`**: la macchina ha `dnsmasq` installato
  ma non attivo/integrato con NetworkManager; configurarlo come resolver di
  sistema è un cambiamento più invasivo (rischio di interferire con la
  risoluzione DNS normale) per un guadagno minimo dato che i quattro host
  serviti oggi sono pochi e noti. `/etc/hosts` non supporta wildcard: un
  futuro slug di tenant andrà aggiunto a mano finché non si passa a
  `dnsmasq` (opzione lasciata nel README dei certificati).

## Bug post-consegna: `pnpm dev` rotto dopo aver usato `pnpm local-prod`

Segnalato dall'utente dopo la consegna della 0.2b. Riprodotto: `web` usciva
con `sh: pnpm: not found`, `api` con `EACCES` su `/pnpm-store/v11`.

**Causa**: `compose.yaml`, `compose.dev.yaml` e `compose.local-prod.yaml`
costruivano tutti la stessa immagine (`gestilab-app-web`/`gestilab-app-api`,
nome di default derivato dal progetto), differenziata solo dal `target` di
build (`deps` in dev, `runner` di default in local-prod). `docker compose up`
senza `--build` riusa un'immagine già presente con quel nome **a prescindere
dal target richiesto**: dopo un `pnpm local-prod`, l'immagine taggata
`gestilab-app-web` era quella `runner` (niente pnpm/corepack, utente `node`
non root); un successivo `pnpm dev` (che non passa `--build`) la riusava così
com'è, invece di ricostruirla per lo stage `deps`.

**Fix**: nome immagine esplicito e distinto per profilo
(`gestilab-web-dev`/`gestilab-api-dev` in `compose.dev.yaml`,
`gestilab-web-local-prod`/`gestilab-api-local-prod` in
`compose.local-prod.yaml`), così i due profili non possono più scambiarsi
un'immagine costruita per lo stage sbagliato. Riverificato: `pnpm local-prod`
→ `down` → `pnpm dev` **senza** `--build` in mezzo, tutti gli 8 container
healthy, `localhost:3000` e `localhost:3001/api/v1/salute` rispondono. Lo
stesso principio andrà applicato quando si scriverà `compose.prod.yaml`
(0.2c): nome immagine proprio, non condiviso con `local-prod`.

# Task 0.2c — compose.prod.yaml (scritto, mai eseguito)

`docker compose -f compose.yaml -f compose.prod.yaml config` passa pulito
(nessun servizio avviato: non c'è un dominio/VPS, per design di questa fase).
Stessa forma di `compose.local-prod.yaml` — stessi servizi, stesso routing su
`dellaquila`/`demo`/`app`/`console`, applicato il principio del nome
immagine distinto (`gestilab-web-prod`/`gestilab-api-prod`) imparato nel bug
precedente. Differenze, tutte in linea con quanto richiesto da
`docs/02-architettura.md`:

- `BASE_DOMAIN=gestilab.it` invece di `gestilab.test`.
- TLS: Let's Encrypt DNS-01 (`docker/traefik/traefik.prod.yml` + resolver
  ACME passato via CLI in `compose.prod.yaml`, letto da `ACME_EMAIL` e
  `DNS_PROVIDER` in `.env`) invece del certificato statico mkcert. Router
  `web` ha in più la label `tls.certresolver=letsencrypt`, necessaria solo
  con un resolver ACME nominato (local-prod usa il certificato di default
  del provider file, non serve specificarlo).
- `restart: unless-stopped` e limiti `mem_limit`/`cpus` su ogni servizio
  (valori prudenti, da ritarare quando ci sarà un VPS reale con le sue
  risorse effettive — non testati sotto carico).

`ACME_EMAIL` e `DNS_PROVIDER` sono in `.env.example` vuoti, con commento che
rimanda ai "Prerequisiti a spesa" del backlog: il provider DNS scelto
richiederà anche le proprie variabili di autenticazione (token/chiave API),
da aggiungere quando si sceglierà — non prima, e mai versionate.

# Task 0.3 — Drizzle: connessione, migrazioni, ruolo app_user, withTenant

## Stato: FATTO

Migrazione applicata nel container `api` (`pnpm db:migrate`), ruoli
verificati con `psql`, test `withTenant` verde, `pnpm lint`/`typecheck`/
`test`/`build` puliti su tutto il monorepo.

## Decisioni prese

- **Due ruoli, non uno**, seguendo alla lettera l'esempio SQL di
  `docs/02-architettura.md`: `app_user` (`NOLOGIN`, porta le policy RLS e i
  privilegi) e un nuovo `gestilab_app` (`LOGIN`, connessione applicativa,
  membro di `app_user`). Prima di questo task `DATABASE_URL` puntava al
  ruolo owner (`gestilab`, lo stesso di `POSTGRES_USER`) — coerente col
  commento già scritto nel task 0.1 ("utente applicativo, non owner") ma
  contraddetto dal valore. Corretto: `DATABASE_URL` ora usa `gestilab_app`;
  nuova `DATABASE_MIGRATE_URL` (ruolo owner) per le sole migrazioni, mai
  usata da codice applicativo (regola non negoziabile #1 di `docs/CLAUDE.md`).
- **`ALTER DEFAULT PRIVILEGES`** invece di un `GRANT` per tabella: le
  tabelle di dominio che arriveranno dal task 0.4 (create dal ruolo owner)
  concederanno i privilegi ad `app_user` automaticamente, senza dover
  ricordare un GRANT a ogni nuova migrazione.
- **Password di `gestilab_app` non nella migrazione SQL** (sarebbe un
  segreto versionato): la migrazione crea il ruolo senza password;
  `src/migrate.ts`, dopo aver applicato le migrazioni con la connessione
  owner, la imposta leggendola da `DATABASE_URL` con
  `ALTER ROLE ... WITH PASSWORD`. Postgres rifiuta un parametro bind lì
  (errore di sintassi: la clausola PASSWORD vuole un letterale, non un
  `$1`) — costruita a mano con quoting sicuro (username/password vengono
  da `.env`, non da input esterno, ma quotati comunque per correttezza).
- **`withTenant` testato senza tabelle di dominio** (non esistono ancora,
  arrivano con la 0.4): il test verifica il contratto — dentro la
  transazione `current_user = app_user` e `app.tenant_id` impostato,
  fuori nessuno dei due trapela — con una `SELECT current_setting(...)`,
  non con una tabella reale. Quando la 0.4 aggiungerà `asset` e le prime
  policy RLS, quello sarà il posto giusto per un test end-to-end con dati
  veri.
- **`packages/db/src/client.ts` non legge `process.env`**: la connessione
  la passa chi chiama (`migrate.ts`, i test, in futuro `apps/api`), dopo
  averla validata. Tiene il pacchetto testabile senza un ambiente globale
  implicito, e `DATABASE_MIGRATE_URL` resta fuori dallo schema Zod
  condiviso di `packages/shared/env.ts` (lo leggono solo le migrazioni, non
  ha senso richiederlo anche a `apps/web`, che non lo usa).
- **`apps/api` non usa ancora `packages/db`**: nessun endpoint di dominio in
  questo task, solo connessione/migrazioni/helper. Il wiring arriva con le
  prime rotte di dominio.

## Due bug collaterali trovati e corretti in `compose.dev.yaml`

1. **`CI=true` mancante**: appena `packages/db` ha avuto nuove dipendenze
   (drizzle-orm, postgres, drizzle-kit, tsx), il container `api` è uscito
   con `[ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY]` — pnpm chiede
   conferma interattiva prima di modificare `node_modules` quando il
   lockfile cambia, e nel container non c'è una TTY per rispondere.
   Aggiunta `CI: "true"` (convenzione che pnpm stesso documenta) alle
   `environment:` di `web` e `api`.
2. **Il container `api` non installava `packages/db`**: `pnpm db:migrate`
   esegue `pnpm --filter @gestilab/db run migrate` *dentro* il container
   `api` (così da `docs/CLAUDE.md`), ma il comando d'avvio di `api` in dev
   installava solo `--filter @gestilab/api...` (sé stesso + `packages/shared`,
   non `packages/db`) — `tsx: not found`. Aggiunto anche
   `--filter @gestilab/db...` all'install del container `api`.

## Altro

- **`turbo.json`**: il task `test` non passava `DATABASE_URL` al processo
  (Turborepo filtra le variabili d'ambiente per default, a meno di
  dichiararle esplicitamente) — `pnpm test` dalla radice falliva anche con
  `DATABASE_URL` esportata nella shell. Aggiunto `"env": ["DATABASE_URL"]`
  al task `test` in `turbo.json`.
- Il test di `packages/db` è di integrazione: richiede il servizio `db` del
  profilo dev raggiungibile su `DATABASE_URL`. Se lanciato a stack dev
  spento, fallisce con un errore di connessione chiaro — comportamento
  atteso, non un bug (`docs/04-convenzioni-codice.md`: "Integrazione |
  Vitest + Postgres in container").
