# GestiLab

Piattaforma SaaS multi-tenant per gli assistenti tecnici delle scuole superiori italiane: censimento attrezzature con QR, registro interventi, segnalazioni guasti dai docenti, task del DSGA, report patrimoniali. Questo repository è uno scheletro di monorepo (task 0.1 del backlog MVP): non contiene ancora logica applicativa, database o infrastruttura Docker.

Questo repository contiene il codice applicativo — `apps/web` (Next.js 15), `apps/api` (Fastify), i pacchetti condivisi (`packages/shared`, `packages/db`) — insieme a Dockerfile, CI/CD e ambiente di sviluppo locale (Docker Compose). **Non** contiene l'autenticazione né gli artefatti di deploy di produzione: vedi sotto.

## Tre repository, per scelta

GestiLab è diviso in tre repository, ciascuno con un confine di responsabilità e un livello di visibilità distinti:

| Repository | Contiene | Visibilità |
|---|---|---|
| `gestilab-app` (questo repo) | Codice applicativo, Dockerfile, CI/CD, ambiente di sviluppo locale | Pubblico |
| [`gestilab-auth-service`](https://github.com/mario-sica/gestilab-auth-service) | Autenticazione: login, password, PIN, TOTP, sessioni | **Privato** |
| [`gestilab-infra`](https://github.com/mario-sica/gestilab-infra) | Deploy di produzione: `compose.prod.yaml`, Traefik, documentazione operativa | Pubblico |

**Perché.** Il codice che gestisce le credenziali è la superficie più sensibile del sistema: isolarlo in un repository proprio e privato riduce chi/cosa può vederlo, per motivi di sicurezza reali — non organizzativi. Isolare anche il deploy di produzione (`gestilab-infra`) tiene i segreti reali (`.env` di quel repository) fuori da questo, dove chiunque può guardare il codice. È un costo di coordinamento in più (tre CI, tre cicli di branch/merge, una procedura di deploy che clona due repository invece di uno), accettato consapevolmente per quel motivo — non introdotto per moda architetturale.

L'autenticazione condivide comunque lo stesso database Postgres di questo repository (stesso schema, tabelle `utenti`/`persone`, un ruolo Postgres dedicato): la separazione è di codice e di repository, non di dati. Duplicare l'identità degli utenti tra due database sarebbe un problema di coerenza distribuita che un pilota su un solo istituto non ha bisogno di affrontare. Il dettaglio di come si integrano è nel `README.md` di `gestilab-auth-service`.

`compose.local-prod.yaml` (verifica locale della prontezza alla produzione, HTTPS via mkcert) resta qui: è uno strumento di sviluppo, non un artefatto di deploy — un contributor deve poter verificarlo clonando solo questo repository. Solo `compose.prod.yaml` (mai eseguito finché non c'è un dominio registrato e un VPS) vive in `gestilab-infra`.

## Come si avvia

Requisiti: Docker e Docker Compose. Copia `.env.example` in `.env`, poi:

```bash
pnpm dev              # http://dellaquila.localhost:3000, hot reload
pnpm db:migrate        # migrazioni Drizzle (una volta, dopo il primo avvio)
pnpm db:seed           # due tenant demo (dellaquila, demo)
```

Verifica del codice: `pnpm lint && pnpm typecheck && pnpm test` (richiede Postgres/Redis in esecuzione — via `pnpm dev` — per i test di integrazione). `pnpm local-prod` avvia il profilo con HTTPS locale (immagini buildate, Traefik, certificato mkcert): vedi `docs/setup-ambiente-fedora.md` per il setup del certificato.

La documentazione di riferimento del progetto — dominio, architettura, API, convenzioni, sicurezza, backlog — è in `docs/`, a partire da `docs/CLAUDE.md`.
