'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

// Un QueryClient per sessione browser (useState, non un singleton di
// modulo: in SSR un singleton sarebbe condiviso tra richieste di utenti
// diversi). staleTime > 0: i dati arrivano già dal server come
// initialData (pagine = Server Component), non vanno rifetchati al mount.
export function ProviderQuery({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
