import type { FastifyError, FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { ErroreDominio } from '@gestilab/shared';

// docs/03-api.md: ogni errore risponde { errore: { codice, messaggio } },
// più "dettagli" solo quando l'ErroreDominio ne porta (dati per il client,
// es. areaCorretta su un 403). Nessuno stack, nessun dettaglio interno:
// quello va solo nel log.
export function pluginErrori(app: FastifyInstance): void {
  app.setErrorHandler((errore: FastifyError | ErroreDominio, richiesta, risposta) => {
    if (errore instanceof ErroreDominio) {
      void risposta.status(errore.statusHttp).send({
        errore: {
          codice: errore.codice,
          messaggio: errore.message,
          ...(errore.dettagli ? { dettagli: errore.dettagli } : {}),
        },
      });
      return;
    }

    if (hasZodFastifySchemaValidationErrors(errore)) {
      void risposta.status(400).send({
        errore: { codice: 'RICHIESTA_NON_VALIDA', messaggio: 'Parametri della richiesta non validi.' },
      });
      return;
    }

    // Errore non previsto: log completo (mai al client), risposta generica.
    richiesta.log.error(errore);
    void risposta.status(errore.statusCode ?? 500).send({
      errore: { codice: 'ERRORE_INTERNO', messaggio: 'Si è verificato un errore interno.' },
    });
  });

  app.setNotFoundHandler((_richiesta, risposta) => {
    void risposta.status(404).send({
      errore: { codice: 'RISORSA_NON_TROVATA', messaggio: 'Risorsa non trovata.' },
    });
  });
}
