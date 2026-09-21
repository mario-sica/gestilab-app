import { useId, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react';

interface PropsBase {
  etichetta: string;
  errore?: string | undefined;
  suggerimento?: string;
}

// Label sempre associata e visibile (docs/04 § Accessibilità: niente
// placeholder al posto della label); errore collegato con aria-describedby
// e annunciato con role=alert.
export function Campo({
  etichetta,
  errore,
  suggerimento,
  ...props
}: PropsBase & InputHTMLAttributes<HTMLInputElement>): React.JSX.Element {
  const id = useId();
  const idErrore = `${id}-errore`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {etichetta}
      </label>
      <input
        id={id}
        aria-invalid={errore ? true : undefined}
        aria-describedby={errore ? idErrore : undefined}
        {...props}
        className="min-h-11 rounded border border-gray-400 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
      />
      {suggerimento && !errore && <p className="text-xs text-gray-600">{suggerimento}</p>}
      {errore && (
        <p id={idErrore} role="alert" className="text-sm text-red-700">
          {errore}
        </p>
      )}
    </div>
  );
}

export function CampoSelezione({
  etichetta,
  errore,
  opzioni,
  ...props
}: PropsBase & SelectHTMLAttributes<HTMLSelectElement> & { opzioni: { valore: string; testo: string }[] }): React.JSX.Element {
  const id = useId();
  const idErrore = `${id}-errore`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {etichetta}
      </label>
      <select
        id={id}
        aria-invalid={errore ? true : undefined}
        aria-describedby={errore ? idErrore : undefined}
        {...props}
        className="min-h-11 rounded border border-gray-400 bg-white px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
      >
        {opzioni.map((o) => (
          <option key={o.valore} value={o.valore}>
            {o.testo}
          </option>
        ))}
      </select>
      {errore && (
        <p id={idErrore} role="alert" className="text-sm text-red-700">
          {errore}
        </p>
      )}
    </div>
  );
}
