import type { Browser, BrowserContext, Page } from '@playwright/test';

export const ADMIN = { email: 'admin@dellaquila.localhost', password: 'GestiLabDemo2026!' };
export const AT = { email: 'at@dellaquila.localhost', password: 'GestiLabDemo2026!' };
export const MAILPIT = process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025';

export async function accediComeAdmin(page: Page): Promise<void> {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel('Password').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Accedi' }).click();
  await page.waitForURL('**/admin');
}

export async function accediComeAt(page: Page): Promise<void> {
  await page.goto('/tecnico/login');
  await page.getByLabel('Email').fill(AT.email);
  await page.getByLabel('Password').fill(AT.password);
  await page.getByRole('button', { name: 'Accedi' }).click();
  await page.waitForURL('**/tecnico');
}

interface MessaggioMailpit {
  ID: string;
  Subject: string;
  To: { Address: string }[];
}

/** Attende (fino a ~10 s) l'email per un destinatario in Mailpit e ne restituisce il testo. */
export async function attendiEmail(destinatario: string): Promise<{ oggetto: string; testo: string }> {
  for (let tentativo = 0; tentativo < 40; tentativo++) {
    const ricerca = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${destinatario}`)}`);
    const { messages } = (await ricerca.json()) as { messages: MessaggioMailpit[] };
    const messaggio = messages[0];
    if (messaggio) {
      const dettaglio = (await (await fetch(`${MAILPIT}/api/v1/message/${messaggio.ID}`)).json()) as { Text: string };
      return { oggetto: messaggio.Subject, testo: dettaglio.Text };
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Nessuna email per ${destinatario} in Mailpit`);
}

export function emailUnica(prefisso: string): string {
  return `${prefisso}-${Date.now()}@esempio.test`;
}

/**
 * Contesto senza la sessione condivisa (storageState del progetto): per i
 * test che partono da "nessun cookie" o che fanno logout — non devono
 * toccare la sessione admin usata dagli altri. `{ storageState: {cookies:
 * [], origins: []} }` e non `undefined`: con exactOptionalPropertyTypes il
 * campo va valorizzato, non annullato.
 */
export async function contestoAnonimo(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ storageState: { cookies: [], origins: [] }, locale: 'it-IT' });
}
