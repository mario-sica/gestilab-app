import { boolean, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { istituti } from './istituti.js';
import { policyIsolamentoTenant } from './_rls.js';

// docs/01-dominio.md — Gruppo A — utenti (admin/AT/supervisore, non i
// docenti: quelli sono "persone"). 2FA obbligatoria per ruolo admin: regola
// applicativa, non un vincolo di schema.

export const utenteRuolo = pgEnum('utente_ruolo', ['admin', 'at', 'supervisore']);

export const utenti = pgTable(
  'utenti',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    istitutoId: uuid('istituto_id')
      .notNull()
      .references(() => istituti.id),
    email: text('email').notNull(),
    nome: text('nome').notNull(),
    cognome: text('cognome').notNull(),
    ruolo: utenteRuolo('ruolo').notNull(),
    passwordHash: text('password_hash'),
    attivo: boolean('attivo').notNull().default(true),
    totpSecretCifrato: text('totp_secret_cifrato'),
    providerSso: text('provider_sso'),
    ssoSubject: text('sso_subject'),
    ultimoAccesso: timestamp('ultimo_accesso', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabella) => [
    // email unique PER istituto, non globale.
    uniqueIndex('utenti_istituto_id_email_idx').on(tabella.istitutoId, tabella.email),
    policyIsolamentoTenant(tabella.istitutoId),
  ],
).enableRLS();
