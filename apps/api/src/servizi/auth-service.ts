import { ErroreDominio } from '@gestilab/shared';

export interface InvitoEmesso {
  token: string;
  scadeIl: Date;
}

export interface PinRigenerato {
  pin: string;
  sessioniDocenteRevocate: number;
}

export interface ClientAuthService {
  creaInvito(istitutoId: string, utenteId: string): Promise<InvitoEmesso>;
  rigeneraPinIstituto(istitutoId: string): Promise<PinRigenerato>;
}

// Unico punto in cui apps/api parla con gestilab-auth-service (rete Docker
// interna, AUTH_SERVICE_URL): emissione del token d'invito (task 1.3) e
// rigenerazione del PIN d'istituto (task 1.4). Il login NON passa da qui —
// lo fa apps/web direttamente, per non far transitare la password da un
// sistema in più (vedi il documento di riferimento, sezione sul login).
export function creaClientAuthService(urlBase: string): ClientAuthService {
  async function chiama<T>(percorso: string, corpo: Record<string, string>): Promise<T> {
    let risposta: Response;
    try {
      risposta = await fetch(`${urlBase}${percorso}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(corpo),
      });
    } catch {
      throw new ErroreDominio('AUTH_SERVICE_NON_RAGGIUNGIBILE', 'Servizio di autenticazione non raggiungibile.', 503);
    }
    if (!risposta.ok) {
      throw new ErroreDominio('AUTH_SERVICE_ERRORE', 'Il servizio di autenticazione ha risposto con un errore.', 502);
    }
    return (await risposta.json()) as T;
  }

  return {
    async creaInvito(istitutoId, utenteId) {
      const corpo = await chiama<{ token: string; scadeIl: string }>('/inviti', { istitutoId, utenteId });
      return { token: corpo.token, scadeIl: new Date(corpo.scadeIl) };
    },
    async rigeneraPinIstituto(istitutoId) {
      return chiama<PinRigenerato>('/pin-istituto/rigenera', { istitutoId });
    },
  };
}
