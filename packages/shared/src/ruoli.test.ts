import { describe, expect, it } from 'vitest';

import { AREA_PER_RUOLO, RUOLI_PER_AREA, RUOLI_UTENTE, eRuoloUtente } from './ruoli.js';

describe('ruoli e aree', () => {
  it('ogni ruolo appartiene a una e una sola area', () => {
    for (const ruolo of RUOLI_UTENTE) {
      const aree = Object.entries(RUOLI_PER_AREA).filter(([, ruoli]) => ruoli.includes(ruolo));
      expect(aree.map(([area]) => area)).toEqual([AREA_PER_RUOLO[ruolo]]);
    }
  });

  it('il supervisore condivide l’area admin, l’AT ha la sua', () => {
    expect(RUOLI_PER_AREA.admin).toEqual(['admin', 'supervisore']);
    expect(RUOLI_PER_AREA.tecnico).toEqual(['at']);
  });

  it('eRuoloUtente riconosce solo i ruoli noti', () => {
    expect(eRuoloUtente('at')).toBe(true);
    expect(eRuoloUtente('docente')).toBe(false);
  });
});
