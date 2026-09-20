# GestiLab — Specifiche di progetto
## Piattaforma per gli Assistenti Tecnici delle scuole secondarie di II grado

Versione 1.2 — 19 settembre 2026
Stato: bozza per validazione con utente pilota
Novità v1.1: multi-tenancy per sottodominio, aree di login separate per ruolo, containerizzazione Docker, accesso docente con PIN.
Novità v1.2: **strategia locale a costo zero**. Il sistema viene sviluppato ed eseguito interamente in locale, con qualità da produzione; il passaggio a un server pubblico è un cambio di configurazione, non di architettura. Nessuna spesa prima della validazione con l'utente pilota.

---

## 1. Visione e obiettivi

### 1.1 Problema
L'assistente tecnico (AT) conduce i laboratori e ne garantisce efficienza e funzionalità (Allegato A, CCNL Istruzione e Ricerca 2019-21) ed è affidatario dei beni dei laboratori per conto del DSGA, consegnatario ai sensi dell'art. 30 del D.I. 129/2018. Alla scadenza dell'incarico deve riconsegnare gli elenchi con una relazione sullo stato del patrimonio affidato. Oggi lavora a memoria, su fogli di carta, su moduli di segnalazione guasti sulla cattedra e sul registro interno del laboratorio. Non esiste uno strumento verticale per questo profilo.

### 1.2 Obiettivi del prodotto
1. Dare all'AT una memoria verificabile del proprio lavoro: cosa ha fatto, su quale bene, quando, con quali materiali.
2. Ridurre gli interventi superflui filtrando le richieste dei docenti con una guida di auto-diagnosi prima della segnalazione.
3. Produrre per il DSGA i documenti che la norma richiede (relazione stato beni, supporto alla ricognizione, passaggio consegne) senza lavoro aggiuntivo.
4. Sopravvivere al cambio dell'AT: la conoscenza resta all'istituto.

### 1.3 Non obiettivi (v1)
- Sostituire il registro inventario ufficiale della scuola (SIDI, gestionali Argo/Axios): l'app lo affianca e importa/esporta.
- Gestione acquisti e contabilità.
- Prenotazione laboratori e orari.
- Gestione studenti o dati degli studenti in qualsiasi forma.
- Adempimenti D.Lgs 81/2008 (sicurezza): copribili in parte con task ricorrenti, ma fuori scope come modulo.

### 1.4 Metriche di successo del pilota (8 settimane, 1 istituto)
- ≥ 80% degli asset dei laboratori affidati censiti con QR entro la settimana 2.
- ≥ 70% degli interventi dell'AT registrati nell'app (autodichiarato, confronto con settimana campione).
- ≥ 30% delle segnalazioni docente chiuse in auto-diagnosi senza intervento dell'AT.
- Relazione stato beni generata dall'app e accettata dal DSGA.

---

## 2. Contesto normativo e vincoli esterni

| Ambito | Fonte | Impatto sul prodotto |
|---|---|---|
| Mansioni AT | Allegato A CCNL 2019-21 | Conduzione laboratori, manutenzione ordinaria: il log interventi è la funzione centrale |
| Consegnatario e affidatari | D.I. 129/2018 art. 30-34 | Elenchi beni per affidatario, relazione stato beni, ricognizione ≥ ogni 5 anni, scarico beni con commissione |
| Acquisto da parte della scuola | D.Lgs 36/2023; L. 296/2006 c. 450 | Affidamento diretto sotto 5.000 € con CIG su piattaforma certificata; scuole escluse dall'obbligo MEPA ma iscrizione consigliata |
| Servizi cloud per la PA | Regolamento ACN 27/06/2024 | Qualificazione SaaS richiede ISO 27001+27017+27018 o CSA STAR L2: non raggiungibile in fase iniziale. Architettura predisposta al self-hosting come alternativa |
| Protezione dati | GDPR, D.Lgs 196/2003 | Scuola = titolare, fornitore = responsabile (art. 28). Dati personali minimi: nomi del personale. Nessun dato studenti |
| Controllo a distanza | L. 300/1970 art. 4 | Nessun tracciamento automatico dell'AT; dati di tempo facoltativi; report aggregati; informativa ai lavoratori |
| Accessibilità | L. 4/2004, Linee guida AgID, WCAG 2.1 AA | Interfacce accessibili; dichiarazione di accessibilità del fornitore |
| Fatturazione PA | D.M. 55/2013 | Fattura elettronica via SDI con Codice Univoco Ufficio, CIG, riferimento determina |

---

## 3. Attori e ruoli

### 3.1 Attori
| Attore | Descrizione | Accesso |
|---|---|---|
| **Admin istituto** | DSGA o persona delegata. Configura l'istituto, importa dati, assegna ambienti agli AT, crea task, legge report | Login, 2FA obbligatoria |
| **Assistente tecnico (AT)** | Utente primario. Gestisce asset degli ambienti affidati, registra interventi, gestisce segnalazioni e task | Login |
| **Supervisore** | DS, responsabile di laboratorio, ufficio tecnico. Sola lettura su ambienti assegnati | Login |
| **Segnalante** | Docente, collaboratore scolastico, personale di segreteria. Apre segnalazioni dal QR | Due modalità: anonima dal QR (nome scelto da elenco) oppure sessione docente con nome + PIN |
| **Fornitore esterno** | Non è un utente. Referenziato negli asset e nei contratti | — |

### 3.2 Matrice permessi (v1)

