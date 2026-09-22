import { richiediSessioneDocente } from '../../../lib/sessione.js';
import { ModuloEsci } from '../../[area]/esci/modulo-esci.js';

// Area docente (task 1.5, segnaposto): niente "altra area" 403 come per
// admin/tecnico (lib/sessione.ts spiega perché) — un admin o un AT che
// arriva qui senza sessione docente va semplicemente al login docente.
// Testata inline, non IntestazioneArea: quella è tipata su UtenteSessione
// (ruolo, email), una persona non li ha — generalizzarla ora, senza una
// seconda pagina che la usi davvero, sarebbe progettare in astratto.
export default async function LayoutDocente({ children }: { children: React.ReactNode }): Promise<React.JSX.Element> {
  const persona = await richiediSessioneDocente();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-300 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <span className="text-lg font-semibold">GestiLab · Docente</span>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span>
              {persona.nome} {persona.cognome}
            </span>
            <ModuloEsci area="docente" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
