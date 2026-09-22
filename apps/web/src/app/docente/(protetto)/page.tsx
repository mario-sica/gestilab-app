import { richiediSessioneDocente } from '../../../lib/sessione.js';

// docs/02-architettura.md: /docente → "le mie segnalazioni" (Fase 4).
// Segnaposto autenticato per ora: chiude il flusso login → area → esci
// per il docente, come già fatto per /tecnico nel frontend minimo.
export default async function PaginaDocente(): Promise<React.JSX.Element> {
  const persona = await richiediSessioneDocente();
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">Le mie segnalazioni</h1>
      <p>Ciao {persona.nome}. Questa sezione arriverà con la Fase 4 del backlog.</p>
    </section>
  );
}
