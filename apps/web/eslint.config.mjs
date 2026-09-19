import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { FlatCompat } from '@eslint/eslintrc';
import tseslint from 'typescript-eslint';
import globals from 'globals';

import rootConfig from '../../eslint.config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// eslint-config-next non ha ancora una configurazione flat nativa: la sua
// configurazione legacy viene tradotta tramite FlatCompat, come indicato
// dalla documentazione di Next.js per ESLint 9.
const compat = new FlatCompat({ baseDirectory: __dirname });

export default tseslint.config(
  ...rootConfig,
  ...compat.extends('next/core-web-vitals'),
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
);
