import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// Task 0.9: verifica che eslint.config.mjs rifiuti davvero un dominio
// hardcoded, non solo che la regola esista sulla carta. Il file di
// verifica deve stare dentro l'albero del repo (ESLint 9 ignora i file
// fuori dal "base path" del progetto) — creato in packages/shared/, che
// eslint.config.mjs non esclude, e sempre rimosso dopo ogni test.
const RADICE = path.resolve(import.meta.dirname, '../../..');
const ESLINT_BIN = path.join(RADICE, 'node_modules/.bin/eslint');
const CONFIG = path.join(RADICE, 'eslint.config.mjs');

let fileTemporaneo: string | undefined;

afterEach(() => {
  if (fileTemporaneo) {
    rmSync(fileTemporaneo, { force: true });
    fileTemporaneo = undefined;
  }
});

function lintaFrammento(codice: string): { exitCode: number; output: string } {
  const dir = mkdtempSync(path.join(tmpdir(), 'gestilab-lint-'));
  fileTemporaneo = path.join(import.meta.dirname, `.tmp-lint-fixture-${path.basename(dir)}.ts`);
  writeFileSync(fileTemporaneo, codice);

  try {
    execFileSync(ESLINT_BIN, ['--config', CONFIG, fileTemporaneo], { encoding: 'utf8', stdio: 'pipe' });
    return { exitCode: 0, output: '' };
  } catch (errore) {
    const e = errore as { status: number; stdout: string };
    return { exitCode: e.status, output: e.stdout };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('regola anti-dominio-hardcoded (eslint.config.mjs)', () => {
  it('rifiuta un dominio letterale', () => {
    // eslint-disable-next-line no-restricted-syntax -- fixture intenzionale: è questa regola a essere testata
    const { exitCode, output } = lintaFrammento("export const url = 'https://gestilab.it/foo';\n");

    expect(exitCode).not.toBe(0);
    expect(output).toContain('Dominio hardcoded vietato');
  });

  it('rifiuta un dominio dentro un template string', () => {
    // eslint-disable-next-line no-restricted-syntax -- fixture intenzionale: è questa regola a essere testata
    const { exitCode, output } = lintaFrammento('export const url = `https://gestilab.test/foo`;\n');

    expect(exitCode).not.toBe(0);
    expect(output).toContain('Dominio hardcoded vietato');
  });

  it('accetta codice che usa BASE_DOMAIN invece del letterale', () => {
    const { exitCode } = lintaFrammento('export const url = `https://${process.env.BASE_DOMAIN}`;\n');

    expect(exitCode).toBe(0);
  });
});
