-- FORCE (oltre a ENABLE) fa applicare le policy anche al proprietario della
-- tabella: drizzle-kit genera solo ENABLE, FORCE va aggiunto a mano (vedi
-- src/schema/_rls.ts e migrations/0002_whole_thor_girl.sql, stesso motivo).
ALTER TABLE "fornitori" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "contratti" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tipi_asset" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "asset" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "movimenti_asset" FORCE ROW LEVEL SECURITY;
