import { expect, test } from '@playwright/test';

import { attendiEmail, contestoAnonimo, emailUnica } from './supporto.js';

// Task 1.3 end-to-end: l'Admin invita dal browser, l'email arriva in
// Mailpit, il link porta alla pagina pubblica, la password viene
// impostata e il nuovo utente entra nella sua area.
test('invito → email → impostazione password → login del nuovo utente', async ({ page, browser }) => {
  const email = emailUnica('nuova-at');

  await page.goto('/admin/utenti');
  await page.getByLabel('Nome', { exact: true }).fill('Giulia');
  await page.getByLabel('Cognome').fill('Verdi');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Ruolo').selectOption('at');
  await page.getByRole('button', { name: 'Invia invito' }).click();
  await expect(page.locator('form [role=status]')).toHaveText(`Invito inviato a ${email}.`);
  await expect(page.getByRole('row', { name: /Verdi Giulia/ })).toContainText('Invito in sospeso');

  const messaggio = await attendiEmail(email);
  expect(messaggio.oggetto).toContain('Invito a GestiLab');
  const link = /https?:\/\/\S+\/invito\/\S+/.exec(messaggio.testo)?.[0];
  expect(link).toBeTruthy();

  // L'invitata apre il link in un browser "suo": nessun cookie admin.
  const contestoInvitata = await contestoAnonimo(browser);
  const pagina = await contestoInvitata.newPage();
  await pagina.goto(link!);
  await expect(pagina.getByRole('heading', { name: /Ciao Giulia/ })).toBeVisible();
  await pagina.getByLabel('Nuova password (almeno 12 caratteri)').fill('PasswordGiulia2026!');
  await pagina.getByLabel('Ripeti la password').fill('PasswordGiulia2026!');
  await pagina.getByRole('button', { name: 'Imposta la password' }).click();
  await pagina.waitForURL('**/tecnico/login?invito=ok');
  await expect(pagina.locator('main [role=status]')).toHaveText('Password impostata. Ora puoi accedere.');

  await pagina.getByLabel('Email').fill(email);
  await pagina.getByLabel('Password').fill('PasswordGiulia2026!');
  await pagina.getByRole('button', { name: 'Accedi' }).click();
  await pagina.waitForURL('**/tecnico');
  await expect(pagina.getByRole('heading', { name: 'Oggi' })).toBeVisible();

  // Il link è monouso.
  await pagina.goto(link!);
  await expect(pagina.getByRole('heading', { name: 'Invito non valido' })).toBeVisible();
  await contestoInvitata.close();
});

test('email già presente → errore chiaro, nessun invito', async ({ page }) => {
  await page.goto('/admin/utenti');
  await page.getByLabel('Nome', { exact: true }).fill('Doppio');
  await page.getByLabel('Cognome').fill('Utente');
  await page.getByLabel('Email').fill('admin@dellaquila.localhost');
  await page.getByRole('button', { name: 'Invia invito' }).click();
  await expect(page.locator('form [role=alert]')).toHaveText('Esiste già un utente con questa email.');
});
