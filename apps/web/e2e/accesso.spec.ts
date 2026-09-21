import { expect, test } from '@playwright/test';

import { ADMIN, accediComeAdmin, contestoAnonimo } from './supporto.js';

test.describe('accesso e aree', () => {
  test('senza sessione / mostra la scelta area e /admin manda al login', async ({ browser }) => {
    const contesto = await contestoAnonimo(browser);
    const page = await contesto.newPage();
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'GestiLab' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Amministratore' })).toBeVisible();

    await page.goto('/admin');
    await page.waitForURL('**/admin/login');
    await contesto.close();
  });

  test('password sbagliata → messaggio generico, nessun cookie', async ({ browser }) => {
    const contesto = await contestoAnonimo(browser);
    const page = await contesto.newPage();
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill(ADMIN.email);
    await page.getByLabel('Password').fill('sbagliata');
    await page.getByRole('button', { name: 'Accedi' }).click();
    // "form [role=alert]": Next aggiunge un proprio role=alert (annunciatore di rotta).
    await expect(page.locator('form [role=alert]')).toHaveText('Email o password non corretti.');
    expect((await contesto.cookies()).find((c) => c.name === 'gl_s_adm')).toBeUndefined();
    await contesto.close();
  });

  test('con sessione admin: / reindirizza all’area, /tecnico dà 403 con link', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('**/admin');
    await expect(page.getByRole('heading', { name: 'Cruscotto' })).toBeVisible();

    // docs/02: ruolo sbagliato per l'area → 403 con link all'area corretta
    await page.goto('/tecnico');
    await expect(page.getByRole('heading', { name: /Non hai accesso all'area tecnico/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Vai all'area amministratore/ })).toHaveAttribute('href', '/admin');
  });

  test('esci revoca la sessione e manda al login', async ({ browser }) => {
    // Sessione propria, per non distruggere quella condivisa dagli altri test.
    const contesto = await contestoAnonimo(browser);
    const page = await contesto.newPage();
    await accediComeAdmin(page);
    await page.getByRole('button', { name: 'Esci' }).click();
    await page.waitForURL('**/admin/login');
    expect((await contesto.cookies()).find((c) => c.name === 'gl_s_adm')).toBeUndefined();
    await page.goto('/admin');
    await page.waitForURL('**/admin/login');
    await contesto.close();
  });
});
