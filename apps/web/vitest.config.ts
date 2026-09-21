import { defineConfig } from 'vitest/config';

// e2e/**: sono test Playwright (*.spec.ts), non Vitest — senza questa
// esclusione Vitest li raccoglierebbe per il pattern di default e
// fallirebbe importando @playwright/test.
export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/.next/**', 'e2e/**'],
  },
});
