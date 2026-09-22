CREATE TYPE "public"."contratto_tipo" AS ENUM('assistenza', 'noleggio', 'garanzia_estesa');--> statement-breakpoint
CREATE TYPE "public"."tipo_asset_categoria" AS ENUM('informatica', 'audiovideo', 'stampa', 'rete', 'scientifico', 'officina', 'arredo', 'altro');--> statement-breakpoint
CREATE TYPE "public"."asset_categoria_inventariale" AS ENUM('I', 'III', 'non_inventariato');--> statement-breakpoint
CREATE TYPE "public"."asset_proprieta" AS ENUM('istituto', 'ente_locale', 'comodato', 'noleggio', 'altro');--> statement-breakpoint
CREATE TYPE "public"."asset_stato" AS ENUM('attivo', 'guasto', 'in_riparazione', 'in_prestito', 'in_magazzino', 'dismesso');--> statement-breakpoint
CREATE TYPE "public"."movimento_asset_tipo" AS ENUM('trasferimento', 'prestito', 'rientro', 'riparazione_esterna', 'rientro_riparazione', 'dismissione');--> statement-breakpoint
CREATE TABLE "fornitori" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"istituto_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"telefono" text,
	"email" text,
	"portale_assistenza" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fornitori" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "contratti" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"istituto_id" uuid NOT NULL,
	"fornitore_id" uuid NOT NULL,
	"tipo" "contratto_tipo" NOT NULL,
	"riferimento" text NOT NULL,
	"data_inizio" date NOT NULL,
	"data_fine" date NOT NULL,
	"condizioni" text,
	"come_richiedere_intervento" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contratti" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tipi_asset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"istituto_id" uuid,
	"nome" text NOT NULL,
	"categoria" "tipo_asset_categoria" NOT NULL,
	"schema_attributi" jsonb,
	"guida_rapida_default_id" uuid,
	"etichettabile" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tipi_asset" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "asset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"istituto_id" uuid NOT NULL,
	"ambiente_id" uuid NOT NULL,
	"tipo_asset_id" uuid NOT NULL,
	"parent_asset_id" uuid,
	"etichetta" text NOT NULL,
	"marca" text,
	"modello" text,
	"seriale" text,
	"numero_inventario" text,
	"categoria_inventariale" "asset_categoria_inventariale",
	"proprieta" "asset_proprieta" NOT NULL,
	"fornitore_id" uuid,
	"contratto_id" uuid,
	"data_acquisto" date,
	"data_fine_garanzia" date,
	"valore_acquisto" numeric(12, 2),
	"stato" "asset_stato" DEFAULT 'attivo' NOT NULL,
	"codice_breve" text NOT NULL,
	"qr_token" text NOT NULL,
	"attributi" jsonb,
	"pagina_pubblica_attiva" boolean DEFAULT true NOT NULL,
	"data_dismissione" date,
	"riferimento_verbale_scarico" text,
	"eliminato_il" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_qr_token_unique" UNIQUE("qr_token")
);
--> statement-breakpoint
ALTER TABLE "asset" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "movimenti_asset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"istituto_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"tipo" "movimento_asset_tipo" NOT NULL,
	"da_ambiente_id" uuid,
	"a_ambiente_id" uuid,
	"affidatario_testo" text,
	"data" date NOT NULL,
	"data_prevista_rientro" date,
	"utente_id" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "movimenti_asset" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "fornitori" ADD CONSTRAINT "fornitori_istituto_id_istituti_id_fk" FOREIGN KEY ("istituto_id") REFERENCES "public"."istituti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contratti" ADD CONSTRAINT "contratti_istituto_id_istituti_id_fk" FOREIGN KEY ("istituto_id") REFERENCES "public"."istituti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contratti" ADD CONSTRAINT "contratti_fornitore_id_fornitori_id_fk" FOREIGN KEY ("fornitore_id") REFERENCES "public"."fornitori"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipi_asset" ADD CONSTRAINT "tipi_asset_istituto_id_istituti_id_fk" FOREIGN KEY ("istituto_id") REFERENCES "public"."istituti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_istituto_id_istituti_id_fk" FOREIGN KEY ("istituto_id") REFERENCES "public"."istituti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_ambiente_id_ambienti_id_fk" FOREIGN KEY ("ambiente_id") REFERENCES "public"."ambienti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_tipo_asset_id_tipi_asset_id_fk" FOREIGN KEY ("tipo_asset_id") REFERENCES "public"."tipi_asset"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_parent_asset_id_asset_id_fk" FOREIGN KEY ("parent_asset_id") REFERENCES "public"."asset"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_fornitore_id_fornitori_id_fk" FOREIGN KEY ("fornitore_id") REFERENCES "public"."fornitori"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_contratto_id_contratti_id_fk" FOREIGN KEY ("contratto_id") REFERENCES "public"."contratti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimenti_asset" ADD CONSTRAINT "movimenti_asset_istituto_id_istituti_id_fk" FOREIGN KEY ("istituto_id") REFERENCES "public"."istituti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimenti_asset" ADD CONSTRAINT "movimenti_asset_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimenti_asset" ADD CONSTRAINT "movimenti_asset_da_ambiente_id_ambienti_id_fk" FOREIGN KEY ("da_ambiente_id") REFERENCES "public"."ambienti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimenti_asset" ADD CONSTRAINT "movimenti_asset_a_ambiente_id_ambienti_id_fk" FOREIGN KEY ("a_ambiente_id") REFERENCES "public"."ambienti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimenti_asset" ADD CONSTRAINT "movimenti_asset_utente_id_utenti_id_fk" FOREIGN KEY ("utente_id") REFERENCES "public"."utenti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "asset_istituto_id_etichetta_idx" ON "asset" USING btree ("istituto_id","etichetta");--> statement-breakpoint
CREATE UNIQUE INDEX "asset_istituto_id_codice_breve_idx" ON "asset" USING btree ("istituto_id","codice_breve");--> statement-breakpoint
CREATE INDEX "asset_istituto_id_ambiente_id_idx" ON "asset" USING btree ("istituto_id","ambiente_id");--> statement-breakpoint
CREATE INDEX "movimenti_asset_istituto_id_asset_id_idx" ON "movimenti_asset" USING btree ("istituto_id","asset_id");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "fornitori" AS PERMISSIVE FOR ALL TO public USING ("fornitori"."istituto_id" = current_setting('app.tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "contratti" AS PERMISSIVE FOR ALL TO public USING ("contratti"."istituto_id" = current_setting('app.tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation_o_catalogo_globale" ON "tipi_asset" AS PERMISSIVE FOR ALL TO public USING ("tipi_asset"."istituto_id" IS NULL OR "tipi_asset"."istituto_id" = current_setting('app.tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "asset" AS PERMISSIVE FOR ALL TO public USING ("asset"."istituto_id" = current_setting('app.tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "movimenti_asset" AS PERMISSIVE FOR ALL TO public USING ("movimenti_asset"."istituto_id" = current_setting('app.tenant_id', true)::uuid);