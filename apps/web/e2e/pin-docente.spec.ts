import { expect, test } from '@playwright/test';

// Task 1.4: il PIN si genera con conferma esplicita e si vede una volta.
test('rigenerazione del PIN docente con conferma, PIN a 6 cifre mostrato una volta', async ({ page }) => {
  await page.goto('/admin/impostazioni');
  await expect(page.getByRole('heading', { name: 'PIN docente' })).toBeVisible();

  await page.getByRole('button', { name: /Genera il PIN|Rigenera il PIN/ }).click();
  await expect(page.getByRole('group')).toContainText('tutti i docenti collegati dovranno rientrare');
  await page.getByRole('button', { name: 'Sì, genera un nuovo PIN' }).click();

  const avviso = page.locator('main [role=status]');
  await expect(avviso).toContainText('Nuovo PIN:');
  await expect(avviso.locator('strong')).toHaveText(/^\d{6}$/);
  await expect(page.getByText('PIN d’istituto').locator('..').getByText('impostato')).toBeVisible();

  // Ricaricando, il PIN non è più visibile: esiste solo l'hash.
  await page.reload();
  await expect(page.locator('main [role=status]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Rigenera il PIN' })).toBeVisible();
});