| Funzione | Admin | AT (ambienti propri) | AT (altri ambienti) | Supervisore |
|---|---|---|---|---|
| Configurazione istituto, plessi, utenti | ✔ | — | — | — |
| Elenco personale segnalante | ✔ | lettura | lettura | — |
| Affidamento ambienti ad AT | ✔ | — | — | — |
| Asset: creare, modificare, spostare | ✔ | ✔ | lettura | lettura |
| Asset: dismettere | ✔ | proposta | — | — |
| Interventi: registrare | ✔ | ✔ | — | — |
| Interventi: correggere | propri | propri (entro 24 h, poi solo correzione come nuova voce) | — | — |
| Segnalazioni: gestire | ✔ | ✔ | lettura | lettura |
| Task: creare/assegnare | ✔ | a se stesso | — | — |
| Task: eseguire | ✔ | assegnati | — | — |
| Richieste materiale: creare | — | ✔ | — | — |
| Richieste materiale: approvare | ✔ | — | — | — |
| Ricognizione: avviare | ✔ | — | — | — |
| Ricognizione: rilevare | ✔ | ✔ | — | — |
| Report ed export | ✔ | propri ambienti | — | ambienti assegnati |
| Audit log | ✔ | — | — | — |

Un AT può avere più ambienti; un ambiente può avere più AT (compresenze, aree diverse). L'affidamento è per anno scolastico.

---

## 3.3 Multi-tenancy e indirizzi

Ogni istituto è un tenant identificato da uno **slug** e raggiunto da un proprio sottodominio.

### Domini in produzione (configurazione futura, non ancora attiva)
| Dominio | Uso |
|---|---|
| `gestilab.it` | Sito vetrina. Nessun dato di tenant |
| `dellaquila.gestilab.it` | Istanza dell'istituto (tenant) |
| `app.gestilab.it` | "Trova il tuo istituto" → redirect al sottodominio |
| `console.gestilab.it` | Back-office del fornitore. Utenti interni |

### Domini in locale (configurazione attiva oggi)
Il dominio `gestilab.test` è riservato dalla RFC 2606 e non è registrabile: nessun costo, nessun conflitto con Internet, nessun rischio di far uscire dati per errore.

| Dominio locale | Corrisponde a |
|---|---|
| `dellaquila.gestilab.test` | tenant pilota |
| `demo.gestilab.test` | secondo tenant, per verificare l'isolamento |
| `console.gestilab.test` | back-office fornitore |

Risoluzione via `dnsmasq` o `/etc/hosts`; TLS vero con una CA locale (mkcert), non HTTP. **HTTPS anche in locale è un requisito, non una comodità**: Service Worker, Web Push, camera e cookie `Secure` si comportano diversamente su HTTP, e i relativi difetti emergerebbero solo dopo il passaggio in produzione.

La differenza fra locale e produzione è contenuta in tre variabili d'ambiente: dominio di base, emittente del certificato, endpoint dei servizi esterni. Nessun ramo di codice, nessun `if (isProduction)` nella logica applicativa.

Regole valide in entrambi i casi:
- Lo slug è scelto alla creazione del tenant, immutabile dopo l'attivazione.
- Slug riservati: `www`, `app`, `console`, `api`, `static`, `admin`, `status`, `docs`, `mail`.
- Il tenant è risolto **dall'host**, mai da query o body; host sconosciuto → 404.
- Tenant sospeso: sola lettura ed export per 90 giorni, poi blocco.
- Dominio personalizzato dell'istituto via CNAME: V2.

### Vincolo sulle etichette QR
Il QR contiene un URL assoluto: cambiare dominio invalida tutte le etichette già applicate. Conseguenza operativa:
- Durante lo sviluppo e le prove con l'AT pilota si stampano **etichette provvisorie su carta comune**, con dominio locale.
- Le **etichette definitive** (poliestere laminato) si stampano solo dopo aver registrato il dominio pubblico.
- Il `codice_breve` a 6 caratteri resta valido in ogni caso ed è indipendente dal dominio: è la difesa contro questo problema, e va stampato in grande accanto al QR.

## 3.4 Aree di accesso e routing

Tre aree distinte, con pagine di login separate. La separazione è per chiarezza d'uso e per poter differenziare requisiti di sicurezza, non è una barriera: la sessione è unica e il ruolo è verificato lato server su ogni richiesta.

| Percorso | Area | Destinatari |
|---|---|---|
| `/` | Redirect all'area corretta se già autenticato, altrimenti scelta area | Tutti |
| `/q/{token}` | **Pagina pubblica QR**: stato bene, guida rapida, form segnalazione. Nessun login richiesto | Chiunque scansioni |
| `/docente/login` | Accesso docente: nome da elenco + PIN | Personale segnalante |
| `/docente/...` | Le mie segnalazioni, nuova segnalazione, stato | Personale segnalante |
| `/tecnico/login` | Accesso AT: email + password o SSO, 2FA opzionale | AT |
| `/tecnico/...` | Oggi, scansione, asset, interventi, segnalazioni, task, ricognizione | AT |
| `/admin/login` | Accesso amministrazione: email + password o SSO, 2FA obbligatoria | Admin istituto, Supervisore |
| `/admin/...` | Configurazione, personale, affidamenti, report, richieste materiale | Admin, Supervisore |

