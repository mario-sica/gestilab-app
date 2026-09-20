import { boolean, date, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// docs/01-dominio.md — Gruppo A — istituti (tenant). Non è tenant-scoped:
// è la tabella che DEFINISCE i tenant, non ne appartiene a uno.

export const istitutoTipologia = pgEnum('istituto_tipologia', [
  'liceo',
  'tecnico',
  'professionale',
  'IISS',
]);

export const istitutoStato = pgEnum('istituto_stato', ['attivo', 'sospeso', 'cessato']);

export const istitutoModalitaAccessoDocente = pgEnum('istituto_modalita_accesso_docente', [
  'solo_qr',
  'pin_istituto',
  'pin_personale',
  'sso',
]);

export const istituti = pgTable('istituti', {
  id: uuid('id').primaryKey().defaultRandom(),
  // [a-z0-9-]{3,40}, immutabile dopo attivazione (regola applicativa, non
  // imposta qui via check: l'immutabilità va garantita dal servizio, non
  // dallo schema). Slug riservati: www, app, console, api, static, admin,
  // status, docs, mail (validati dal servizio, non da un check DB).
  slug: text('slug').notNull().unique(),
  dominioPersonalizzato: text('dominio_personalizzato').unique(),
  codiceMeccanografico: text('codice_meccanografico').notNull().unique(),
  denominazione: text('denominazione').notNull(),
  tipologia: istitutoTipologia('tipologia').notNull(),
  indirizzo: text('indirizzo'),
  pianoAbbonamento: text('piano_abbonamento'),
  limiteAsset: integer('limite_asset'),
  stato: istitutoStato('stato').notNull().default('attivo'),
  dataScadenzaContratto: date('data_scadenza_contratto'),
  modalitaAccessoDocente: istitutoModalitaAccessoDocente('modalita_accesso_docente')
    .notNull()
    .default('solo_qr'),
  pinIstitutoHash: text('pin_istituto_hash'),
  pinIstitutoScadenza: date('pin_istituto_scadenza'),
  paginaPubblicaAttiva: boolean('pagina_pubblica_attiva').notNull().default(true),
  captchaAttivo: boolean('captcha_attivo').notNull().default(false),
  retentionAnni: integer('retention_anni').notNull().default(10),
  logoKey: text('logo_key'),
  colorePrimario: text('colore_primario'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
