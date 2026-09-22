import { randomBytes } from 'node:crypto';

// docs/01-dominio.md — Gruppo B, asset: "codice_breve: 6 caratteri
// alfanumerici senza ambiguità (no O/0, I/1), unique per istituto" e
// "qr_token: 22 char base64url, unique globale, ruotabile". La rotazione
// e l'endpoint di risoluzione pubblica sono task 2.3/2.8: questo modulo
// dà solo la generazione di un valore valido, usata sia dal seed (task
// 2.1) sia dalla creazione di un asset (task 2.2) — un solo posto, non
// due implementazioni che potrebbero divergere.
const ALFABETO_CODICE_BREVE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generaCodiceBreve(): string {
  return Array.from({ length: 6 }, () => ALFABETO_CODICE_BREVE[randomBytes(1)[0]! % ALFABETO_CODICE_BREVE.length]).join('');
}

export function generaQrToken(): string {
  return randomBytes(16).toString('base64url');
}
