import { richiediSessione } from '../../lib/sessione.js';

// "Oggi" (docs/02): task in scadenza, segnalazioni aperte, alert — tutto
// di fasi successive. Segnaposto autenticato, così il flusso login →
// area → esci esiste anche per l'AT.
export default async function PaginaTecnico(): Promise<React.JSX.Element> {
  const utente = await richiediSessione('tecnico');
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">Oggi</h1>
      <p>Ciao {utente.nome}. Task, segnalazioni e scansione QR arriveranno con le prossime fasi.</p>
    </section>
  );
}
