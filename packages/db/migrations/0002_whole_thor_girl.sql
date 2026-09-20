-- FORCE (oltre a ENABLE) fa applicare le policy anche al proprietario della
-- tabella: drizzle-kit genera solo ENABLE, FORCE va aggiunto a mano (vedi
-- src/schema/_rls.ts). docs/02-architettura.md § Isolamento a livello
-- database usa entrambe nel suo esempio.
ALTER TABLE "utenti" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "utenti" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "anni_scolastici" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "anni_scolastici" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "plessi" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "plessi" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ambienti" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ambienti" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "affidamenti_ambienti" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "affidamenti_ambienti" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "persone" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "persone" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "utenti" AS PERMISSIVE FOR ALL TO public USING ("utenti"."istituto_id" = current_setting('app.tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "anni_scolastici" AS PERMISSIVE FOR ALL TO public USING ("anni_scolastici"."istituto_id" = current_setting('app.tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "plessi" AS PERMISSIVE FOR ALL TO public USING ("plessi"."istituto_id" = current_setting('app.tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "ambienti" AS PERMISSIVE FOR ALL TO public USING ("ambienti"."istituto_id" = current_setting('app.tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "affidamenti_ambienti" AS PERMISSIVE FOR ALL TO public USING ("affidamenti_ambienti"."istituto_id" = current_setting('app.tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "persone" AS PERMISSIVE FOR ALL TO public USING ("persone"."istituto_id" = current_setting('app.tenant_id', true)::uuid);
