# 06 — Sicurezza, privacy e vincoli giuridici

Questo documento contiene vincoli **non negoziabili**. Se un requisito funzionale li contraddice, si ferma il requisito, non il vincolo.

## 1. Vincoli di prodotto derivanti dalla legge

### 1.1 Nessun controllo a distanza dei lavoratori (art. 4 L. 300/1970)
L'AT è un lavoratore dipendente. Un sistema che misura i suoi tempi è potenzialmente uno strumento di controllo, soggetto ad accordo sindacale. Il prodotto è progettato per **non esserlo**:
- Nessuna geolocalizzazione, in nessuna forma, nemmeno "opzionale".
- `durata_minuti` è sempre facoltativo, mai precompilato, mai calcolato automaticamente.
- Nessun report per singola persona: gli aggregati sono per ambiente, plesso, tipo di intervento.
- Nessuna classifica, punteggio, badge, "tempo medio di risposta per AT".
- Nessun alert all'Admin del tipo "l'AT non ha ancora preso in carico".
- Il prodotto fornisce un modello di informativa ai lavoratori da consegnare alla RSU.

Se un cliente chiede esplicitamente metriche individuali: è una richiesta da valutare con un consulente del lavoro, non da implementare.

### 1.2 Nessun dato di studenti
Nessun campo, nessun import, nessuna foto che li ritragga (istruzione esplicita nella UI di caricamento allegati: "non fotografare persone"). Se un allegato contiene volti, l'AT può eliminarlo; il sistema non fa riconoscimento di alcun tipo.

### 1.3 Ruoli GDPR
- Istituto scolastico = **titolare del trattamento**.
- Fornitore (tu) = **responsabile del trattamento** ex art. 28: serve un DPA firmato con ogni istituto, allegato al contratto.
- Eventuali sub-responsabili (hosting, email, error tracking) elencati nel DPA con obbligo di preavviso in caso di modifica.

### 1.4 Dati personali trattati
| Categoria | Dati | Base |
|---|---|---|
| Utenti (AT, Admin) | nome, cognome, email, log di accesso | Esecuzione del contratto |
| Personale segnalante | nome, cognome, qualifica, segnalazioni aperte | Interesse legittimo del titolare all'organizzazione del servizio |
| Segnalanti fuori elenco | nome digitato | Idem |

Nessuna categoria particolare (art. 9). Nessun profilo. Nessun trattamento automatizzato con effetti sulle persone.

### 1.5 Retention e cancellazione
- Segnalazioni e interventi: conservati per `retention_anni` (default 10, motivato dalla ricognizione quinquennale e dalla responsabilità patrimoniale).
- Nomi dei segnalanti: anonimizzati ("Docente") dopo 3 anni, salvo diversa istruzione del titolare; interventi e statistiche restano.
- `ip_hash` delle segnalazioni pubbliche: cancellato dopo 7 giorni (serve solo al rate limit).
- Cessazione contratto: export completo consegnato entro 30 giorni, cancellazione definitiva entro 90 giorni, con attestazione scritta.
- Backup: la cancellazione si propaga alla scadenza della rotazione (max 30 giorni), documentato nel DPA.

### 1.6 Informative
- Pagina pubblica `/q/{token}`: link "Come trattiamo i tuoi dati" sempre visibile, testo breve, fornito dall'app e personalizzabile dall'istituto con i propri riferimenti e DPO.
- Area docente: informativa mostrata al primo accesso.
- Nessun cookie di terze parti, nessun analytics di terze parti, nessun banner cookie necessario (solo cookie tecnici di sessione).

### 1.7 Accessibilità (L. 4/2004)
WCAG 2.1 AA su tutte le aree. Dichiarazione di accessibilità pubblicata dal fornitore e aggiornata annualmente. È un requisito per vendere alla PA, non un di più.

### 1.8 Qualificazione cloud ACN
I servizi SaaS destinati alla PA devono essere qualificati da ACN, con requisiti (ISO 27001 + 27017 + 27018, o CSA STAR L2) non sostenibili all'avvio. Conseguenze sul prodotto:
- L'architettura resta interamente auto-ospitabile (nessuna dipendenza da servizi proprietari non sostituibili) per poter offrire l'installazione presso l'istituto. Il fatto che l'intero sistema giri già su una singola macchina non è un accidente della fase iniziale: è la prova che l'opzione self-hosted funziona, ed è un argomento da usare nella trattativa.
- Il contratto è trasparente sullo stato di qualificazione: non va taciuto.
- Percorso: DPA solido e hosting UE ora → certificazione e qualificazione quando i ricavi la sostengono, o partner già qualificato.

## 2. Sicurezza applicativa

### 2.1 Autenticazione
| Soggetto | Metodo | 2FA |
|---|---|---|
| Admin | email + password, o SSO | TOTP obbligatoria |
| AT | email + password, o SSO | TOTP opzionale, consigliata |
| Docente | persona da elenco + PIN istituto o personale, o SSO | no |

