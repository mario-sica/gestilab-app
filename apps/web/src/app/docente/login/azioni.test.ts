import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockHeadersGet, mockCookiesSet, mockRedirect } = vi.hoisted(() => ({
  mockHeadersGet: vi.fn<(nome: string) => string | null>(),
  mockCookiesSet: vi.fn(),
  mockRedirect: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => ({ get: mockHeadersGet })),
  cookies: vi.fn(async () => ({ set: mockCookiesSet })),
}));

vi.mock('next/navigation', () => ({
  redirect: (...argomenti: unknown[]) => mockRedirect(...argomenti),
}));

const { accediDocente } = await import('./azioni.js');

// UUID v4 valido (nibble di versione e di variante corretti): Zod
// convalida davvero il formato, un placeholder come "111…1" lo rifiuta.
const PERSONA_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

function datiForm(personaId?: string, pin?: string): FormData {
  const dati = new FormData();
  if (personaId !== undefined) {
    dati.set('personaId', personaId);
  }
  if (pin !== undefined) {
    dati.set('pin', pin);
  }
  return dati;
}

describe('accediDocente', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockHeadersGet.mockReturnValue('istituto-test-id');
  });

  it('senza una persona selezionata (personaId non valido) non chiama gestilab-auth-service', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');

    const risultato = await accediDocente({}, datiForm('non-un-uuid', '123456'));

    expect(risultato.errore).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('con un PIN che non ha 6 cifre non chiama gestilab-auth-service', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');

    const risultato = await accediDocente({}, datiForm(PERSONA_ID, '123'));

    expect(risultato.errore).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('senza x-tenant-id risponde con un errore, senza chiamare gestilab-auth-service', async () => {
    mockHeadersGet.mockReturnValue(null);
    const fetchSpy = vi.spyOn(global, 'fetch');

    const risultato = await accediDocente({}, datiForm(PERSONA_ID, '123456'));

    expect(risultato.errore).toBe('Istituto non riconosciuto.');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('con PIN sbagliato (401) risponde con un messaggio generico', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 401 }));

    const risultato = await accediDocente({}, datiForm(PERSONA_ID, '123456'));

    expect(risultato.errore).toBe('PIN non corretto.');
  });

  it('con 429 (rate limit) spiega di aspettare, non "PIN sbagliato"', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 429 }));

    const risultato = await accediDocente({}, datiForm(PERSONA_ID, '123456'));

    expect(risultato.errore).toBe('Troppi tentativi: aspetta un minuto e riprova.');
  });

  it('se gestilab-auth-service è irraggiungibile (fetch lancia) mostra un errore generico', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new TypeError('fetch failed'));

    const risultato = await accediDocente({}, datiForm(PERSONA_ID, '123456'));

    expect(risultato.errore).toBe('Si è verificato un errore. Riprova più tardi.');
    expect(mockCookiesSet).not.toHaveBeenCalled();
  });

  it('con PIN corretto imposta il cookie gl_s_doc e reindirizza a /docente', async () => {
    const scadeIl = new Date(Date.now() + 60_000).toISOString();
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ token: 'il-token', scadeIl }), { status: 200 }));

    await accediDocente({}, datiForm(PERSONA_ID, '123456'));

    expect(mockCookiesSet).toHaveBeenCalledWith('gl_s_doc', 'il-token', expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }));
    expect(mockRedirect).toHaveBeenCalledWith('/docente');
  });

  it('invia istitutoId, personaId e pin a gestilab-auth-service', async () => {
    mockHeadersGet.mockReturnValue('istituto-xyz');
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ token: 't', scadeIl: new Date().toISOString() }), { status: 200 }));

    await accediDocente({}, datiForm(PERSONA_ID, '482913'));

    const [url, opzioni] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toMatch(/\/docente\/accedi$/);
    const corpo = JSON.parse((opzioni as RequestInit).body as string) as Record<string, string>;
    expect(corpo).toEqual({ istitutoId: 'istituto-xyz', personaId: PERSONA_ID, pin: '482913' });
  });
});
