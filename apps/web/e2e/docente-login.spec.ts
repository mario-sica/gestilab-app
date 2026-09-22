import { expect, test } from '@playwright/test';

import { contestoAnonimo } from './supporto.js';

// Task 1.5: autocomplete persone + PIN, sessione 12 h. La sessione admin
// condivisa (storageState del progetto) attiva la modalità e genera un
// PIN fresco; il login docente vero e proprio gira in un contesto
// anonimo, come un docente che apre il link per la prima volta.
test('modalità PIN istituto attivata dall’admin → login docente: "ros" trova "Rossi Mario", PIN sbagliato poi corretto, logout', async ({
  page,
  browser,
}) => {
  await page.goto('/admin/impostazioni');
  await page.getByLabel('Modalità di accesso docente').selectOption('pin_istituto');
  await expect(page.getByLabel('Modalità di accesso docente')).toHaveValue('pin_istituto');

  await page.getByRole('button', { name: /Genera il PIN|Rigenera il PIN/ }).click();
  await page.getByRole('button', { name: 'Sì, genera un nuovo PIN' }).click();
  const pin = await page.locator('main [role=status] strong').textContent();
  expect(pin).toMatch(/^\d{6}$/);

  const contesto = await contestoAnonimo(browser);
  const docente = await contesto.newPage();

  await docente.goto('/docente/login');
  await expect(docente.getByRole('heading', { name: 'Accesso docente' })).toBeVisible();
  await docente.getByLabel('Il tuo nome').fill('ros');
  await docente.getByRole('button', { name: /Rossi Mario/ }).click();

  await docente.getByLabel('PIN').fill('000000');
  await docente.getByRole('button', { name: 'Accedi' }).click();
  await expect(docente.locator('form [role=alert]')).toHaveText('PIN non corretto.');

  await docente.getByLabel('PIN').fill(pin!);
  await docente.getByRole('button', { name: 'Accedi' }).click();
  await docente.waitForURL('**/docente');
  await expect(docente.getByRole('heading', { name: 'Le mie segnalazioni' })).toBeVisible();

  await docente.getByRole('button', { name: 'Esci' }).click();
  await docente.waitForURL('**/docente/login');

  await docente.goto('/docente');
  await docente.waitForURL('**/docente/login');

  await contesto.close();
});

test('con modalità "solo QR" (default) la pagina mostra un messaggio, non il form', async ({ browser }) => {
  const contesto = await contestoAnonimo(browser);
  const page = await contesto.newPage();
  // Istituto "demo": non toccato dal test sopra, resta alla modalità di seed.
  await page.goto('http://demo.localhost:3000/docente/login');

  await expect(page.getByRole('status')).toContainText('non è ancora attivo');
  await expect(page.getByLabel('Il tuo nome')).toHaveCount(0);

  await contesto.close();
});
