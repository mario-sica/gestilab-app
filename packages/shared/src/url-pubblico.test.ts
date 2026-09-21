import { describe, expect, it } from 'vitest';

import { origineTenant } from './url-pubblico.js';

describe('origineTenant', () => {
  it('in sviluppo include protocollo http e porta', () => {
    expect(origineTenant({ BASE_DOMAIN: 'localhost', WEB_PROTOCOLLO: 'http', WEB_PORTA: 3000 }, 'dellaquila')).toBe(
      'http://dellaquila.localhost:3000',
    );
  });

  it('senza porta (Traefik su 443) non aggiunge nulla dopo il dominio', () => {
    // eslint-disable-next-line no-restricted-syntax -- dato di test, non un dominio usato dal codice
    expect(origineTenant({ BASE_DOMAIN: 'gestilab.test', WEB_PROTOCOLLO: 'https', WEB_PORTA: undefined }, 'demo')).toBe(
      // eslint-disable-next-line no-restricted-syntax -- idem
      'https://demo.gestilab.test',
    );
  });
});
