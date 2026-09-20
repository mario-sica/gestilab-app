-- Ruoli per l'isolamento tenant via RLS (docs/02-architettura.md
-- § Isolamento a livello database):
--   - app_user: NOLOGIN, porta le policy RLS e i privilegi sulle tabelle.
--     Nessuno si connette come app_user direttamente.
--   - gestilab_app: LOGIN, connessione applicativa (non owner). Ogni
--     transazione fa "SET LOCAL ROLE app_user" per assumerne i privilegi
--     (vedi src/with-tenant.ts). Membro di app_user per poterlo fare.
--
-- La password di gestilab_app NON è in questo file: non è un segreto da
-- versionare. src/migrate.ts la imposta dopo, leggendola da DATABASE_URL.
--
-- Idempotente: rieseguibile a mano senza errori "already exists" (anche se
-- drizzle-kit non riapplica mai una migrazione già segnata come eseguita).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gestilab_app') THEN
    CREATE ROLE gestilab_app LOGIN;
  END IF;
END
$$;

GRANT app_user TO gestilab_app;

-- current_database() invece del nome letterale: questa migrazione gira
-- identica in dev, local-prod e prod, qualunque sia POSTGRES_DB.
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO gestilab_app', current_database());
END
$$;

GRANT USAGE ON SCHEMA public TO app_user;

-- Le tabelle di dominio arriveranno da migrazioni successive, create dal
-- ruolo owner (DATABASE_MIGRATE_URL): questo fa sì che app_user riceva
-- automaticamente i privilegi su ogni nuova tabella, senza un GRANT da
-- ricordare a ogni migrazione.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
