# 03 — API: contratti, errori, paginazione

Riferimento autoritativo per rotte, contratti e formato di errore dell'API Fastify (`apps/api`). Lo spec OpenAPI, generato dagli schemi Zod delle rotte, è servito su `/documentazione` (interfaccia) e `/documentazione/json` (spec grezzo); questo documento ne spiega le convenzioni, non ne duplica il contenuto.

## Versionamento

Ogni rotta vive sotto `/api/{VERSIONE_API}/...`, con `VERSIONE_API` da `packages/shared` (oggi `v1`). Nessuna rotta con la versione scritta a mano: si importa la costante.

## Formato di errore

Ogni errore, di qualunque tipo, risponde con lo stesso payload:

```json
{ "errore": { "codice": "TENANT_NON_TROVATO", "messaggio": "Istituto non trovato." } }
```

- `codice`: stringa stabile in `SCREAMING_SNAKE_CASE`, pensata per essere confrontata nel codice (mai per il parsing del messaggio).
- `messaggio`: testo in italiano per l'utente finale o per il log; può cambiare, non va confrontato a stringa.
- `dettagli` (opzionale): oggetto con dati strutturati per il client, presente solo quando il codice lo prevede (la tabella sotto dice quali). Mai informazioni interne: ciò che sta qui arriva al browser così com'è.

```json
{ "errore": { "codice": "RUOLO_NON_VALIDO", "messaggio": "Non hai i permessi per questa azione.", "dettagli": { "areaCorretta": "admin" } } }
```

Realizzato da `apps/api/src/plugin/errori.ts` (`setErrorHandler` centrale): ogni `ErroreDominio` (`packages/shared/src/errori.ts`, con `codice` e `statusHttp` propri) produce questa forma automaticamente. Un errore non previsto risponde `500` con `codice: "ERRORE_INTERNO"` e un messaggio generico: mai stack trace o dettagli interni nella risposta, quello resta solo nel log strutturato del server.

