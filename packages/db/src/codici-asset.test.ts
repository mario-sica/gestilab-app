import { describe, expect, it } from 'vitest';

import { generaCodiceBreve, generaQrToken } from './codici-asset.js';

describe('generaCodiceBreve', () => {
  it('genera 6 caratteri, senza ambiguità (no O/0, I/1)', () => {
    for (let i = 0; i < 100; i++) {
      const codice = generaCodiceBreve();
      expect(codice).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    }
  });
});

describe('generaQrToken', () => {
  it('genera un token base64url di 22 caratteri', () => {
    for (let i = 0; i < 20; i++) {
      const token = generaQrToken();
      expect(token).toHaveLength(22);
      expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    }
  });

  it('non genera collisioni su molte chiamate', () => {
    const token = new Set(Array.from({ length: 1000 }, () => generaQrToken()));
    expect(token.size).toBe(1000);
  });
});
