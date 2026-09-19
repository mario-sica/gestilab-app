import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // build standalone: la immagine runner del Dockerfile copia solo
  // .next/standalone + .next/static, senza reinstallare le dipendenze.
  output: 'standalone',
};

export default nextConfig;
