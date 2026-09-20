# Appunti — task 0.2 (Docker Compose)

## Stato: FATTO — stack completo, tutti i container healthy

`docker compose -f compose.yaml -f compose.dev.yaml up -d --build` porta su
tutti e 8 i servizi in stato `healthy` in circa 20 secondi (a immagini già
buildate/scaricate). Verificato anche con un ciclo `down` → `up` completo
(idempotente, dati preservati nei volumi nominati).

```
NAME                      SERVICE     STATUS
gestilab-app-adminer-1    adminer     healthy
gestilab-app-api-1        api         healthy
gestilab-app-db-1         db          healthy
gestilab-app-glitchtip-1  glitchtip   healthy
gestilab-app-mailpit-1    mailpit     healthy
gestilab-app-redis-1      redis       healthy
gestilab-app-storage-1    storage     healthy
gestilab-app-web-1        web         healthy
```

`http://localhost:3000` → `200`. `http://localhost:3001/api/v1/salute` →
`200`, body `{"stato":"ok"}`.

## Blocco iniziale (risolto): Docker Desktop corrotto, non il compose

La prima sessione di lavoro su questo task si era fermata perché **il motore
di Docker Desktop era danneggiato**: ogni pull di un'immagine non banale
falliva con `unexpected EOF` seguito da crash della VM QEMU
(`qemu: process terminated unexpectedly: signal: aborted`), e dopo
l'aggiornamento (4.54.0 → 4.91.0, che ha risolto il crash sui pull) restava
un problema più subdolo: le immagini scaricavano correttamente ma
**l'esecuzione falliva con `exec format error`** anche su binari amd64
corretti — corruzione sul disco persistente della VM, non riparabile con un
riavvio del servizio. Risolto con una pulizia dati completa di Docker Desktop
(Troubleshoot → Clean/Purge data), eseguita dall'utente dopo mia richiesta
esplicita (azione distruttiva, cancella tutte le immagini/volumi Docker
preesistenti sulla macchina — per questo non l'ho eseguita autonomamente).
Non è mai stato un problema della configurazione di questo repository.

## Problemi trovati e corretti durante la verifica reale

Una volta con un motore Docker sano, l'avvio ha comunque richiesto quattro
correzioni, tutte a bug miei nei file di configurazione:

1. **`minio/minio` non esiste più su Docker Hub** (licenza cambiata, immagine
   rimossa). Corretto: `quay.io/minio/minio`.
2. **Porta 5432 già occupata** da un PostgreSQL nativo sulla macchina host.
   Il container `db` resta in ascolto su 5432 internamente; solo la
   pubblicazione verso l'host in `compose.dev.yaml` è cambiata a `5433:5432`.
   `DATABASE_URL` non cambia: usa l'hostname Docker `db`, non l'host.
3. **Healthcheck di `web` e `api` su `http://localhost:...`**: nel container
   "localhost" risolve prima su `::1`, ma Node in ascolto su `0.0.0.0` non
   risponde lì (`Connection refused`) — bind IPv4-only. Corretto usando
   `127.0.0.1` esplicito nei due healthcheck.
4. **Comandi `command:` di `web`/`api` in `compose.dev.yaml` scritti come
   scalare YAML ripiegato (`>`) con `sh -c "..."` annidato**: la
   combinazione produceva un comando malformato (`sh: --store-dir: not
   found`). Riscritti come lista YAML esplicita
   (`["sh", "-c", "<comando>"]`), che non lascia ambiguità di parsing.
5. **`command:` di `glitchtip` (migrate + collectstatic + gunicorn a mano)**:
   falliva su due fronti — `collectstatic` con `PermissionError` (i file
   statici nell'immagine sono già collezionati, di proprietà di root; l'utente
   runtime `app` non può riscriverli) e poi `gunicorn: not found` (l'immagine
   usa Granian, non Gunicorn). Corretto eliminando il `command:` custom e
   usando `SERVER_ROLE=all_in_one`, la variabile d'ambiente che lo script di
   avvio ufficiale dell'immagine (`./bin/start.sh`) già supporta per eseguire
   migrazioni + web + worker in un solo processo — più semplice e corretto
   del comando scritto a mano.

## Decisioni prese dove la specifica era ambigua

(Le decisioni su `apps/api`/tsx, GlitchTip come servizio singolo, `adminer`
solo in dev, e i volumi `node_modules` per servizio sono le stesse già
motivate nella prima stesura di questo file: vedi commit precedente
"chore: docker compose setup (task 0.2)". Qui aggiungo solo quanto emerso
dalla verifica end-to-end.)

- **Database `glitchtip` separato**: confermato creato correttamente
  dall'init script (`docker/postgres/init/01-glitchtip-db.sql`), verificato
  con `\l` in psql dentro il container `db`.
- **`GLITCHTIP_EMBED_WORKER` non impostato esplicitamente**: `SERVER_ROLE:
  all_in_one` lo forza comunque a `true` dentro lo script di avvio
  ufficiale, quindi non serve duplicarlo.
