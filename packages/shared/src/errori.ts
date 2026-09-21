// docs/04-convenzioni-codice.md: "Errori di dominio come classi tipizzate
// (ErroreDominio con codice), mai stringhe." Condivisa tra api e web: l'api
// la lancia, web la userà per interpretare le risposte di errore dell'api.

export class ErroreDominio extends Error {
  readonly codice: string;
  readonly statusHttp: number;
  // Dati strutturati opzionali che il client può usare (docs/03-api.md §
  // Formato di errore), es. l'area corretta su un 403 di ruolo. Mai
  // dettagli interni: finiscono nella risposta HTTP così come sono.
  readonly dettagli: Readonly<Record<string, unknown>> | undefined;

  constructor(codice: string, messaggio: string, statusHttp: number, dettagli?: Readonly<Record<string, unknown>>) {
    super(messaggio);
    this.name = 'ErroreDominio';
    this.codice = codice;
    this.statusHttp = statusHttp;
    this.dettagli = dettagli;
  }
}
