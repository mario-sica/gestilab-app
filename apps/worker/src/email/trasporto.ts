import nodemailer, { type Transporter } from 'nodemailer';

export type Trasporto = Transporter;

// SMTP_URL (Mailpit in locale, un provider SMTP in produzione: cambia solo
// la variabile — docs/02-architettura.md § Servizi). nodemailer accetta
// l'URL smtp:// così com'è, credenziali incluse se presenti.
export function creaTrasporto(smtpUrl: string): Trasporto {
  return nodemailer.createTransport(smtpUrl);
}
