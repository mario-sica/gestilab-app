import { z } from 'zod';

// POST /docente/accedi (gestilab-auth-service, task 1.5): persona scelta
// dall'autocomplete (GET /api/v1/docente/persone) + PIN. Speculare a
// schemaNuovoInvitoUtente: schema condiviso, messaggio italiano nello
// schema stesso — l'auth-service risponde comunque un solo codice
// generico (CREDENZIALI_NON_VALIDE) per non distinguere "persona
// sbagliata" da "PIN sbagliato".
export const schemaAccessoDocente = z.object({
  personaId: z.string('Scegli il tuo nome dall’elenco.').uuid('Scegli il tuo nome dall’elenco.'),
  pin: z.string().length(6, 'Il PIN ha 6 cifre.').regex(/^\d+$/, 'Il PIN contiene solo cifre.'),
});
export type AccessoDocente = z.infer<typeof schemaAccessoDocente>;
