import { describe, expect, it } from 'vitest';
import { eSlugRiservato, estraiSlug, validoPerLookup } from './tenant.js';

describe('estraiSlug', () => {
  it('estrae il primo segmento come slug', () => {
    expect(estraiSlug('dellaquila.localhost:3000')).toBe('dellaquila');
  });

  it('restituisce null senza sottodominio', () => {
    expect(estraiSlug('localhost:3000')).toBeNull();
    expect(estraiSlug('localhost')).toBeNull();
  });

  it('ignora la porta', () => {
    expect(estraiSlug('www.localhost:3000')).toBe('www');
  });

  it('restituisce null per un indirizzo IPv4 (es. healthcheck Docker su 127.0.0.1)', () => {
    expect(estraiSlug('127.0.0.1:3000')).toBeNull();
    expect(estraiSlug('127.0.0.1')).toBeNull();
    expect(estraiSlug('172.18.0.8:3000')).toBeNull();
  });
});

describe('eSlugRiservato', () => {
  it('riconosce uno slug riservato', () => {
    expect(eSlugRiservato('www')).toBe(true);
    expect(eSlugRiservato('api')).toBe(true);
  });

  it('non segnala come riservato uno slug qualunque', () => {
    expect(eSlugRiservato('dellaquila')).toBe(false);
  });
});

describe('validoPerLookup', () => {
  it('accetta uno slug ben formato', () => {
    expect(validoPerLookup('dellaquila')).toBe(true);
  });

  it('rifiuta uno slug malformato', () => {
    expect(validoPerLookup('a')).toBe(false);
    expect(validoPerLookup('-abc')).toBe(false);
  });

  it('non ricontrolla i riservati: per design, li ha già esclusi chi chiama (middleware.ts)', () => {
    expect(validoPerLookup('www')).toBe(true);
  });
});
