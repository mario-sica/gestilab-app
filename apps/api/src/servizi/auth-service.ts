import { ErroreDominio } from '@gestilab/shared';

export interface InvitoEmesso {
  token: string;
  scadeIl: Date;
}

export interface ClientAuthService {
  creaInvito(istitutoId: string, utenteId: string): Promise<InvitoEmesso>;
}

// Unico punto in cui apps/api parla con gestilab-auth-service (rete Docker
// interna, AUTH_SERVICE_URL). Oggi una sola chiamata: l'emissione del token
// d'invito (task 1.3). Il login NON passa da qui — lo fa apps/web
// direttamente, per non far transitare la password da un sistema in più
// (vedi il documento di riferimento, sezione sulla pagina di login).
export function creaClientAuthService(urlBase: string): ClientAuthService {
  return {
    async creaInvito(istitutoId, utenteId) {
      let risposta: Response;
      try {
        risposta = await fetch(`${urlBase}/inviti`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ istitutoId, utenteId }),
        });
      } catch {
        throw new ErroreDominio('AUTH_SERVICE_NON_RAGGIUNGIBILE', 'Servizio di autenticazione non raggiungibile.', 503);
      }
      if (!risposta.ok) {
        throw new ErroreDominio('AUTH_SERVICE_ERRORE', 'Il servizio di autenticazione ha risposto con un errore.', 502);
      }
      const corpo = (await risposta.json()) as { token: string; scadeIl: string };
      return { token: corpo.token, scadeIl: new Date(corpo.scadeIl) };
    },
  };
}