- Password: Argon2id (m=19456, t=2, p=1), minimo 12 caratteri, controllo contro liste di password compromesse note, nessuna scadenza forzata.
- PIN: Argon2id, 6 cifre, rate limit severo, rigenerabile in un clic con revoca di tutte le sessioni docente.
- Sessioni: token opaco casuale (32 byte) conservato lato server con hash; nessun JWT autoconsistente per le sessioni di navigazione.
- Revoca: l'Admin può chiudere tutte le sessioni di un utente; il cambio password le invalida tutte.

### 2.2 Cookie
`HttpOnly`, `Secure`, `SameSite=Lax`, `Domain` limitato al sottodominio del tenant, nomi distinti per area (`gl_s_doc`, `gl_s_tec`, `gl_s_adm`), `Path=/`.

### 2.3 Autorizzazione
- Ruolo letto solo dalla sessione server-side; mai da header, query o campo nascosto.
- Perimetro AT ricalcolato a ogni richiesta dagli affidamenti dell'anno corrente.
- Fuori perimetro → 404 (non rivelare l'esistenza).
- Ogni endpoint dichiara ruolo e ambito; la CI fallisce su endpoint senza dichiarazione.

### 2.4 Isolamento tenant
Difesa in profondità, in quest'ordine: risoluzione da host → contesto tenant nella transazione → RLS Postgres → test automatici cross-tenant su ogni endpoint. Il ruolo applicativo non è owner e non ha `BYPASSRLS`.

### 2.5 Superficie pubblica
- `/q/{token}`: token opaco a 22 caratteri (entropia ≥ 128 bit), nessun dato personale o patrimoniale esposto, `Cache-Control: no-store`, rate limit per IP e per asset, captcha attivabile.
- Enumerazione impossibile: nessun id incrementale in alcun URL pubblico.
- Token ruotabile: dopo la rotazione il vecchio risponde 410 per 90 giorni con istruzioni, poi 404.
- Segnalazioni marcate `spam` non notificano e non compaiono nei conteggi.

### 2.6 Allegati
- Tipi consentiti: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`. Verifica del contenuto (magic bytes), non della sola estensione.
- Max 5 MB; EXIF rimosso lato server (inclusi i dati GPS del telefono del docente).
- Nomi file generati dal server; nessun percorso fornito dal client.
- Serviti da URL firmati a scadenza breve, mai da bucket pubblico.
- `Content-Disposition: attachment` e `Content-Security-Policy: sandbox` sulle risposte di download.

### 2.7 Header e trasporto
TLS 1.2+, HSTS, CSP restrittiva senza `unsafe-inline` (nonce per gli script Next.js), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` che nega geolocalizzazione e microfono e consente la camera solo nell'area tecnico.

### 2.8 Log e audit
- Log applicativi strutturati JSON, **senza dati personali** (id sì, nomi no), senza PIN né token.
- `audit_log` immutabile alimentato da trigger su asset, interventi, segnalazioni, affidamenti, utenti, istituti.
- Accessi (riusciti e falliti) registrati con `ip_hash`, conservati 12 mesi.
- Sentry con `beforeSend` che rimuove corpo delle richieste e header sensibili; regione UE.

### 2.8bis Error tracking senza servizi esterni
GlitchTip in container espone un'API compatibile con l'SDK Sentry: si usa `@sentry/node` e `@sentry/nextjs` puntando il DSN all'istanza locale. Stesse regole di igiene di sempre: `beforeSend` che rimuove corpo delle richieste e header sensibili. Se un giorno si passa a Sentry gestito, cambia solo il DSN e va verificata la regione UE.

### 2.9 Dipendenze e rilasci
- `pnpm audit` e Dependabot in CI; vulnerabilità alta blocca il merge.
- Immagini Docker con base aggiornata almeno mensilmente; scansione con Trivy.
- Nessun segreto nel repository; rotazione delle chiavi documentata.

### 2.10 Continuità
- Backup giornaliero + WAL continuo, RPO 24 h, RTO 8 h, retention 30 giorni (7 in locale).
- **Le procedure di backup e ripristino si scrivono e si provano fin dalla fase locale**, non al momento del primo cliente: `pnpm backup:verifica` ripristina su un database temporaneo e conta le righe. Un backup mai ripristinato non è un backup.
- Test di ripristino trimestrale con esito annotato in `docs/prove/` (serve anche come prova in sede contrattuale).
- Piano di violazione dei dati: rilevazione, valutazione, notifica al titolare **entro 24 ore** (il titolare ha 72 ore verso il Garante), registro degli incidenti.

## 3. Checklist prima di ogni rilascio
- [ ] Nessun nuovo endpoint senza dichiarazione di ruolo e ambito
- [ ] Test cross-tenant verdi su tutti gli endpoint
- [ ] Nessun dato personale in log o messaggi d'errore
- [ ] Nessuna nuova metrica per singola persona
- [ ] Payload pubblici invariati o ridotti, mai arricchiti
- [ ] Migrazione retro-compatibile con la versione precedente
- [ ] Contrasto e navigazione da tastiera verificati sulle nuove schermate
