type Tono = 'errore' | 'successo' | 'info';

const CLASSI: Record<Tono, string> = {
  errore: 'border-red-300 bg-red-50 text-red-900',
  successo: 'border-green-300 bg-green-50 text-green-900',
  info: 'border-blue-300 bg-blue-50 text-blue-900',
};

// Stato mai comunicato dal solo colore (docs/04): il testo dice cosa è
// successo; role=alert per gli errori (interrompe), role=status per il
// resto (annunciato senza interrompere).
export function Avviso({ tono, children }: { tono: Tono; children: React.ReactNode }): React.JSX.Element {
  return (
    <div role={tono === 'errore' ? 'alert' : 'status'} className={`rounded border px-4 py-3 text-sm ${CLASSI[tono]}`}>
      {children}
    </div>
  );
}
