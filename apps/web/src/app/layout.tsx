import type { Metadata } from 'next';

import './globals.css';
import { ProviderQuery } from '../componenti/provider-query.js';

export const metadata: Metadata = {
  title: 'GestiLab',
  description: 'Censimento attrezzature, interventi e segnalazioni per le scuole superiori.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <html lang="it">
      <body>
        <ProviderQuery>{children}</ProviderQuery>
      </body>
    </html>
  );
}
