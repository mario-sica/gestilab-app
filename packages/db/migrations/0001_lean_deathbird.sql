-- Serve all'indice trigram su persone (nome+cognome, autocomplete): vedi
-- src/schema/persone.ts.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."istituto_modalita_accesso_docente" AS ENUM('solo_qr', 'pin_istituto', 'pin_personale', 'sso');--> statement-breakpoint
CREATE TYPE "public"."istituto_stato" AS ENUM('attivo', 'sospeso', 'cessato');--> statement-breakpoint
CREATE TYPE "public"."istituto_tipologia" AS ENUM('liceo', 'tecnico', 'professionale', 'IISS');--> statement-breakpoint
CREATE TYPE "public"."utente_ruolo" AS ENUM('admin', 'at', 'supervisore');--> statement-breakpoint
CREATE TYPE "public"."ambiente_tipo" AS ENUM('laboratorio', 'aula', 'ufficio', 'deposito', 'palestra', 'altro');--> statement-breakpoint
CREATE TYPE "public"."persona_qualifica" AS ENUM('docente', 'collaboratore', 'amministrativo', 'altro');--> statement-breakpoint
CREATE TABLE "istituti" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"dominio_personalizzato" text,
	"codice_meccanografico" text NOT NULL,
	"denominazione" text NOT NULL,
	"tipologia" "istituto_tipologia" NOT NULL,
	"indirizzo" text,
	"piano_abbonamento" text,
	"limite_asset" integer,
	"stato" "istituto_stato" DEFAULT 'attivo' NOT NULL,
	"data_scadenza_contratto" date,
	"modalita_accesso_docente" "istituto_modalita_accesso_docente" DEFAULT 'solo_qr' NOT NULL,
	"pin_istituto_hash" text,
	"pin_istituto_scadenza" date,
	"pagina_pubblica_attiva" boolean DEFAULT true NOT NULL,
	"captcha_attivo" boolean DEFAULT false NOT NULL,
	"retention_anni" integer DEFAULT 10 NOT NULL,
	"logo_key" text,
	"colore_primario" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "istituti_slug_unique" UNIQUE("slug"),
	CONSTRAINT "istituti_dominio_personalizzato_unique" UNIQUE("dominio_personalizzato"),
	CONSTRAINT "istituti_codice_meccanografico_unique" UNIQUE("codice_meccanografico")
);
--> statement-breakpoint
CREATE TABLE "utenti" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"istituto_id" uuid NOT NULL,
	"email" text NOT NULL,
	"nome" text NOT NULL,
	"cognome" text NOT NULL,
	"ruolo" "utente_ruolo" NOT NULL,
	"password_hash" text,
	"attivo" boolean DEFAULT true NOT NULL,
	"totp_secret_cifrato" text,
	"provider_sso" text,
	"sso_subject" text,
	"ultimo_accesso" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anni_scolastici" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"istituto_id" uuid NOT NULL,
	"codice" text NOT NULL,
	"data_inizio" date NOT NULL,
	"data_fine" date NOT NULL,
	"corrente" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plessi" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"istituto_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"indirizzo" text,
	"codice_meccanografico_plesso" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ambienti" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"istituto_id" uuid NOT NULL,
	"plesso_id" uuid NOT NULL,
	"tipo" "ambiente_tipo" NOT NULL,
	"nome" text NOT NULL,
	"codice_breve" text NOT NULL,
	"piano" integer,
	"area_at" text,
	"qr_token" text NOT NULL,
	"attivo" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ambienti_qr_token_unique" UNIQUE("qr_token")
);
--> statement-breakpoint
CREATE TABLE "affidamenti_ambienti" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"istituto_id" uuid NOT NULL,
	"utente_id" uuid NOT NULL,
	"ambiente_id" uuid NOT NULL,
	"anno_scolastico_id" uuid NOT NULL,
	"data_inizio" date NOT NULL,
	"data_fine" date,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persone" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"istituto_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"cognome" text NOT NULL,
	"qualifica" "persona_qualifica" NOT NULL,
	"anno_scolastico_id" uuid NOT NULL,
	"attivo" boolean DEFAULT true NOT NULL,
	"pin_personale_hash" text,
	"email" text,
	"eliminato_il" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "utenti" ADD CONSTRAINT "utenti_istituto_id_istituti_id_fk" FOREIGN KEY ("istituto_id") REFERENCES "public"."istituti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anni_scolastici" ADD CONSTRAINT "anni_scolastici_istituto_id_istituti_id_fk" FOREIGN KEY ("istituto_id") REFERENCES "public"."istituti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anni_scolastici" ADD CONSTRAINT "anni_scolastici_created_by_utenti_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."utenti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plessi" ADD CONSTRAINT "plessi_istituto_id_istituti_id_fk" FOREIGN KEY ("istituto_id") REFERENCES "public"."istituti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plessi" ADD CONSTRAINT "plessi_created_by_utenti_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."utenti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ambienti" ADD CONSTRAINT "ambienti_istituto_id_istituti_id_fk" FOREIGN KEY ("istituto_id") REFERENCES "public"."istituti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ambienti" ADD CONSTRAINT "ambienti_plesso_id_plessi_id_fk" FOREIGN KEY ("plesso_id") REFERENCES "public"."plessi"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ambienti" ADD CONSTRAINT "ambienti_created_by_utenti_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."utenti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affidamenti_ambienti" ADD CONSTRAINT "affidamenti_ambienti_istituto_id_istituti_id_fk" FOREIGN KEY ("istituto_id") REFERENCES "public"."istituti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affidamenti_ambienti" ADD CONSTRAINT "affidamenti_ambienti_utente_id_utenti_id_fk" FOREIGN KEY ("utente_id") REFERENCES "public"."utenti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affidamenti_ambienti" ADD CONSTRAINT "affidamenti_ambienti_ambiente_id_ambienti_id_fk" FOREIGN KEY ("ambiente_id") REFERENCES "public"."ambienti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affidamenti_ambienti" ADD CONSTRAINT "affidamenti_ambienti_anno_scolastico_id_anni_scolastici_id_fk" FOREIGN KEY ("anno_scolastico_id") REFERENCES "public"."anni_scolastici"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persone" ADD CONSTRAINT "persone_istituto_id_istituti_id_fk" FOREIGN KEY ("istituto_id") REFERENCES "public"."istituti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persone" ADD CONSTRAINT "persone_anno_scolastico_id_anni_scolastici_id_fk" FOREIGN KEY ("anno_scolastico_id") REFERENCES "public"."anni_scolastici"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "utenti_istituto_id_email_idx" ON "utenti" USING btree ("istituto_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "anni_scolastici_istituto_id_codice_idx" ON "anni_scolastici" USING btree ("istituto_id","codice");--> statement-breakpoint
CREATE UNIQUE INDEX "anni_scolastici_un_corrente_per_istituto_idx" ON "anni_scolastici" USING btree ("istituto_id") WHERE "anni_scolastici"."corrente" = true;--> statement-breakpoint
CREATE INDEX "persone_nome_cognome_trgm_idx" ON "persone" USING gin (("nome" || ' ' || "cognome") gin_trgm_ops);