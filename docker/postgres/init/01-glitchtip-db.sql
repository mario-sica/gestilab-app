-- Eseguito automaticamente da postgres:16-alpine alla prima inizializzazione
-- del volume "pgdata" (script in /docker-entrypoint-initdb.d/).
-- GlitchTip ha un proprio database, separato da quello applicativo, sullo
-- stesso utente e la stessa istanza Postgres.
CREATE DATABASE glitchtip;
