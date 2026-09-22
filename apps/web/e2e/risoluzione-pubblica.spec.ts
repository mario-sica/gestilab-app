import { expect, test } from '@playwright/test';

import { accediComeAt, contestoAnonimo } from './supporto.js';

// Verifica reale in browser (task 2.3): crea un asset vero tramite l'API
// (autenticato come AT, come farebbe la UI quando esisterà — task 2.4),
// poi verifica che /q lo risolva da anonimo, senza alcuna sessione. Non
// legge qr_token/codice_breve dal seed a mano: sono generati casuali a
// ogni riseeding, un valore fisso nel test si romperebbe silenziosamente
// il giorno in cui il seed venisse rieseguito da capo.
test.describe('risoluzione pubblica /q', () => {
  test('QR valido: la pagina mostra il bene; QR inesistente: messaggio, non un errore tecnico', async ({ browser }) => {
    const contestoAt = await contestoAnonimo(browser);
    const paginaAt = await contestoAt.newPage();
    await accediComeAt(paginaAt);

    const etichetta = `E2E-QR-${Date.now()}`;
    const risposta = await paginaAt.request.get('/api/v1/tecnico/asset?perPagina=1');
    const { dati } = (await risposta.json()) as { dati: { tipoAssetId: string; ambienteId: string }[] };
    const riferimento = dati[0]!;
    const creazione = await paginaAt.request.post('/api/v1/tecnico/asset', {
      data: { ambienteId: riferimento.ambienteId, tipoAssetId: riferimento.tipoAssetId, etichetta, proprieta: 'istituto' },
    });
    const creato = (await creazione.json()) as { qrToken: string };
    await contestoAt.close();

    const contesto = await contestoAnonimo(browser);
    const page = await contesto.newPage();

    await page.goto(`/q/${creato.qrToken}`);
    await expect(page.getByRole('heading', { name: etichetta })).toBeVisible();

    await page.goto('/q/un-token-che-non-esiste');
    await expect(page.locator('main [role=alert]')).toContainText('Nessun bene trovato');
    await expect(page.getByRole('link', { name: /codice breve/ })).toBeVisible();

    await contesto.close();
  });

  test('ricerca per codice breve: trova il bene, poi un codice inesistente mostra il messaggio', async ({ browser }) => {
    const contestoAt = await contestoAnonimo(browser);
    const paginaAt = await contestoAt.newPage();
    await accediComeAt(paginaAt);

    const etichetta = `E2E-CODICE-${Date.now()}`;
    const risposta = await paginaAt.request.get('/api/v1/tecnico/asset?perPagina=1');
    const { dati } = (await risposta.json()) as { dati: { tipoAssetId: string; ambienteId: string }[] };
    const riferimento = dati[0]!;
    const creazione = await paginaAt.request.post('/api/v1/tecnico/asset', {
      data: { ambienteId: riferimento.ambienteId, tipoAssetId: riferimento.tipoAssetId, etichetta, proprieta: 'istituto' },
    });
    const creato = (await creazione.json()) as { codiceBreve: string };
    await contestoAt.close();

    const contesto = await contestoAnonimo(browser);
    const page = await contesto.newPage();

    await page.goto('/q');
    await page.getByLabel(/Codice a 6 caratteri/).fill(creato.codiceBreve);
    await page.getByRole('button', { name: 'Cerca' }).click();
    await expect(page.getByRole('heading', { name: etichetta })).toBeVisible();

    await page.getByLabel(/Codice a 6 caratteri/).fill('ZZZ999');
    await page.getByRole('button', { name: 'Cerca' }).click();
    await expect(page.locator('main [role=alert]')).toContainText('Nessun bene trovato');

    await contesto.close();
  });
});
