# Backup del database

Questa cartella contiene i dump di Postgres generati da `pnpm backup:crea`
(`packages/db/src/backup.ts`), in formato custom `pg_dump -Fc`. **Non
versionati** (vedi `.gitignore`): contengono dati reali dell'istituto.

Bind mount, non volume Docker nominato: un backup nello stesso volume dei
dati che dovrebbe proteggere sparirebbe insieme a loro con un
`docker compose down -v` (`docs/02-architettura.md`).

- `pnpm backup:crea` — nuovo dump con timestamp, elimina quelli più vecchi
  di 7 giorni (30 in produzione).
- `pnpm backup:verifica` — ripristina l'ultimo dump su un database
  temporaneo (`gestilab_verifica_backup`), conta le righe di ogni tabella e
  le confronta con l'originale, poi lo elimina. Un backup mai ripristinato
  non è un backup (`docs/06-sicurezza-gdpr.md` § 2.10).
