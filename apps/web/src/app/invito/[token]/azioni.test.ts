import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockHeadersGet, mockRedirect } = vi.hoisted(() => ({
  mockHeadersGet: vi.fn<(nome: string) => string | null>(),
  mockRedirect: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => ({ get: mockHeadersGet })),
}));

vi.mock('next/navigation', () => ({
  redirect: (...argomenti: unknown[]) => {
    mockRedirect(...argomenti);
    throw new Error('NEXT_REDIRECT');
  },
}));

const { accettaInvito } = await import('./azioni.js');

function datiForm(campi: Record<string, string>): FormData {
  const dati = new FormData();
  for (const [nome, valore] of Object.entries(campi)) {
    dati.set(nome, valore);
  }
  return dati;
}

const PASSWORD = 'unaPasswordLunga123!';

describe('accettaInvito', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockHeadersGet.mockReturnValue('istituto-test-id');
  });

  it('se le due password non coincidono non chiama gestilab-auth-service', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');

    const risultato = await accettaInvito({}, datiForm({ token: 't', password: PASSWORD, conferma: 'altra' }));

    expect(risultato.errore).toBe('Le due password non coincidono.');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('invia istitutoId, token e password a /inviti/accetta e reindirizza al login dell’area risposta', async () => {
    mockHeadersGet.mockReturnValue('istituto-xyz');
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ area: 'tecnico' }), { status: 200 }));

    await expect(accettaInvito({}, datiForm({ token: 'tok', password: PASSWORD, conferma: PASSWORD }))).rejects.toThrow('NEXT_REDIRECT');

    const [url, opzioni] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toMatch(/\/inviti\/accetta$/);
    expect(JSON.parse((opzioni as RequestInit).body as string)).toEqual({ istitutoId: 'istituto-xyz', token: 'tok', password: PASSWORD });
    expect(mockRedirect).toHaveBeenCalledWith('/tecnico/login?invito=ok');
  });

  it('con PASSWORD_TROPPO_CORTA mostra il messaggio dell’auth-service', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ errore: { codice: 'PASSWORD_TROPPO_CORTA', messaggio: 'La password deve avere almeno 12 caratteri.' } }), {
        status: 400,
      }),
    );

    const risultato = await accettaInvito({}, datiForm({ token: 'tok', password: 'corta', conferma: 'corta' }));

    expect(risultato.errore).toBe('La password deve avere almeno 12 caratteri.');
  });

  it('con INVITO_NON_VALIDO spiega di chiedere un nuovo invito', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ errore: { codice: 'INVITO_NON_VALIDO', messaggio: 'x' } }), { status: 404 }),
    );

    const risultato = await accettaInvito({}, datiForm({ token: 'tok', password: PASSWORD, conferma: PASSWORD }));

    expect(risultato.errore).toContain('non è più valido');
  });

  it('se gestilab-auth-service è irraggiungibile mostra un errore generico', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new TypeError('fetch failed'));

    const risultato = await accettaInvito({}, datiForm({ token: 'tok', password: PASSWORD, conferma: PASSWORD }));

    expect(risultato.errore).toBe('Si è verificato un errore. Riprova più tardi.');
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
