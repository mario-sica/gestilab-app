import type { Metadata } from 'next';

import './globals.css';

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
      <body>{children}</body>
    </html>
  );
}
