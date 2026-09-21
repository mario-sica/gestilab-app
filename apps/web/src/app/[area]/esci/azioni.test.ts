import { beforeEach, describe, expect, it, vi } from 'vitest';

// Stesso schema di login/azioni.test.ts: vi.hoisted per i mock usati dentro
// vi.mock (sollevato in cima al file).
const { mockHeadersGet, mockCookieGet, mockCookieDelete, mockRedirect } = vi.hoisted(() => ({
  mockHeadersGet: vi.fn<(nome: string) => string | null>(),
  mockCookieGet: vi.fn<(nome: string) => { value: string } | undefined>(),
  mockCookieDelete: vi.fn(),
  mockRedirect: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => ({ get: mockHeadersGet })),
  cookies: vi.fn(async () => ({ get: mockCookieGet, delete: mockCookieDelete })),
}));

// redirect() di Next interrompe l'esecuzione lanciando: il mock fa lo
// stesso, altrimenti il codice dopo un redirect (che in produzione non
// gira mai) girerebbe solo qui, falsando i test.
vi.mock('next/navigation', () => ({
  redirect: (...argomenti: unknown[]) => {
    mockRedirect(...argomenti);
    throw new Error('NEXT_REDIRECT');
  },
}));

const { esci } = await import('./azioni.js');

function datiForm(area: string): FormData {
  const dati = new FormData();
  dati.set('area', area);
  return dati;
}

describe('esci', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockHeadersGet.mockReturnValue('istituto-test-id');
    mockCookieGet.mockReturnValue({ value: 'il-token' });
  });

  it('con un\'area sconosciuta nel form risponde con un errore, senza toccare cookie né servizio', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');

    const risultato = await esci({}, datiForm('docente'));

    expect(risultato.errore).toBe('Area non valida.');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockCookieDelete).not.toHaveBeenCalled();
  });

  it('senza cookie di sessione reindirizza al login senza chiamare gestilab-auth-service', async () => {
    mockCookieGet.mockReturnValue(undefined);
    const fetchSpy = vi.spyOn(global, 'fetch');

    await expect(esci({}, datiForm('admin'))).rejects.toThrow('NEXT_REDIRECT');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockCookieDelete).not.toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledWith('/admin/login');
  });

  it('senza x-tenant-id risponde con un errore, senza chiamare gestilab-auth-service', async () => {
    mockHeadersGet.mockReturnValue(null);
    const fetchSpy = vi.spyOn(global, 'fetch');

    const risultato = await esci({}, datiForm('admin'));

    expect(risultato.errore).toBe('Istituto non riconosciuto.');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('revoca la sessione con istitutoId e token del cookie dell’area', async () => {
    mockHeadersGet.mockReturnValue('istituto-xyz');
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));

    await expect(esci({}, datiForm('tecnico'))).rejects.toThrow('NEXT_REDIRECT');

    expect(mockCookieGet).toHaveBeenCalledWith('gl_s_tec');
    const [url, opzioni] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toMatch(/\/esci$/);
    expect(JSON.parse((opzioni as RequestInit).body as string)).toEqual({ istitutoId: 'istituto-xyz', token: 'il-token' });
  });

  it('a revoca riuscita cancella il cookie dell’area e reindirizza al login di quell’area', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));

    await expect(esci({}, datiForm('tecnico'))).rejects.toThrow('NEXT_REDIRECT');

    expect(mockCookieDelete).toHaveBeenCalledWith('gl_s_tec');
    expect(mockRedirect).toHaveBeenCalledWith('/tecnico/login');
  });

  it('se la revoca fallisce (5xx) NON cancella il cookie e mostra un errore', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 503 }));

    const risultato = await esci({}, datiForm('admin'));

    expect(risultato.errore).toBe('Non è stato possibile uscire. Riprova più tardi.');
    expect(mockCookieDelete).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('se gestilab-auth-service è irraggiungibile (fetch lancia) NON cancella il cookie e mostra un errore', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new TypeError('fetch failed'));

    const risultato = await esci({}, datiForm('admin'));

    expect(risultato.errore).toBe('Non è stato possibile uscire. Riprova più tardi.');
    expect(mockCookieDelete).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
