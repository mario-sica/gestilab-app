# GestiLab — documentazione di progetto

Pacchetto di documenti per lo sviluppo della piattaforma per gli assistenti tecnici delle scuole superiori.

## Contenuto

| File | Uso |
|---|---|
| `specifiche-v1.2.md` | Documento di prodotto completo: problema, normativa, attori, requisiti, roadmap, stack. È il documento da far leggere al DSGA o a un potenziale cliente, non a Claude Code |
| `setup-ambiente-fedora.md` | Preparazione della macchina di sviluppo |
| `docs/CLAUDE.md` | Istruzioni per Claude Code. Va in radice del repo come `CLAUDE.md` |
| `docs/01-dominio.md` | Modello dati autoritativo |
| `docs/02-architettura.md` | Docker, multi-tenancy, routing, deploy |
| `docs/03-api.md` | Contratti API, errori, autorizzazione, rate limit |
| `docs/04-convenzioni-codice.md` | Struttura repo, naming, test, CI |
| `docs/05-offline-pwa.md` | Cache, outbox, conflitti, service worker |
| `docs/06-sicurezza-gdpr.md` | Vincoli giuridici e sicurezza applicativa |
| `docs/07-backlog-mvp.md` | Backlog eseguibile con criteri di chiusura |

## Come usarli nel repo

```
gestilab/
├─ CLAUDE.md          -> link simbolico a docs/CLAUDE.md
├─ docs/              -> 01..07 + CLAUDE.md
└─ ...
```

```bash
mkdir -p gestilab/docs
cp docs/*.md gestilab/docs/
cd gestilab && ln -s docs/CLAUDE.md CLAUDE.md
```

Le specifiche di prodotto restano fuori dal contesto di Claude Code: sono lunghe e contengono materiale commerciale e normativo che non serve a scrivere codice. I documenti `01`-`07` sono scritti per essere letti a pezzi, su richiesta.

## Principio di fase

Il progetto viene sviluppato ed eseguito **interamente in locale**, senza spese: dominio `gestilab.test` (TLD riservato, non registrabile), TLS con CA locale mkcert, MinIO al posto di S3, Mailpit al posto del provider email, GlitchTip al posto di Sentry.

"Pronto per la produzione" non significa "in produzione": significa che il passaggio a un server pubblico è un cambio di variabili d'ambiente, e che ripristino, aggiornamento e rollback sono già stati provati. Le tre prove stanno nella Fase 7 del backlog.

Le uniche spese future, da affrontare solo dopo la validazione con l'AT pilota: dominio (prerequisito alle etichette QR definitive) e VPS.

## Prima di scrivere codice

1. Fai leggere `specifiche-v1.2.md` all'AT pilota con tre casi reali davanti: un PC con dieci software, una multifunzione a noleggio, una LIM condivisa tra tre aule. Annota dove dice "no, non funziona così".
2. Verifica con il DSGA che la relazione sullo stato dei beni sia il documento che gli serve davvero.
3. Solo dopo, Fase 0 del backlog.
