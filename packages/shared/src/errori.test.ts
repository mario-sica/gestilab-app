import { describe, expect, it } from 'vitest';
import { ErroreDominio } from './errori.js';

describe('ErroreDominio', () => {
  it('porta codice, messaggio e status HTTP', () => {
    const errore = new ErroreDominio('TENANT_NON_TROVATO', 'Istituto non trovato', 404);

    expect(errore).toBeInstanceOf(Error);
    expect(errore.codice).toBe('TENANT_NON_TROVATO');
    expect(errore.message).toBe('Istituto non trovato');
    expect(errore.statusHttp).toBe(404);
  });
});
