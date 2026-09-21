import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // build standalone: la immagine runner del Dockerfile copia solo
  // .next/standalone + .next/static, senza reinstallare le dipendenze.
  output: 'standalone',
  // @gestilab/db, @gestilab/shared e gestilab-auth-service (lettura sessione,
  // schema) sono pacchetti del workspace senza un proprio step di build (restano sorgente TypeScript, vedi task 0.1/0.3):
  // Next deve transpilarli lui, non aspettarsi JS già pronto in node_modules.
  transpilePackages: ['@gestilab/db', '@gestilab/shared', 'gestilab-auth-service'],
  webpack: (config) => {
    // I moduli di @gestilab/db e @gestilab/shared usano estensioni .js negli
    // import relativi (richiesto da Node/tsx/vitest in ESM per file .ts, vedi
    // docs/04-convenzioni-codice.md), ma quei file non sono mai compilati in
    // .js: sono sorgente TypeScript transpilato da Next stesso. Il resolver
    // di webpack, a differenza del compilatore TypeScript in modalità
    // "Bundler", non mappa da solo un import "./client.js" al file
    // "./client.ts" reale: va detto esplicitamente, altrimenti qualunque
    // pagina o middleware che importi (anche transitivamente) questi
    // pacchetti fallisce con "Module not found".
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts', '.tsx'],
    };
    return config;
  },
};

export default nextConfig;
