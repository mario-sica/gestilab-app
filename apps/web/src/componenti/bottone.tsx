import type { ButtonHTMLAttributes } from 'react';

type Variante = 'primario' | 'secondario' | 'pericolo';

const CLASSI: Record<Variante, string> = {
  primario: 'bg-gray-900 text-white hover:bg-gray-700',
  secondario: 'border border-gray-400 bg-white text-gray-900 hover:bg-gray-100',
  pericolo: 'bg-red-700 text-white hover:bg-red-800',
};

// Componente base proprio (docs/04: niente librerie UI complete). min-h-11:
// target touch ≥ 44 px; focus visibile mai rimosso (WCAG 2.1 AA).
export function Bottone({
  variante = 'primario',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }): React.JSX.Element {
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center rounded px-4 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-50 ${CLASSI[variante]} ${className}`}
    />
  );
}
