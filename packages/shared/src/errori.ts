// docs/04-convenzioni-codice.md: "Errori di dominio come classi tipizzate
// (ErroreDominio con codice), mai stringhe." Condivisa tra api e web: l'api
// la lancia, web la userà per interpretare le risposte di errore dell'api.

export class ErroreDominio extends Error {
  readonly codice: string;
  readonly statusHttp: number;

  constructor(codice: string, messaggio: string, statusHttp: number) {
    super(messaggio);
    this.name = 'ErroreDominio';
    this.codice = codice;
    this.statusHttp = statusHttp;
  }
}
