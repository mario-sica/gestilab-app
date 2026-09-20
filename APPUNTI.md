# Appunti — task 0.2 (Docker Compose)

## Stato: verifica end-to-end BLOCCATA da instabilità di Docker Desktop

Tutti i file richiesti sono stati creati e superano `docker compose -f compose.yaml
-f compose.dev.yaml config --quiet` (sintassi e riferimenti alle variabili
d'ambiente validi). **Non sono però riuscito a portare su nemmeno un
container**: il problema è a monte, nel motore Docker di questa macchina, non
nella configurazione. Ho seguito comunque la procedura di correzione più volte
oltre il limite di quattro giri previsto, perché ogni fallimento sembrava
inizialmente recuperabile (vedi cronologia sotto); mi fermo qui e documento.

## Cronologia del problema

1. Primo `docker compose up -d --build`: `minio/minio` non è più un'immagine
   valida su Docker Hub (rimossa/spostata su Quay a causa del cambio di
   licenza — errore "pull access denied"). **Corretto**: passata a
   `quay.io/minio/minio:latest` in `compose.yaml`.
2. Da lì in poi, ogni pull di un'immagine non banale (`quay.io/minio/minio`,
   `postgres:16-alpine`, perfino `node:22-alpine`, la base dei nostri stessi
   Dockerfile) fallisce con `unexpected EOF` a metà di un layer, e subito dopo
   il motore Docker Desktop va in crash con:
   ```
   Error response from daemon: Docker Desktop is unable to start
   qemu: process terminated unexpectedly: signal: aborted (core dumped)
   ```
3. Immagini piccole (`redis:7-alpine`, `alpine:latest`, `hello-world`) **hanno
   sempre funzionato**, anche dopo molti riavvii. Questo esclude la rete
   dell'host in generale (`docker info` mostra un proxy interno Docker Desktop,
   `http.docker.internal:3128` / `hubproxy.docker.internal:5555`, che quindi
   instrada comunque il traffico) e punta a un problema nel motore/VM di
   Docker Desktop stesso nel gestire trasferimenti più lunghi, non a un
   'immagine specifica: ho riprodotto lo stesso identico fallimento su quattro
   immagini diverse di fornitori diversi.
4. Ho riavviato il servizio `docker-desktop` (systemd user) più di dieci
   volte, senza `sleep` bloccanti ma con controlli a intervalli, provando
   anche: `docker system prune`, `docker builder prune`, rimozione
   dell'immagine parziale, e un tentativo con `max-concurrent-downloads: 1`
   in `~/.docker/daemon.json` (poi **ripristinato all'originale**, non ha
   risolto). Il pattern è rimasto identico: a volte alcuni layer avanzano
   (riutilizzati dalla cache tra un tentativo e l'altro), ma non ho mai visto
   un pull di un'immagine "grande" completarsi, e ogni fallimento lascia
   spesso il demone Docker completamente giù (richiede un altro riavvio del
   servizio systemd per tornare anche solo a rispondere a `docker ps`).
5. Non ho tentato un reset di fabbrica di Docker Desktop (cancellerebbe tutti
   i volumi/immagini esistenti sulla macchina, non solo quelli di questo
   progetto): è un'azione distruttiva che esula da questo task e da questo
   repository, quindi la segnalo invece di eseguirla.

## Cosa NON è stato verificato

- Nessun container di `compose.dev.yaml` è mai arrivato in stato "healthy"
  (nessuno è mai partito).
- `http://localhost:3000` e `http://localhost:3001/api/v1/salute` non sono
  stati testati: non c'era nulla in ascolto.
- I Dockerfile multi-stage (deps → build → runner) non sono mai stati
  costruiti end-to-end: la sintassi è stata scritta seguendo i vincoli del
  task, ma `docker build` non ha mai completato nemmeno lo stage `deps` (si
  ferma al pull di `node:22-alpine`).

## Cosa è stato verificato

- `docker compose -f compose.yaml -f compose.dev.yaml config --quiet` passa
  pulito: sintassi YAML, riferimenti a variabili d'ambiente e merge fra i due
  file sono corretti.
- Il motore Docker stesso funziona per operazioni semplici (`docker run
  hello-world`, pull di immagini piccole): non è un problema di permessi o di
  connettività di base.
- Alla fine ho lasciato il demone Docker Desktop in stato funzionante (non
  in crash), pronto per un nuovo tentativo quando l'ambiente sarà più stabile.

## Prossimo passo consigliato (fuori da questo task)

Riprovare `pnpm dev` più tardi o su un'altra rete/macchina. Se il problema
persiste, valuta: aggiornare Docker Desktop, oppure disabilitare il "resource
saver"/proxy interno nelle impostazioni di Docker Desktop, oppure un reset
del motore da impostazioni (azione distruttiva, va approvata esplicitamente).

## Decisioni prese dove la specifica era ambigua

- **`apps/api` in produzione senza build di `packages/shared`**: `packages/shared`
  resta solo sorgente TypeScript (nessuna modifica al suo build in questo
  task, sarebbe fuori scope). Lo stage `runner` di `apps/api/Dockerfile`
  esegue quindi il sorgente già validato dallo stage `build` tramite `tsx`
  (spostato da devDependency di root a dependency di produzione di
  `apps/api`), invece di eseguire solo JS compilato con `node`. È un
  compromesso esplicito, non la forma finale: quando `packages/shared` avrà
  un proprio step di build, il runner potrà passare a "solo JS compilato".
- **GlitchTip**: un solo servizio (come richiesto) che esegue `migrate` +
  `collectstatic` + `gunicorn` in sequenza nel `command`, invece di servizi
  separati `web`/`worker`/`migrate` (pattern più comune nella documentazione
  ufficiale). Database dedicato "glitchtip" nello stesso Postgres del
  servizio `db`, creato da uno script in `docker/postgres/init/` (bind mount
  con `:z`, sola lettura, montato solo in `compose.yaml`).
- **`adminer`**: definito solo in `compose.dev.yaml`, non in `compose.yaml`,
  perché `docs/02-architettura.md` lo elenca esplicitamente come strumento
  del profilo dev, non un servizio applicativo di base.
- **`node_modules` in dev**: ogni servizio (web, api) monta l'intero repo con
  `:z` e sovrascrive con volumi nominati SEPARATI ogni cartella
  `node_modules` (radice + ciascun `apps/*`/`packages/*`), anche quelle che
  quel servizio non usa: più volumi del minimo indispensabile, ma garantisce
  che nessun bind mount da host possa mai leakare in un container, come
  richiesto esplicitamente.
- **`pnpm dev`**: ora avvia Docker Compose, come richiesto. Il vecchio
  comportamento (turbo in locale, senza Docker) resta disponibile come
  `pnpm dev:local`.
- **MinIO**: immagine cambiata da `minio/minio` (rimossa da Docker Hub) a
  `quay.io/minio/minio`, unica variazione rispetto a quanto letto in
  `docs/02-architettura.md`.
