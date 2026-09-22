import { expect, test } from '@playwright/test';

import { accediComeAt, contestoAnonimo } from './supporto.js';

// Verifica reale in browser (task 2.2): la pagina /tecnico/asset arriva
// davvero, con cookie di sessione reale e il perimetro affidamenti
// applicato dal server, non solo nei test API. Il caso "ambiente non
// affidato → 404" è già coperto in profondità dai test API
// (moduli/tecnico-asset/rotte.test.ts, sicurezza-cross-tenant.test.ts):
// qui basta provare che l'intera catena — login, cookie, RLS, rendering —
// funziona insieme per il caso reale, con i dati demo del seed.
test('login AT, /tecnico/asset elenca i propri asset demo', async ({ browser }) => {
  const contesto = await contestoAnonimo(browser);
  const page = await contesto.newPage();

  await accediComeAt(page);
  await page.goto('/tecnico/asset');

  await expect(page.getByRole('heading', { name: 'Asset' })).toBeVisible();
  // Etichette generate dal seed (task 2.1): "LAB1-01" nel primo laboratorio.
  await expect(page.getByText('LAB1-01')).toBeVisible();

  await contesto.close();
});
