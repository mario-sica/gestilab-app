import { test as setup } from '@playwright/test';

import { accediComeAdmin } from './supporto.js';

// Login admin una volta sola; il cookie gl_s_adm finisce in e2e/.auth/
// admin.json (gitignored) e ogni test parte già dentro l'area admin.
setup('login admin condiviso', async ({ page }) => {
  await accediComeAdmin(page);
  await page.context().storageState({ path: 'e2e/.auth/admin.json' });
});
