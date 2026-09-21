import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted: i mock referenziati dentro vi.mock (sotto, sollevato in cima
// al file da Vitest) devono esistere già a quel punto — const normali
// andrebbero incontro alla temporal dead zone.
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

const { accedi } = await import('./azioni.js');

function datiForm(area: string, email?: string, password?: string): FormData {
  const dati = new FormData();
  dati.set('area', area);
  if (email !== undefined) {
    dati.set('email', email);
  }
  if (password !== undefined) {
    dati.set('password', password);
  }
  return dati;
}

describe('accedi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockHeadersGet.mockReturnValue('istituto-test-id');
  });

  it('con un\'area sconosciuta nel form risponde con un errore, senza chiamare gestilab-auth-service', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');

    const risultato = await accedi({}, datiForm('docente', 'a@esempio.it', 'segreto'));

    expect(risultato.errore).toBe('Area non valida.');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('senza email o password non chiama gestilab-auth-service', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');

    const risultato = await accedi({}, datiForm('admin', '', ''));

    expect(risultato.errore).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('senza x-tenant-id risponde con un errore, senza chiamare gestilab-auth-service', async () => {
    mockHeadersGet.mockReturnValue(null);
    const fetchSpy = vi.spyOn(global, 'fetch');

    const risultato = await accedi({}, datiForm('admin', 'a@esempio.it', 'segreto'));

    expect(risultato.errore).toBe('Istituto non riconosciuto.');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('con credenziali sbagliate (401) risponde con un messaggio generico', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 401 }));

    const risultato = await accedi({}, datiForm('admin', 'a@esempio.it', 'segreto'));

    expect(risultato.errore).toBe('Email o password non corretti.');
  });

  it('con 429 (rate limit) spiega di aspettare, non "password sbagliata"', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 429 }));

    const risultato = await accedi({}, datiForm('admin', 'a@esempio.it', 'segreto'));

    expect(risultato.errore).toBe('Troppi tentativi: aspetta un minuto e riprova.');
  });

  it('con un errore del server (500) risponde con un messaggio diverso da quello delle credenziali', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 500 }));

    const risultato = await accedi({}, datiForm('admin', 'a@esempio.it', 'segreto'));

    expect(risultato.errore).toBe('Si è verificato un errore. Riprova più tardi.');
  });

  it('se gestilab-auth-service è irraggiungibile (fetch lancia) risponde con lo stesso messaggio del 500', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new TypeError('fetch failed'));

    const risultato = await accedi({}, datiForm('admin', 'a@esempio.it', 'segreto'));

    expect(risultato.errore).toBe('Si è verificato un errore. Riprova più tardi.');
    expect(mockCookiesSet).not.toHaveBeenCalled();
  });

  it('con credenziali corrette imposta il cookie giusto per l\'area e reindirizza', async () => {
    const scadeIl = new Date(Date.now() + 60_000).toISOString();
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ token: 'il-token', scadeIl }), { status: 200 }),
    );

    await accedi({}, datiForm('tecnico', 'a@esempio.it', 'segreto'));

    expect(mockCookiesSet).toHaveBeenCalledWith(
      'gl_s_tec',
      'il-token',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }),
    );
    expect(mockRedirect).toHaveBeenCalledWith('/');
  });

  it('invia istitutoId, area, email e password a gestilab-auth-service', async () => {
    mockHeadersGet.mockReturnValue('istituto-xyz');
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ token: 't', scadeIl: new Date().toISOString() }), { status: 200 }));

    await accedi({}, datiForm('admin', 'mario@esempio.it', 'segreto'));

    const [, opzioni] = fetchSpy.mock.calls[0]!;
    const corpo = JSON.parse((opzioni as RequestInit).body as string) as Record<string, string>;
    expect(corpo).toEqual({
      istitutoId: 'istituto-xyz',
      area: 'admin',
      email: 'mario@esempio.it',
      password: 'segreto',
    });
  });
});
