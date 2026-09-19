# Appunti — task 0.1 (scheletro monorepo)

## Dipendenze

Nessuna dipendenza fuori dalla lista consentita è stata installata. Tutto quello
che serviva (Zod per la validazione env, `@types/*`, ecc.) rientra nell'elenco
fornito.

## Versioni fissate esplicitamente (non "latest")

Al primo `pnpm add` senza versione, pnpm ha risolto alcuni pacchetti su major
troppo recenti o incompatibili tra loro. Per ottenere una toolchain coerente
ho fissato:

- **`typescript@6.0.3`** invece della 7.x: la 7.x è il nuovo compilatore nativo
  e `@typescript-eslint` non la supporta ancora ("typescript-eslint does not
  support TS 7.0"). La 6.x è la linea classica, quella con cui l'intero
  ecosistema (eslint-plugin, Next) è testato.
- **`eslint@8.57.0`** invece della 10.x: dalla v9 ESLint richiede di default
  `eslint.config.*` (flat config) e la 10.x non supporta più `.eslintrc.*`.
  `eslint-config-next@15.5.25` dichiara come peer solo `^7 || ^8 || ^9`, quindi
  non è comunque compatibile con la 10. Ho scelto la 8.x (LTS di fatto, anche
  se npm la segnala "no longer supported") per restare su config classica
  `.eslintrc.json`, coerente con l'elenco dipendenze consentito (niente
  `@eslint/js`, niente `typescript-eslint` meta-package, niente `globals`, che
  servirebbero per una flat config pulita).
- **`next@15.5.25` / `react@19.3.0` / `react-dom@19.3.0` /
  `eslint-config-next@15.5.25`**: "latest" risolveva a Next 16. La richiesta
  era esplicitamente Next.js 15, quindi ho pinnato all'ultima patch della 15.
- **`tailwindcss@3.4.19`** (non 4.x): la lista dipendenze consentite include
  `tailwindcss`, `postcss`, `autoprefixer` come pacchetti separati, schema
  tipico di Tailwind v3. Tailwind v4 richiede invece `@tailwindcss/postcss`
  (pacchetto non in lista) e cambia il modello di configurazione. Ho quindi
  usato Tailwind v3 con `postcss.config.mjs` + `tailwind.config.ts` classici.

## Nota TypeScript 6/7 e import CSS

Con `typescript@6.0.3` l'import "副effect" `import './globals.css'` in
`apps/web/src/app/layout.tsx` falliva con `TS2882` (nessuna dichiarazione di
modulo per l'estensione `.css`). `next/types/global.d.ts` dichiara solo
`*.module.css`, non `*.css` semplice. Ho aggiunto `apps/web/global.d.ts` con
`declare module '*.css';` — pattern standard, non un workaround fragile.

## Percorso `docs/`

`CLAUDE.md` e il backlog fanno riferimento a una cartella `docs/`, ma nel
repository la documentazione vive in `gestilab_doc/`. Non ho rinominato nulla:
ho letto i documenti dal percorso reale e basta. Segnalo la discrepanza perché
i futuri task che citano `docs/...` andranno letti da `gestilab_doc/...` finché
qualcuno non allinea il nome (è una modifica strutturale, fuori scope per il
task 0.1).
