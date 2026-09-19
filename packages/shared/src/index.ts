export const SLUG_RISERVATI = [
  'www',
  'app',
  'console',
  'api',
  'static',
  'admin',
  'status',
  'docs',
  'mail',
  'cdn',
] as const;

export const VERSIONE_API = 'v1' as const;

export type { Env } from './env.js';
export { leggiEnv } from './env.js';
