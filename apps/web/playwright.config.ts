import { defineConfig, devices } from '@playwright/test';

// End-to-end contro lo stack di sviluppo GIÀ avviato (`pnpm dev:auth`:
// web, api, auth, worker, Mailpit) — nessun webServer qui: Playwright non
// può avviare Docker Compose, e i test toccano davvero Postgres e Mailpit.
// In CI non ancora (servirebbe l'intero compose nel job, docs/04 § CI).
//
// Presuppone il seed demo (`pnpm db:seed`): admin@dellaquila.localhost con
// la password documentata in docs/CLAUDE.md.
//
// Un solo login admin per l'intera suite (progetto "setup" → storageState
// riusato dai test): /accedi ha un rate limit reale di 5 tentativi al
// minuto per IP, e una suite che fa login in ogni test lo supera — con un
// 429 mascherato da "password sbagliata" (bug trovato così, corretto).
// Rilanciare la suite più volte nello stesso minuto può comunque
// incappare nel limite: è il comportamento voluto in produzione.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://dellaquila.localhost:3000',
    trace: 'retain-on-failure',
    locale: 'it-IT',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/admin.json' },
      dependencies: ['setup'],
    },
  ],
});