| Codice | Status | Quando |
|---|---|---|
| `RICHIESTA_NON_VALIDA` | 400 | Corpo/query/parametri che non passano lo schema Zod della rotta |
| `TENANT_MANCANTE` | 400 | Header `X-Tenant-Slug` assente su una rotta che lo richiede |
| `SESSIONE_MANCANTE` | 401 | Cookie di sessione dell'area assente, sconosciuto, scaduto, di un'altra area, di un altro istituto (task 1.7: la riga di sessione non è visibile sotto l'RLS dell'istituto risolto dall'header) o di un utente disattivato — sempre lo stesso codice, non si distingue il caso |
| `RUOLO_NON_VALIDO` | 403 | Sessione valida ma ruolo non ammesso dalla rotta. `dettagli.areaCorretta` (`admin` \| `tecnico`) è l'area a cui il ruolo appartiene (`AREA_PER_RUOLO`, `packages/shared`): `apps/web` la usa per mostrare il link all'area giusta, non un redirect al login (`docs/02-architettura.md` § Aree) |
| `TENANT_NON_TROVATO` | 404 | Slug riservato, malformato, o nessun istituto attivo con quello slug |
| `RISORSA_NON_TROVATA` | 404 | Rotta inesistente |
| `ASSET_NON_TROVATO` | 404 | Asset inesistente **o** fuori dal perimetro affidamenti dell'AT (task 2.2) — stesso codice per entrambi i casi: fuori perimetro non deve rivelare che l'asset esiste (docs/06-sicurezza-gdpr.md § 2.3) |
| `EMAIL_GIA_PRESENTE` | 409 | Invito utente con un'email già usata nello stesso istituto (indice `utenti_istituto_id_email_idx`) |
| `ETICHETTA_GIA_PRESENTE` | 409 | Crea/modifica asset con un'`etichetta` già usata nello stesso istituto (indice `asset_istituto_id_etichetta_idx`) |
| `TROPPE_RICHIESTE` | 429 | Limite di frequenza superato |
| `CONTESTO_MANCANTE` | 500 | Errore di programmazione: `pluginSessione` registrato senza `pluginTenant` prima |
| `AUTH_SERVICE_ERRORE` | 502 | gestilab-auth-service ha risposto con un errore a una chiamata interna |
| `AUTH_SERVICE_NON_RAGGIUNGIBILE` | 503 | gestilab-auth-service non raggiungibile (profilo `auth` non avviato, rete) |
| `ERRORE_INTERNO` | 500 | Qualunque errore non previsto |

Ogni nuovo modulo che introduce i propri codici (`ASSET_NON_TROVATO`, `SEGNALAZIONE_GIA_CHIUSA`, ecc.) li aggiunge a questa tabella nello stesso commit.

## Contesto tenant

Regola non negoziabile #2 di `docs/CLAUDE.md`: il tenant si ricava dall'host, mai da un input del client senza rivalidazione. Il flusso:

1. Il middleware Next.js (`apps/web/src/middleware.ts`, task 0.6) risolve lo slug dall'`Host` e lo inoltra come header `X-Tenant-Slug` alle chiamate verso l'API.
2. `apps/api/src/plugin/tenant.ts` (`pluginTenant`) **rivalida** quell'header — non si fida del client — con la stessa query di lookup condivisa (`trovaIstitutoAttivoDaSlug`, `packages/db/src/tenant.ts`), unica sia per il middleware web sia per l'API. Slug assente → `400 TENANT_MANCANTE`; slug riservato, malformato o senza istituto attivo corrispondente → `404 TENANT_NON_TROVATO`, sempre lo stesso codice: non si distingue "non esiste" da "esiste ma è sospeso", per non rivelare nulla a chi indovina slug.
3. Un tenant risolto decora `request.tenantId`, pronto per essere passato a `withTenant(db, request.tenantId, fn)` (`packages/db`) nel repository del modulo.

`pluginTenant` **non è registrato globalmente**: va montato dal singolo modulo che lo richiede (`app.register(pluginTenant, { db })` dentro il suo contesto). `/api/v1/salute` resta pubblica e non lo richiede.

## Area admin: `/api/v1/admin/*`

Contesto Fastify dedicato (`apps/api/src/app.ts`): `pluginTenant` + `pluginSessione` con area `admin` (cookie `gl_s_adm`) registrati solo lì, poi le rotte dei moduli admin. Ogni rotta dichiara i ruoli ammessi con `richiediRuolo([...])`; il supervisore entra nell'area ma è in sola lettura, quindi le rotte di scrittura ammettono solo `admin`.

### `POST /api/v1/admin/utenti/inviti` — invita un utente (task 1.3, RF-A2)

Ruoli: `admin`. Corpo: `schemaNuovoInvitoUtente` (`packages/shared`): `email`, `nome`, `cognome`, `ruolo` (`admin` | `at` | `supervisore`). Crea l'utente **senza password**, chiede a gestilab-auth-service un token d'invito (`POST /inviti`, 72 h, monouso) e accoda al worker l'email con il link `{origine del tenant}/invito/{token}` — l'origine è `WEB_PROTOCOLLO://{slug}.BASE_DOMAIN[:WEB_PORTA]` (`origineTenant`, `packages/shared`), mai un dominio scritto nel codice. Risponde `201 { utenteId, scadeIl }`.

### `GET /api/v1/admin/utenti` — elenco utenti

Ruoli: `admin`, `supervisore`. Risponde `schemaUtenteElenco[]` (`packages/shared`): id, email, nome, cognome, ruolo, attivo, `passwordImpostata` (ha già accettato l'invito), `ultimoAccesso`. Mai `password_hash`. Ordinato per cognome e nome, **senza paginazione**: gli utenti di un istituto sono decine, non migliaia — la paginazione si definisce con la prima lista aperta (asset), non qui.

### `GET /api/v1/admin/impostazioni` · `PATCH /api/v1/admin/impostazioni` · `POST /api/v1/admin/impostazioni/pin-docente` — accesso docente (task 1.4/1.5)

`GET` (admin, supervisore): `{ modalitaAccessoDocente, pinImpostato }` — mai il PIN, che non è rileggibile (esiste solo l'hash). `PATCH` (solo admin): corpo `schemaAggiornaImpostazioni` (`packages/shared`), `{ modalitaAccessoDocente }` tra `solo_qr` | `pin_istituto` | `pin_personale` (`MODALITA_ACCESSO_DOCENTE_SELEZIONABILI` — non `sso`, non ancora implementato, RF-A5 V1); scrittura diretta su `istituti`, nessuna chiamata a gestilab-auth-service (è dominio, non una credenziale). `POST …/pin-docente` (solo admin): chiede a gestilab-auth-service la rigenerazione (`POST /pin-istituto/rigenera`: 6 cifre, Argon2id in `istituti.pin_istituto_hash`, revoca di tutte le `sessioni_docente` attive nella stessa transazione) e risponde `{ pin, sessioniDocenteRevocate }` **una sola volta**: il PIN non viene conservato né loggato (`redact` su `pin`).

Se l'auth-service o la coda falliscono l'utente resta creato ma senza invito (nessun rollback: l'Admin lo vede in elenco e lo reinvita, che è anche la via per un link scaduto). L'invio dell'email è asincrono (coda `email`, `apps/worker`): un `201` dice che l'email è stata accodata, non consegnata.

## Area docente: `/api/v1/docente/*` (task 1.5)

Contesto Fastify dedicato, come `/admin/*` ma **senza `pluginSessione`**: solo `pluginTenant`, perché queste rotte servono la pagina di login, prima che una sessione esista. `request.utente` non esiste qui.

### `GET /api/v1/docente/persone?query=…` — autocomplete del login docente

Pubblico (nessuna sessione), tenant-scoped. `query` minimo 2 caratteri (`400 RICHIESTA_NON_VALIDA` sotto soglia — su un endpoint pubblico una ricerca troppo corta esporrebbe l'intero elenco). Risponde `schemaPersonaRicerca[]` (`packages/shared`): `id`, `nome`, `cognome`, `qualifica` — solo persone attive, non eliminate, dell'anno scolastico corrente, il cui `nome || ' ' || cognome` contiene `query` (`ILIKE`, indice trigram di `persone`). Risponde sempre una **lista vuota**, mai un errore, se `istituti.modalita_accesso_docente` non è `pin_istituto` o `pin_personale`, o l'istituto non è attivo: un elenco pubblico di nomi non serve a nulla dove il login docente non è attivo, ed è superficie esposta senza motivo.

## Area tecnico: `/api/v1/tecnico/*` (task 2.2)

Contesto Fastify dedicato, come `/admin/*`: `pluginTenant` + `pluginSessione` con area `tecnico` (cookie `gl_s_tec`). Ruoli: solo `at` (`AREA_PER_RUOLO` mappa `at` → `tecnico`, unico ruolo di quest'area — nessun `richiediRuolo` con più valori qui).

**Perimetro affidamenti** (docs/06-sicurezza-gdpr.md § 2.3, "Regole di dominio da testare" #5): ogni rotta filtra sempre sugli `ambiente_id` con un `affidamenti_ambienti` aperto (`data_fine IS NULL`) per quell'utente nell'anno scolastico corrente, ricalcolato a ogni richiesta — mai una lista salvata in sessione. Un asset fuori da questo perimetro risponde **404 `ASSET_NON_TROVATO`**, identico a un id inesistente: non rivela che l'asset esiste in un altro laboratorio.

### `GET /api/v1/tecnico/asset` — elenco (paginato)

Query: `pagina` (default 1), `perPagina` (default 50, max 100), `ambienteId?`, `stato?`, `query?` (cerca in `etichetta`, `ILIKE`). Risponde `schemaListaAsset`: `{ dati: Asset[], totale, pagina, perPagina }` — vedi § Paginazione.

### `GET /api/v1/tecnico/asset/:id` — dettaglio

`404 ASSET_NON_TROVATO` se l'id non esiste, è fuori perimetro, o l'asset è soft-eliminato (`eliminato_il` non nullo).

### `POST /api/v1/tecnico/asset` — crea

Corpo: `schemaNuovoAsset`. `ambienteId` deve essere nel perimetro dell'AT (altrimenti `404 ASSET_NON_TROVATO`, non 403: non si conferma nemmeno che l'ambiente esiste fuori dal proprio perimetro). `codice_breve`/`qr_token` generati dal server (`packages/db/src/codici-asset.ts`, task 2.1/2.3: 6 caratteri senza ambiguità e 22 char base64url, retry su collisione). `stato` parte sempre `attivo`. Se `parentAssetId` è indicato, deve riferirsi a un asset dello stesso istituto e senza a sua volta un parent (profondità massima 1, docs/01-dominio.md). Risponde `201 Asset`.

### `PATCH /api/v1/tecnico/asset/:id` — modifica

Corpo: `schemaModificaAsset` (tutti i campi opzionali tranne almeno uno). **Non accetta `ambienteId`**: cambiare ambiente passa solo da un movimento (task 2.7), non da questa rotta — un `ambienteId` nel corpo è un campo sconosciuto per lo schema, `400 RICHIESTA_NON_VALIDA`. `404 ASSET_NON_TROVATO` se fuori perimetro.

### `DELETE /api/v1/tecnico/asset/:id` — elimina

Soft delete: valorizza `eliminato_il`, non cancella la riga (docs/01-dominio.md: asset è una delle due sole tabelle con soft delete). `404 ASSET_NON_TROVATO` se fuori perimetro o già eliminato. Risponde `204`.

## Area pubblica: `/api/v1/pubblico/*` (task 2.3)

Contesto Fastify dedicato, come `/docente/*`: solo `pluginTenant`, **nessuna sessione**. La superficie più esposta del sistema (docs/CLAUDE.md regola non negoziabile 6, docs/06-sicurezza-gdpr.md § 2.5): dietro la pagina web `/q/{token}` (docs/02-architettura.md § Routing) raggiunta scansionando il QR stampato su un'etichetta, o digitando il codice breve quando il QR non è leggibile.

Risponde sempre `schemaAssetPubblico` (`packages/shared`): `etichetta`, `tipoAsset`, `categoria`, `marca`, `modello`, `ambiente`, `stato` — **mai** `seriale`, `numero_inventario`, `valore_acquisto`, fornitore/contratto, date, `attributi`: nessun dato patrimoniale o interno, solo ciò che conferma "hai inquadrato il bene giusto ed è in questo stato". Ogni risposta ha `Cache-Control: no-store`.

`404 ASSET_NON_TROVATO` per **qualunque** motivo il bene non sia mostrabile — token/codice inesistente, asset soft-eliminato, `pagina_pubblica_attiva = false`, istituto non attivo (quest'ultimo caso non arriva nemmeno qui: `pluginTenant` risponde già `404 TENANT_NON_TROVATO` prima) — stesso principio del perimetro AT: non distinguere "non esiste" da "esiste ma non è visibile".

### `GET /api/v1/pubblico/asset/qr/:token` — risoluzione da scansione QR

Rate limit per **token**, non per IP (quello lo copre già il limite globale sotto): 60/min. Una classe che scansiona lo stesso QR da telefoni diversi in pochi minuti non deve bloccarsi a vicenda; uno scraping aggressivo sullo stesso bene sì.

### `GET /api/v1/pubblico/asset/codice-breve/:codice` — risoluzione da codice a 6 caratteri

Come sopra ma 20/min: il codice breve ha molta meno entropia del `qr_token` (docs/01-dominio.md), un limite più stretto scoraggia un tentativo per esaurimento. Il codice è normalizzato a maiuscolo lato server (l'alfabeto di generazione lo è).

## Rate limit

`@fastify/rate-limit` con store Redis (non in-memory: l'API deve reggere più repliche in futuro senza cambiare codice). Soglia globale di default: 100 richieste/minuto per IP. Header di risposta standard (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) su ogni richiesta. Oltre soglia: `429 TROPPE_RICHIESTE`.

Gli endpoint pubblici sensibili (`/pubblico/asset/*`, sopra) hanno una soglia propria, più stretta e per chiave diversa (il token/codice, non l'IP) — sovrascrivendo il default per quella rotta, non cambiando il default globale.

## Logging

Fastify/Pino, JSON su stdout. `redact` (`apps/api/src/plugin/logger.ts`) rimuove `authorization`, `cookie`, e qualunque campo `password`/`pin`/`token` prima che finiscano nel log, coerente con `docs/06-sicurezza-gdpr.md` § 2.8 (nessun dato personale nei log). Ogni richiesta ha un `reqId` di correlazione, generato da Fastify.

## Paginazione

Definita da `GET /api/v1/tecnico/asset` (task 2.2), prima lista che ne ha avuto bisogno (gli elenchi di Fase 1 — utenti, persone — sono decine di righe, non serviva). Stile pagina/numero, non cursore: i dataset di un istituto sono centinaia o poche migliaia di righe, non milioni, e un cursore aggiungerebbe complessità senza un bisogno reale.

- Query: `pagina` (1-based, default 1), `perPagina` (default 50, max 100).
- Risposta: `{ dati: T[], totale, pagina, perPagina }` — `totale` è il conteggio di tutte le righe che soddisfano i filtri, non solo quelle nella pagina corrente (necessario per calcolare il numero di pagine lato client).
- Ordinamento sempre esplicito e stabile (mai "l'ordine naturale della tabella"): `GET /asset` ordina per `etichetta`, unique per istituto.
- Ogni nuovo endpoint di lista segue questa stessa forma, salvo un motivo specifico per deviare (documentato lì).
