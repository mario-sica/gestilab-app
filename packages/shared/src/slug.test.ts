import { describe, expect, it } from 'vitest';

import { eSlugRiservato, formatoSlugValido, SLUG_RISERVATI, slugValido } from './slug.js';

describe('eSlugRiservato', () => {
  it.each(SLUG_RISERVATI)('riconosce "%s" come riservato', (slug) => {
    expect(eSlugRiservato(slug)).toBe(true);
  });

  it('non segnala come riservato uno slug qualunque', () => {
    expect(eSlugRiservato('dellaquila')).toBe(false);
  });
});

describe('formatoSlugValido', () => {
  it('accetta un formato valido anche se lo slug è riservato: non è il suo compito escluderlo', () => {
    expect(formatoSlugValido('www')).toBe(true);
  });

  it('rifiuta un formato malformato indipendentemente dai riservati', () => {
    expect(formatoSlugValido('ab')).toBe(false);
    expect(formatoSlugValido('-abc')).toBe(false);
  });
});

describe('slugValido', () => {
  it.each(SLUG_RISERVATI)('rifiuta lo slug riservato "%s"', (slug) => {
    expect(slugValido(slug)).toBe(false);
  });

  it.each(['dellaquila', 'demo', 'istituto-tecnico', 'abc'])(
    'accetta lo slug valido "%s"',
    (slug) => {
      expect(slugValido(slug)).toBe(true);
    },
  );

  it('rifiuta uno slug di due caratteri (sotto il minimo di 3)', () => {
    expect(slugValido('ab')).toBe(false);
  });

  it('rifiuta uno slug che inizia con un trattino', () => {
    expect(slugValido('-dellaquila')).toBe(false);
  });

  it('rifiuta uno slug che finisce con un trattino', () => {
    expect(slugValido('dellaquila-')).toBe(false);
  });

  it('rifiuta uno slug con trattini doppi', () => {
    expect(slugValido('della--quila')).toBe(false);
  });

  it('rifiuta uno slug con lettere maiuscole', () => {
    expect(slugValido('DellAquila')).toBe(false);
  });

  it('rifiuta uno slug più lungo di 40 caratteri', () => {
    expect(slugValido('a'.repeat(41))).toBe(false);
  });
});
