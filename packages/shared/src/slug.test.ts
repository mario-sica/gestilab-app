import { describe, expect, it } from 'vitest';

import { SLUG_RISERVATI, slugValido } from './slug.js';

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
