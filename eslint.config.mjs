import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

const regolaDominioLetterale = [
  'error',
  {
    selector: "Literal[value=/gestilab\\.(it|test)/]",
    message: "Dominio hardcoded vietato: usa BASE_DOMAIN da variabili d'ambiente (packages/shared/env.ts).",
  },
  {
    selector: "TemplateElement[value.raw=/gestilab\\.(it|test)/]",
    message: "Dominio hardcoded vietato: usa BASE_DOMAIN da variabili d'ambiente (packages/shared/env.ts).",
  },
];

export default tseslint.config(
  // ignore globali (deve essere l'unica chiave dell'oggetto)
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/next-env.d.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // regole condivise su tutto il codice TypeScript del monorepo
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      'no-restricted-syntax': regolaDominioLetterale,
    },
  },
);