Regole di routing e sessione:
- Chi accede a un'area senza il ruolo necessario riceve 403 con link all'area di competenza, **non** un redirect al login (evita loop e confusione).
- Cookie di sessione limitato al sottodominio del tenant (`Domain=dellaquila.gestilab.it`, `HttpOnly`, `Secure`, `SameSite=Lax`): una sessione non è spendibile su un altro tenant.
- Nome del cookie distinto per area (`gl_s_doc`, `gl_s_tec`, `gl_s_adm`): sullo stesso dispositivo possono coesistere una sessione docente e una tecnico senza sovrascriversi (caso reale: l'AT che presta il telefono).
- Durata sessione: docente 12 h, AT 30 giorni con refresh, Admin 8 h. Revoca immediata da parte dell'Admin.
- Il ruolo Supervisore entra da `/admin/login` e vede l'area admin in sola lettura.

### 3.5 Accesso docente senza email (RF-D15)
Requisito vincolante: il docente non deve creare un account né ricevere email.
1. L'Admin genera un **PIN d'istituto** (6 cifre, rigenerabile, con data di scadenza suggerita a fine anno scolastico) e lo comunica in sala docenti o in circolare.
2. In `/docente/login` il docente cerca il proprio nome nell'elenco (ricerca incrementale) e digita il PIN.
3. Opzionale, attivabile dall'Admin: **PIN personale** per docente, generato e stampabile in elenco, per attribuzione più affidabile.
4. Il dispositivo ricorda la persona scelta; il PIN è richiesto di nuovo alla scadenza della sessione.
5. Protezione: rate limit per IP e per persona, blocco temporaneo dopo 5 tentativi errati, rigenerazione PIN d'istituto in un clic se diffuso all'esterno.
6. La sessione docente non è una prova di identità: serve a ridurre l'attrito e gli errori, non a fondare responsabilità disciplinari. Va scritto nell'informativa.
7. SSO Google/Microsoft in V1 come alternativa al PIN per gli istituti che lo vogliono.

## 4. Modello di dominio

Convenzioni: tutte le entità hanno `id` (UUID), `istituto_id` (tenant), `created_at`, `updated_at`; le entità con storico hanno `created_by`. Campi facoltativi marcati `?`.

### 4.1 Struttura organizzativa
**Istituto** (tenant)
- **slug** (unico a livello piattaforma, immutabile dopo attivazione, 3-40 caratteri `[a-z0-9-]`), dominio_personalizzato?
- codice_meccanografico (unico), denominazione, tipologia (liceo | tecnico | professionale | IISS), indirizzo
- piano_abbonamento, limite_asset, stato (attivo | sospeso | cessato), data_scadenza_contratto
- impostazioni: SLA target per priorità?, pagina_pubblica_attiva (default sì), richiesta_captcha_pubblica (default no), retention_anni (default 10)
- accesso docente: modalita_accesso_docente (solo_qr | pin_istituto | pin_personale | sso), pin_istituto_hash?, pin_istituto_scadenza?
- branding: logo?, colore_primario? (solo intestazioni e PDF; nessun tema completo)

**AnnoScolastico** — codice (es. 2026/27), data_inizio, data_fine, corrente (bool). Le liste personale e gli affidamenti sono legati all'anno.

**Plesso** — nome, indirizzo, codice_meccanografico_plesso?

**Ambiente** — plesso_id, tipo (laboratorio | aula | ufficio | deposito | palestra | altro), nome, codice_breve, piano?, area_AT? (AR01, AR02, ...), qr_token, attivo

**Utente** — email, nome, cognome, ruolo (admin | at | supervisore), attivo, 2fa_abilitata, ultimo_accesso, provider_sso? (google | microsoft)

**AffidamentoAmbiente** — utente_id, ambiente_id, anno_scolastico_id, data_inizio, data_fine?, note. Storico mai cancellato.

**Persona** (elenco segnalanti) — nome, cognome, qualifica (docente | collaboratore | amministrativo | altro), anno_scolastico_id, attivo, pin_personale_hash?, email? (solo se l'istituto attiva l'SSO). Importabile da CSV; nessun altro dato personale.

**SessioneDocente** — persona_id, token_hash, device_label?, creata, scadenza, revocata. Consente all'Admin di revocare tutte le sessioni dopo la rigenerazione del PIN.

### 4.2 Beni
**TipoAsset** — istituto_id? (null = catalogo globale fornito dall'app), nome, categoria (informatica | audiovideo | stampa | rete | scientifico | officina | arredo | altro), schema_attributi (JSON Schema per campi custom, es. cappa chimica: data ultima verifica flusso), guida_rapida_default_id?, etichettabile (bool: i cavi no)

**Asset**
- ambiente_id, tipo_asset_id, parent_asset_id? (asset composito: postazione → PC, monitor)
- etichetta (nome breve, es. "PC-LAB1-07"), marca?, modello?, seriale?, numero_inventario?, categoria_inventariale? (I | III | non inventariato)
- proprietà (istituto | ente_locale | comodato | noleggio | altro), fornitore_id?, contratto_id?
- data_acquisto?, data_fine_garanzia?, valore_acquisto?
- stato (attivo | guasto | in_riparazione | in_prestito | in_magazzino | dismesso)
- codice_breve (6 caratteri leggibili a occhio, stampato sotto il QR), qr_token (opaco, ruotabile)
- attributi (JSONB, validati con schema_attributi), note, pagina_pubblica_attiva (bool, default sì)
- data_dismissione?, riferimento_verbale_scarico?

**MovimentoAsset** — asset_id, tipo (trasferimento | prestito | rientro | riparazione_esterna | rientro_riparazione | dismissione), da_ambiente_id?, a_ambiente_id?, affidatario_testo? (per prestiti), data, data_prevista_rientro?, utente_id, note. Aggiorna `Asset.ambiente_id` e `Asset.stato`.

**Fornitore** — nome, telefono?, email?, portale_assistenza?, note
**Contratto** — fornitore_id, tipo (assistenza | noleggio | garanzia_estesa), riferimento, data_inizio, data_fine, condizioni (testo), come_richiedere_intervento (testo)

### 4.3 Software e consumabili
**Software** — nome, produttore?, tipo_licenza (gratuito | volume | per_postazione | abbonamento), numero_licenze?, scadenza_licenza?, versione_riferimento?, note
**InstallazioneSoftware** — asset_id, software_id, versione?, stato (installato | rimosso), data, utente_id. Vincolo: una riga attiva per coppia asset/software.

**TipoConsumabile** — nome, codice_produttore?, unità (pezzo | ml | ...), compatibile_con (lista modelli o tipi asset)
**ScortaConsumabile** — tipo_consumabile_id, plesso_id, quantità, soglia_minima
**ConsumoConsumabile** — intervento_id, tipo_consumabile_id, quantità. Decrementa la scorta.

### 4.4 Attività
**Intervento** (append-only)
- oggetto: asset_id **oppure** ambiente_id (uno dei due obbligatorio)
- tipo (manutenzione_ordinaria | riparazione | installazione_software | sostituzione_consumabile | configurazione | verifica | pulizia | altro)
- data_ora, descrizione, esito (risolto | parziale | non_risolto | rinviato_a_fornitore)
- durata_minuti? (facoltativo per progettazione: vedi vincolo art. 4)
- segnalazione_id?, task_id?, allegati[]
- correzione_di_intervento_id? (una correzione è un nuovo intervento che referenzia quello errato; l'originale resta e viene marcato "corretto")
- registrato_in_bulk_id? (gruppo di interventi creati insieme su N asset)

**Segnalazione**
- oggetto: asset_id oppure ambiente_id
- origine (qr_pubblico | manuale_at | manuale_admin)
- segnalante_persona_id?, segnalante_nome_libero? (se non in elenco), segnalante_fuori_elenco (bool)
- categoria (non_si_accende | non_funziona | rete | stampa | audio_video | software | danno_fisico | altro), descrizione, allegati[] (max 3 foto)
- priorità (bassa | normale | alta | bloccante), impostata dall'AT, default normale
- stato (aperta | presa_in_carico | in_attesa | risolta | chiusa | annullata | spam)
- assegnato_a_utente_id?, fuori_competenza (bool), inoltrata_a? (testo libero: "Provincia", "fornitore X")
- guida_rapida_mostrata (bool), guida_rapida_passi_completati (int)
- timestamp: creata, presa_in_carico, risolta, chiusa
- token_tracking (per la pagina pubblica di stato), ip_hash? (solo per rate limit, cancellato dopo 7 giorni)

**MessaggioSegnalazione** — segnalazione_id, autore (at | sistema), testo, template_id?, visibile_al_segnalante (bool), data

**TemplateRisposta** — titolo, testo con placeholder ({nome}, {asset}), categoria?

**GuidaRapida** — tipo_asset_id oppure asset_id (override), titolo, passi[] {ordine, titolo, testo, immagine?}. Mostrata al segnalante prima del form.

**Task**
- titolo, descrizione, creato_da, assegnato_a_utente_id, ambito (asset_id | ambiente_id | libero)
- ricorrenza? (RRULE), scadenza?, priorità, stato (da_fare | in_corso | completato | annullato)
- checklist[] {testo, fatto, fatto_da, fatto_il}, interventi_collegati[], completato_il, note_chiusura

**ChecklistTemplate** — nome, tipo_ambiente_o_asset, voci[]. Esempi forniti dall'app: "Manutenzione estiva laboratorio informatica", "Apertura anno scolastico aula con LIM".

**RichiestaMateriale** — richiesta_da, stato (bozza | inviata | approvata | rifiutata | evasa), voci[] {descrizione, quantità, tipo_consumabile_id?, motivazione}, note_admin, date.

### 4.5 Ricognizione e passaggio consegne
**Ricognizione** — anno_scolastico_id, ambito (istituto | plesso | ambienti[]), avviata_da, data_inizio, data_fine?, stato (in_corso | chiusa)
**RicognizioneVoce** — ricognizione_id, asset_id, esito (presente | mancante | danneggiato | non_verificato), rilevato_da, data, note. Un asset scansionato durante una ricognizione aperta viene marcato "presente" automaticamente.

**PassaggioConsegne** — documento generato: AT uscente, AT entrante?, ambienti, data, elenco asset con stato, interventi aperti, segnalazioni aperte, task aperti, scorte. Snapshot immutabile (PDF + JSON).

### 4.6 Trasversali
**Allegato** — entità, entità_id, storage_key, mime, dimensione, sha256, caricato_da, data. EXIF rimosso all'upload.
**AuditLog** — utente_id?, entità, entità_id, azione, diff (JSON), data, ip_hash. Immutabile.
**Notifica** — utente_id, tipo, riferimento, canale (push | email | in_app), inviata, letta.

---

## 5. Requisiti funzionali

Priorità: **MVP** = necessario per il pilota; **V1** = prima release commerciale; **V2** = successiva.

### RF-A Configurazione istituto
| ID | Requisito | Priorità |
|---|---|---|
| RF-A1 | L'Admin crea l'istituto con codice meccanografico, plessi e ambienti | MVP |
| RF-A2 | L'Admin invita utenti via email (magic link); assegna ruolo | MVP |
| RF-A3 | L'Admin affida ambienti agli AT per anno scolastico; alla creazione del nuovo anno propone di copiare gli affidamenti | MVP |
| RF-A4 | Import elenco personale segnalante da CSV (nome, cognome, qualifica); l'elenco è per anno scolastico | MVP |
| RF-A5 | Login SSO Google Workspace / Microsoft 365 per il dominio dell'istituto | V1 |
| RF-A6 | 2FA TOTP obbligatoria per Admin, opzionale per AT | V1 |
| RF-A7 | Configurazione SLA target per priorità (solo per report, nessun allarme punitivo) | V2 |

### RF-B Censimento asset e QR
| ID | Requisito | Priorità |
|---|---|---|
| RF-B1 | Creazione asset da mobile in ≤ 5 campi obbligatori (tipo, etichetta, ambiente; il resto opzionale) | MVP |
| RF-B2 | Import asset da Excel/CSV con template scaricabile e report degli errori riga per riga | MVP |
| RF-B3 | Generazione QR per asset e ambienti; il QR contiene solo un URL con token opaco; codice breve leggibile stampato sotto | MVP |
| RF-B4 | Stampa etichette in PDF su formati standard (A4 24, 40, 65 etichette/foglio) con selezione per ambiente | MVP |
| RF-B5 | Rigenerazione QR per asset (token ruotato) in caso di etichetta danneggiata o duplicata | MVP |
| RF-B6 | Inserimento manuale del codice breve in alternativa alla scansione | MVP |
| RF-B7 | Asset compositi (parent/child) e duplicazione rapida "crea N copie con progressivo" | MVP |
| RF-B8 | Campi custom per tipo asset tramite schema; catalogo globale di tipi comuni precaricato | V1 |
| RF-B9 | Stato asset, proprietà, fornitore, contratto, scadenza garanzia; alert 30 giorni prima della scadenza | V1 |
| RF-B10 | Movimenti asset (trasferimento, prestito, rientro, riparazione esterna, dismissione) con storico ubicazioni | V1 |
| RF-B11 | Pagina pubblica disattivabile per singolo asset | MVP |

### RF-C Scheda asset e interventi (AT)
| ID | Requisito | Priorità |
|---|---|---|
| RF-C1 | Scansione QR dalla camera del browser apre la scheda asset/ambiente | MVP |
| RF-C2 | La scheda mostra: dati, stato, ultimo intervento, segnalazioni aperte, software installato, consumabili compatibili, storico | MVP |
| RF-C3 | Azioni rapide dalla scheda: registra intervento, sostituito consumabile, installato software, apri segnalazione, sposta | MVP |
| RF-C4 | Registrazione intervento in ≤ 3 tap per i casi frequenti (tipo preselezionato, descrizione opzionale, foto opzionale) | MVP |
| RF-C5 | Interventi append-only: correzione come nuova voce collegata; modifica libera solo entro 24 h dalla creazione, per l'autore | MVP |
| RF-C6 | Intervento in bulk: selezione di N asset (per ambiente o filtro) e registrazione di un intervento identico su tutti | MVP |
| RF-C7 | Software: catalogo istituto, installazione/rimozione per asset, vista "quali PC hanno X", vista "cosa manca in lab Y rispetto al set richiesto" | MVP (catalogo, installazione), V1 (confronto set) |
| RF-C8 | Consumabili: scorta per plesso, decremento alla sostituzione, alert sotto soglia | V1 |
| RF-C9 | Ricerca globale per etichetta, seriale, numero inventario, ambiente | MVP |
| RF-C10 | Durata intervento facoltativa, mai preimpostata, mai mostrata in classifiche | MVP |

### RF-D Segnalazioni (pagina pubblica e gestione)
| ID | Requisito | Priorità |
|---|---|---|
| RF-D1 | La scansione da un dispositivo non autenticato apre la pagina pubblica dell'asset/ambiente: nome, ambiente, stato "funzionante / segnalazione aperta". Nessun seriale, inventario o dato del personale | MVP |
| RF-D2 | Se esiste una guida rapida per il tipo asset, viene mostrata prima del form; a ogni passo "risolto?" sì/no; il "sì" registra un'auto-risoluzione senza aprire segnalazione | MVP |
| RF-D3 | Form segnalazione: nome segnalante con autocomplete sull'elenco personale (ricerca incrementale su nome e cognome), fallback "non in elenco" con testo libero; categoria; descrizione; fino a 3 foto | MVP |
| RF-D4 | Il nome scelto viene ricordato sul dispositivo (localStorage) | MVP |
| RF-D5 | Alla conferma viene mostrato e reso copiabile un link di stato con token; nessuna email richiesta | MVP |
| RF-D6 | Se sull'asset esiste già una segnalazione aperta, la pagina lo mostra e propone "anche io" invece di duplicare | MVP |
| RF-D7 | Notifica all'AT affidatario dell'ambiente (push + email); se più AT, a tutti | MVP |
| RF-D8 | Gestione stato: presa in carico, in attesa, risolta, chiusa, annullata, spam; assegnazione a un altro AT | MVP |
| RF-D9 | Risposta al segnalante con template ("Ciao {nome}, prova a...") visibile sulla pagina di stato | MVP |
| RF-D10 | Flag "fuori competenza" con campo "inoltrata a" (Provincia, fornitore); la segnalazione resta tracciata | MVP |
| RF-D11 | Chiudere una segnalazione con esito crea automaticamente l'intervento collegato, se l'AT lo conferma | MVP |
| RF-D12 | Protezione anti-abuso: rate limit per IP e per asset (es. 5 segnalazioni/ora), captcha attivabile dall'Admin, cestino spam | MVP |
| RF-D13 | Segnalazione creata manualmente dall'AT (docente che passa di persona) | MVP |
| RF-D14 | Priorità impostata dall'AT, non dal segnalante | MVP |
| RF-D15 | Accesso docente con nome da elenco + PIN d'istituto (vedi §3.5); PIN personale e SSO come opzioni | MVP (PIN istituto), V1 (PIN personale, SSO) |
| RF-D16 | Area `/docente`: elenco delle proprie segnalazioni con stato, nuova segnalazione anche senza QR (scelta ambiente e bene da lista), messaggi ricevuti dall'AT | MVP |
| RF-D17 | Segnalazione aperta da sessione docente autenticata: il campo nome è precompilato e non modificabile | MVP |

### RF-T Tenancy e piattaforma
| ID | Requisito | Priorità |
|---|---|---|
| RF-T1 | Risoluzione del tenant dal sottodominio; host sconosciuto o tenant non attivo → 404 | MVP |
| RF-T2 | Console fornitore su dominio separato: creazione tenant (slug, denominazione, piano), sospensione, riattivazione, stato abbonamento | MVP |
| RF-T3 | Isolamento dati garantito a livello database (RLS) oltre che applicativo; test automatico che tenta un accesso cross-tenant su ogni endpoint | MVP |
| RF-T4 | Provisioning di un nuovo tenant in un comando, con dati di base precaricati (tipi asset, guide rapide, template risposta, checklist) | MVP |
| RF-T5 | Area `/admin` con branding minimo dell'istituto (logo e colore in intestazione e PDF) | V1 |
| RF-T6 | Dominio personalizzato dell'istituto via CNAME con TLS automatico | V2 |
| RF-T7 | Backup e export per singolo tenant, indipendenti dagli altri | V1 |

### RF-E Task e checklist
| ID | Requisito | Priorità |
|---|---|---|
| RF-E1 | L'Admin crea task con titolo, descrizione, ambito, scadenza, assegnatario | MVP |
| RF-E2 | L'AT crea task per se stesso | MVP |
| RF-E3 | Task ricorrenti (settimanale, mensile, inizio/fine anno) | V1 |
| RF-E4 | Checklist template per tipo ambiente; applicazione a un ambiente genera un task con voci | V1 |
| RF-E5 | Evidenza di completamento: interventi collegati, foto, nota; il completamento è visibile all'Admin | MVP |
| RF-E6 | Vista "oggi" per l'AT: task in scadenza, segnalazioni aperte per priorità, alert consumabili e garanzie | MVP |

### RF-F Richieste materiale
| ID | Requisito | Priorità |
|---|---|---|
| RF-F1 | L'AT compila una richiesta con voci e motivazione, anche partendo da un alert scorta | V1 |
| RF-F2 | L'Admin approva/rifiuta con nota; l'AT viene notificato; stato "evasa" al ricevimento | V1 |
| RF-F3 | Export richiesta in PDF per allegarla alla determina | V1 |

### RF-G Ricognizione, report, passaggio consegne
| ID | Requisito | Priorità |
|---|---|---|
| RF-G1 | Registro interventi filtrabile per asset, ambiente, AT, tipo, periodo; export CSV e PDF | MVP |
| RF-G2 | Relazione sullo stato dei beni per ambiente e affidatario: elenco asset con stato, ultimo intervento, interventi nel periodo, beni guasti/dismessi. PDF firmabile | MVP |
| RF-G3 | Ricognizione: sessione aperta dall'Admin; l'AT scansiona i QR e ogni asset diventa "presente"; report mancanti/danneggiati/non verificati | V1 |
| RF-G4 | Passaggio consegne: snapshot PDF+JSON per AT uscente su richiesta dell'Admin | V1 |
| RF-G5 | Cruscotto Admin: segnalazioni aperte per ambiente, asset guasti, garanzie in scadenza, scorte sotto soglia. Solo aggregati per ambiente; nessuna metrica per persona | MVP |
| RF-G6 | Export completo dati istituto (CSV/JSON) su richiesta dell'Admin | V1 |

### RF-H Offline (app AT)
| ID | Requisito | Priorità |
|---|---|---|
| RF-H1 | Consultazione schede asset degli ambienti affidati e ultimi 90 giorni di interventi disponibili offline | MVP |
| RF-H2 | Registrazione interventi, task e movimenti offline in coda locale; sincronizzazione automatica al rientro in rete con indicatore visibile | MVP |
| RF-H3 | Scansione QR offline risolve l'asset dalla cache locale | MVP |
| RF-H4 | Conflitti: interventi sono append-only (nessun conflitto); modifiche asset last-write-wins con avviso all'utente sovrascritto | MVP |
| RF-H5 | Foto in coda compresse lato client (max 1600 px, ~300 KB) | MVP |

---

## 6. Flussi principali

### 6.1 Onboarding istituto (obiettivo: mezza giornata)
1. Admin riceve invito, imposta password e 2FA, crea plessi e ambienti (o li importa da CSV).
2. Importa elenco personale per l'anno corrente.
3. Invita gli AT e affida gli ambienti.
4. AT importa asset da Excel o li censisce da mobile con "crea N copie".
5. Stampa etichette per ambiente, applica i QR.
6. Attiva la pagina pubblica; comunica ai docenti con un avviso (template fornito dall'app).

### 6.2 Docente con problema
1. Scansiona il QR sul PC (o sulla porta dell'aula).
2. Vede "PC-LAB1-07, Lab. Informatica 1 — funzionante".
3. Guida rapida per "PC non si accende": presa, ciabatta, interruttore, monitor. "Risolto?" → sì: fine, auto-risoluzione registrata. No: form.
4. Digita "Ros" → seleziona "Rossi Mario"; categoria; descrizione; foto opzionale; invia.
5. Riceve link di stato. L'AT riceve push.
6. L'AT risponde da template "prova a..." oppure prende in carico, interviene, chiude con esito → intervento creato.
7. Il docente rivede lo stato dal link o dalla scansione successiva.

### 6.3 AT in laboratorio
1. Apre l'app (PWA): vista "oggi".
2. Scansiona un asset, tocca "Sostituito consumabile" → sceglie toner → salva. Scorta decrementata.
3. A fine mattinata seleziona il laboratorio → "Intervento su tutti" → "Installazione software: LibreOffice 25.8" → 25 interventi creati.
4. Senza rete in seminterrato: tutto va in coda; sincronizza al piano terra.

### 6.4 DSGA a fine anno
1. Apre "Report → Relazione stato beni", seleziona ambienti dell'AT uscente e periodo.
2. Scarica PDF, lo allega alla riconsegna degli elenchi.
3. Avvia "Passaggio consegne" per l'AT uscente; a settembre crea il nuovo anno, copia affidamenti, aggiorna elenco personale.

---

## 7. Requisiti non funzionali

| ID | Requisito |
|---|---|
| RNF-1 | **Prestazioni pagina pubblica**: primo render < 2 s su rete 3G, < 150 KB JS; deve funzionare su telefoni di 6-7 anni |
| RNF-2 | **Compatibilità**: Safari iOS 16+, Chrome Android 100+, Chrome/Edge/Firefox desktop ultime 2 versioni |
| RNF-3 | **Disponibilità** 99,5% mensile in orario scolastico (7-18, lun-sab); finestre di manutenzione fuori orario |
| RNF-4 | **Backup**: giornaliero, RPO 24 h, RTO 8 h, conservazione 30 giorni, test di ripristino trimestrale |
| RNF-5 | **Sicurezza**: TLS 1.2+, password hash Argon2id, sessioni revocabili, 2FA TOTP, rate limiting, header CSP, dipendenze scansionate in CI, isolamento tenant a livello di query (row-level security) |
| RNF-6 | **Dati in UE**: hosting e backup in UE; preferenza per data center in Italia come argomento commerciale |
| RNF-7 | **GDPR**: DPA art. 28 standard; registro trattamenti; informativa per segnalanti nella pagina pubblica; retention configurabile; anonimizzazione nomi segnalanti a fine retention; export e cancellazione tenant entro 30 giorni dalla richiesta |
| RNF-8 | **Art. 4 L. 300/1970**: nessuna geolocalizzazione, nessun tracciamento tempi automatico, nessuna classifica per persona; report Admin aggregati per ambiente; documento informativo per i lavoratori fornito dal prodotto |
| RNF-9 | **Accessibilità**: WCAG 2.1 AA sull'intera app; pagina pubblica testata con screen reader; dichiarazione di accessibilità pubblicata |
| RNF-10 | **Audit**: ogni modifica ad asset, interventi, segnalazioni, affidamenti tracciata con utente, data, diff; log conservati per la durata del contratto |
| RNF-11 | **Portabilità**: l'intera piattaforma è eseguibile con Docker Compose su un singolo host (opzione self-hosted); nessuna dipendenza da servizi proprietari non sostituibili |
| RNF-12 | **Multi-tenant**: un deploy serve N istituti; dati logicamente isolati; nessuna query senza tenant |
| RNF-13 | **Osservabilità**: log strutturati, error tracking, metriche di sincronizzazione offline (code in attesa, fallimenti) |
| RNF-16 | **Costo zero fino alla validazione**: nessun servizio a pagamento nel percorso di sviluppo e del pilota. Ogni dipendenza esterna ha un equivalente eseguibile in container (email, storage, error tracking, certificati) |
| RNF-17 | **Parità fra ambienti**: locale e produzione differiscono solo per variabili d'ambiente. Nessuna condizione su `NODE_ENV` nella logica di dominio; le differenze ammesse riguardano solo emittente TLS, endpoint dei servizi e livello di log |
| RNF-18 | **Prontezza alla produzione dimostrata in locale**: prima di considerare l'MVP concluso devono essere eseguiti e documentati in locale un ripristino da backup, un aggiornamento con migrazione, un rollback alla versione precedente |
| RNF-14 | **Lingua**: solo italiano in v1; stringhe esternalizzate per non precludere il tedesco (Alto Adige) |
| RNF-15 | **Allegati**: max 5 MB per foto, 3 per segnalazione, 10 per intervento; EXIF rimosso; scansione mime lato server |

---

## 8. Perimetro MVP e roadmap

**MVP (pilota, 1 istituto)**: RF-A1..A4, RF-B1..B7, B11, RF-C1..C6, C7 parziale, C9, C10, RF-D1..D14, RF-E1, E2, E5, E6, RF-G1, G2, G5, RF-H1..H5.

**V1 (prima vendita)**: SSO, 2FA, movimenti, garanzie e contratti, consumabili, task ricorrenti e checklist, richieste materiale, ricognizione, passaggio consegne, export completo, dichiarazione accessibilità, DPA e documentazione contrattuale.

**V2**: SLA configurabili, campi custom avanzati, integrazioni (import da gestionali inventario), app store (wrapper), area docente autenticata via SSO, qualificazione ACN se sostenibile.

---

## 9. Rischi e questioni aperte

| # | Rischio / questione | Mitigazione o decisione attesa |
|---|---|---|
| 1 | Qualificazione ACN non ottenibile in fase iniziale | Vendita con DPA solido e hosting UE; opzione self-hosted; valutare partner qualificato quando i ricavi lo permettono |
| 2 | Opposizione RSU per controllo a distanza | Progettazione già vincolata (RNF-8); informativa fornita; coinvolgere l'AT pilota come sponsor |
| 3 | Adozione da parte dei docenti | Zero login, QR sulla porta, guida rapida che risolve davvero; avviso interno con istruzioni |
| 4 | AT che non registra | Registrazione ≤ 3 tap, bulk, offline; valore percepito con la relazione di fine anno |
| 5 | Regime forfettario superato | Pianificare passaggio a SRL prima della terza scuola |
| 6 | Prezzo | Da definire: fascia sotto 5.000 €/anno per restare in affidamento diretto; ipotesi per fasce di numero asset o plessi |
| 7 | Etichette che si staccano | Indicare materiale (poliestere, laminate); rigenerazione QR |
| 8 | Elenco personale non aggiornato | Fallback nome libero; promemoria all'Admin a settembre |

---

## 10. Stack tecnico e architettura

### 10.1 Decisioni
| Livello | Scelta | Motivazione |
|---|---|---|
| Frontend | **Next.js (App Router, TypeScript, React)** come PWA | Un solo codice per mobile e desktop; rendering server della pagina pubblica per telefoni vecchi e rete scarsa; PWA con service worker per offline e push; scansione QR dalla camera via browser |
| Backend | **Node.js + Fastify (TypeScript)**, API REST con OpenAPI, validazione Zod | Separato dal frontend per servire domani un'app nativa o integrazioni; Fastify leggero e adatto a container; OpenAPI come contratto |
| Database | **PostgreSQL 16** con Drizzle ORM | Relazioni complesse (asset compositi, movimenti, affidamenti per anno); JSONB per attributi custom; row-level security per l'isolamento tenant; migrazioni versionate |
| Offline | Cache in IndexedDB (Dexie), coda outbox di mutazioni idempotenti con id generati dal client | Nessun motore di sync esterno: gli interventi sono append-only e il problema si riduce a una coda |
| File | Object storage S3-compatibile in UE | Foto ed export; sostituibile (MinIO in self-hosted) |
| Auth | Sessioni server-side, magic link email, TOTP; OAuth Google/Microsoft in V1 | Nessun provider auth proprietario, coerente con RNF-11 |
| Notifiche | Web Push (VAPID) + email transazionale via provider UE | — |
| PDF | Generazione server-side da template HTML (Chromium headless) | Etichette, relazioni, passaggio consegne con lo stesso motore |
| Infra | **Docker Compose**, oggi sulla macchina di sviluppo, domani su un VPS in UE senza modifiche all'architettura; Traefik come reverse proxy con TLS (CA locale in sviluppo, Let's Encrypt in produzione); backup Postgres WAL su object storage | Costo zero fino alla validazione; stesso artefatto per locale, SaaS e self-hosted |
| Code | Redis + BullMQ per lavori asincroni (PDF, email, task ricorrenti, notifiche) | Evita richieste HTTP lunghe; necessario per le ricorrenze |
| Monorepo | pnpm workspaces + Turborepo: `apps/web`, `apps/api`, `packages/shared` (schemi Zod, tipi, costanti) | Tipi condivisi tra API e frontend |
| Qualità | Vitest, Playwright, ESLint/Prettier, GitHub Actions | — |
| Osservabilità | GlitchTip in container (compatibile con l'SDK Sentry) | Nessun servizio a pagamento; se un giorno si passa a Sentry basta cambiare il DSN |

### 10.2 Perché non le alternative
- **Angular**: valido, ma Next.js dà rendering server nativo per la pagina pubblica, ecosistema PWA più maturo e maggiore valore per portfolio e mercato. Angular sarebbe stata la scelta se il prodotto fosse solo un cruscotto interno.
- **AWS serverless (Lambda + DynamoDB/Aurora)**: ostacola il self-hosting (RNF-11), complica l'offline e l'RLS, costa di più da operare per un solo sviluppatore, e i cold start pesano sulla pagina pubblica. AWS eu-south-1 resta un'opzione per l'object storage o per una migrazione futura, non per l'architettura.
- **NoSQL**: le relazioni (asset ↔ ambiente ↔ affidamento ↔ anno ↔ interventi ↔ segnalazioni) sono il cuore del dominio; Postgres con JSONB copre la parte semi-strutturata.
- **Next.js full-stack senza API separata**: più veloce all'inizio, ma il contratto API serve per self-hosted, app nativa e integrazioni; il costo del monorepo è basso.

### 10.3 Architettura logica

```
                    Internet
                        |
               [ Traefik / Caddy ]  TLS wildcard *.gestilab.it
                        |
        +---------------+----------------+
        |                                |
   [ web: Next.js ]                 [ api: Fastify ]
   SSR + PWA, risolve il tenant      risolve il tenant dall'header
   dall'host nel middleware          X-Tenant-Slug, imposta il
        |                            contesto RLS per richiesta
        +---------------+----------------+
                        |
        +---------------+----------------+
        |               |                |
  [ db: Postgres ]  [ storage: MinIO/S3 ]  [ worker: BullMQ ]
   RLS per tenant     foto, PDF, export     PDF, email, ricorrenze
        |                                        |
  [ backup WAL -> object storage UE ]      [ redis ]
```

Un solo deploy serve tutti i tenant (pool singolo, RLS). Un tenant che chiede l'installazione in sede riceve lo **stesso** compose con un solo tenant dentro: nessun ramo di codice separato.

### 10.4 Containerizzazione

Servizi (`compose.yaml`): `web`, `api`, `worker`, `db`, `redis`, `storage`, `proxy`. In sviluppo si aggiungono `mailpit` (cattura email) e `adminer`.

Principi:
- Un `Dockerfile` per `web` e uno per `api`, **multi-stage** (deps → build → runner), immagine finale `node:22-alpine`, utente non root, `NODE_ENV=production`, solo dipendenze di produzione.
- Nessun segreto nelle immagini: tutto da variabili d'ambiente, `.env.example` versionato e `.env` ignorato.
- Healthcheck su ogni servizio; `depends_on: condition: service_healthy`.
- Le migrazioni girano in un container one-shot (`api migrate`) prima dell'avvio, mai all'import del modulo.
- Volumi nominati per `db` e `storage`; il codice è montato solo nel compose di sviluppo.
- Tre file: `compose.yaml` (base), `compose.dev.yaml` (bind mount, hot reload, porte esposte), `compose.prod.yaml` (proxy, restart policy, limiti risorse).
- Sviluppo locale multi-tenant: `*.localhost` risolve a 127.0.0.1 su Firefox e Chrome, quindi `dellaquila.localhost:3000` funziona senza toccare `/etc/hosts`.

### 10.5 Isolamento tenant (dettaglio tecnico)

1. Il middleware Next.js estrae lo slug dall'host, verifica che il tenant esista e sia attivo (cache 60 s), e lo propaga all'API.
2. L'API apre la transazione con `SET LOCAL app.tenant_id = '...'` e `SET LOCAL ROLE app_user`.
3. Ogni tabella tenant-scoped ha una policy RLS `USING (istituto_id = current_setting('app.tenant_id')::uuid)`.
4. L'utente applicativo del database **non** è proprietario delle tabelle e non ha `BYPASSRLS`.
5. Test obbligatorio in CI: per ogni endpoint, una richiesta con sessione del tenant A su un id del tenant B deve dare 404.

## 11. Documentazione operativa collegata
- `docs/CLAUDE.md` — istruzioni per l'assistente di codice
- `docs/01-dominio.md` — modello dati di riferimento
- `docs/02-architettura.md` — architettura, Docker, tenancy, routing
- `docs/03-api.md` — convenzioni API ed endpoint
- `docs/04-convenzioni-codice.md` — struttura repo e stile
- `docs/05-offline-pwa.md` — sincronizzazione e cache
- `docs/06-sicurezza-gdpr.md` — sicurezza, privacy, art. 4
- `docs/07-backlog-mvp.md` — backlog eseguibile
- `setup-ambiente-fedora.md` — preparazione della macchina di sviluppo

## 12. Glossario
- **AT**: assistente tecnico, personale ATA area assistenti.
- **DSGA**: direttore dei servizi generali e amministrativi, consegnatario dei beni.
- **Affidatario / sub-consegnatario**: docente o AT a cui il DSGA affida i beni di un laboratorio.
- **Ricognizione**: verifica fisica dell'esistenza dei beni inventariati.
- **Scarico**: eliminazione di un bene dall'inventario.
- **Area (AR02 ecc.)**: area di laboratorio di competenza dell'AT.
- **Ambiente**: qualunque spazio fisico (laboratorio, aula, ufficio).
