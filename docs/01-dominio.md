# 01 — Modello di dominio

Riferimento autoritativo per schema, migrazioni e regole di dominio. In conflitto con il codice, vince questo documento.

## Convenzioni
- Tabelle e colonne in **italiano**, `snake_case`, plurale per le tabelle (`asset`, `interventi`).
- PK `id uuid` (UUIDv7 generato dal client dove serve offline).
- Ogni tabella tenant-scoped: `istituto_id uuid not null references istituti(id)`, indice su `(istituto_id, ...)` in testa a ogni indice composito.
- `created_at`, `updated_at` timestamptz not null default now(); `created_by uuid references utenti(id)` dove pertinente.
- Enum come tipo Postgres nativo quando i valori sono stabili, altrimenti `text` + check.
- Denaro in `numeric(12,2)`. Date senza ora in `date`.
- Soft delete **solo** su `persone` e `asset` (`eliminato_il`); tutto il resto è storico immutabile.

## Glossario rapido
- **AT** = assistente tecnico. **DSGA** = direttore amministrativo, consegnatario dei beni.
- **Ambiente** = qualunque spazio fisico (laboratorio, aula, ufficio, deposito).
- **Affidamento** = assegnazione di un ambiente a un AT per un anno scolastico.
- **Ricognizione** = verifica fisica periodica dei beni inventariati.

---

## Gruppo A — Organizzazione

### istituti (tenant)
| Colonna | Tipo | Note |
|---|---|---|
| id | uuid PK | |
| slug | text unique | `[a-z0-9-]{3,40}`, immutabile dopo attivazione. Riservati: www, app, console, api, static, admin, status, docs, mail |
| dominio_personalizzato | text? unique | V2 |
| codice_meccanografico | text unique | |
| denominazione, tipologia, indirizzo | text | tipologia: liceo \| tecnico \| professionale \| IISS |
| piano_abbonamento, limite_asset | text, int | |
| stato | enum | attivo \| sospeso \| cessato |
| data_scadenza_contratto | date | |
| modalita_accesso_docente | enum | solo_qr \| pin_istituto \| pin_personale \| sso |
| pin_istituto_hash, pin_istituto_scadenza | text?, date? | Argon2id |
| pagina_pubblica_attiva, captcha_attivo | bool | default true, false |
| retention_anni | int | default 10 |
| logo_key, colore_primario | text? | |

### anni_scolastici
`codice` (`2026/27`), `data_inizio`, `data_fine`, `corrente bool`. Un solo `corrente = true` per istituto (indice parziale unico).

### plessi
`nome`, `indirizzo`, `codice_meccanografico_plesso?`

### ambienti
`plesso_id`, `tipo` (laboratorio | aula | ufficio | deposito | palestra | altro), `nome`, `codice_breve`, `piano?`, `area_at?` (AR01…AR38), `qr_token` unique, `attivo`.

### utenti
`email` (unique per istituto), `nome`, `cognome`, `ruolo` (admin | at | supervisore), `password_hash?` (Argon2id), `attivo`, `totp_secret_cifrato?`, `provider_sso?`, `sso_subject?`, `ultimo_accesso`.
Regola: 2FA obbligatoria per `admin`.

### affidamenti_ambienti
`utente_id`, `ambiente_id`, `anno_scolastico_id`, `data_inizio`, `data_fine?`, `note`. Mai cancellati. Più AT per ambiente ammessi.

### persone (elenco segnalanti)
`nome`, `cognome`, `qualifica` (docente | collaboratore | amministrativo | altro), `anno_scolastico_id`, `attivo`, `pin_personale_hash?`, `email?`, `eliminato_il?`.
Nessun altro dato personale. Indice trigram su `nome || ' ' || cognome` per l'autocomplete.

### sessioni_docente
`persona_id`, `token_hash`, `device_label?`, `creata`, `scadenza`, `revocata_il?`. Revocabili in blocco dall'Admin.

---

## Gruppo B — Beni

### tipi_asset
`istituto_id?` (null = catalogo globale di sistema), `nome`, `categoria` (informatica | audiovideo | stampa | rete | scientifico | officina | arredo | altro), `schema_attributi jsonb` (JSON Schema), `guida_rapida_default_id?`, `etichettabile bool`.

### asset
| Colonna | Note |
|---|---|
| ambiente_id, tipo_asset_id | |
| parent_asset_id? | asset composito (postazione → PC + monitor); profondità massima 1 |
| etichetta | nome breve leggibile, es. `PC-LAB1-07`, unique per istituto |
| marca?, modello?, seriale?, numero_inventario?, categoria_inventariale? | I \| III \| non_inventariato |
| proprieta | istituto \| ente_locale \| comodato \| noleggio \| altro |
| fornitore_id?, contratto_id? | |
| data_acquisto?, data_fine_garanzia?, valore_acquisto? | |
| stato | attivo \| guasto \| in_riparazione \| in_prestito \| in_magazzino \| dismesso |
| codice_breve | 6 caratteri alfanumerici senza ambiguità (no O/0, I/1), unique per istituto, stampato sotto il QR |
| qr_token | 22 char base64url, unique globale, ruotabile |
| attributi jsonb | validato contro `tipi_asset.schema_attributi` |
| pagina_pubblica_attiva bool | default true |
| data_dismissione?, riferimento_verbale_scarico? | |
| eliminato_il? | |

Regole:
- Cambiare `ambiente_id` senza creare un `movimenti_asset` è vietato: la mutazione passa sempre dal movimento.
- `stato = dismesso` esclude l'asset da ricognizioni e report attivi ma lo conserva nello storico.
- Rotazione `qr_token`: il vecchio token risponde 410 con istruzioni per 90 giorni, poi 404.

### movimenti_asset
`asset_id`, `tipo` (trasferimento | prestito | rientro | riparazione_esterna | rientro_riparazione | dismissione), `da_ambiente_id?`, `a_ambiente_id?`, `affidatario_testo?`, `data`, `data_prevista_rientro?`, `utente_id`, `note`. Append-only; aggiorna `asset.ambiente_id` e `asset.stato` nella stessa transazione.

### fornitori / contratti
`fornitori`: nome, telefono?, email?, portale_assistenza?, note.
`contratti`: fornitore_id, tipo (assistenza | noleggio | garanzia_estesa), riferimento, data_inizio, data_fine, condizioni, come_richiedere_intervento.

---

## Gruppo C — Software e consumabili

### software
`nome`, `produttore?`, `tipo_licenza` (gratuito | volume | per_postazione | abbonamento), `numero_licenze?`, `scadenza_licenza?`, `versione_riferimento?`, `note`.

### installazioni_software
`asset_id`, `software_id`, `versione?`, `stato` (installato | rimosso), `data`, `utente_id`.
Vincolo: indice unico parziale su `(asset_id, software_id) where stato = 'installato'`.

### tipi_consumabile / scorte_consumabile / consumi_consumabile
- `tipi_consumabile`: nome, codice_produttore?, unita, compatibile_con jsonb.
- `scorte_consumabile`: tipo_consumabile_id, plesso_id, quantita, soglia_minima. Unique `(tipo_consumabile_id, plesso_id)`.
- `consumi_consumabile`: intervento_id, tipo_consumabile_id, quantita. Decrementa la scorta nella stessa transazione; la scorta può andare sotto zero solo con conferma esplicita (indica un disallineamento da segnalare, non un errore da bloccare).

---

## Gruppo D — Attività

### interventi (APPEND-ONLY)
`asset_id?` XOR `ambiente_id?` (check: esattamente uno valorizzato), `tipo` (manutenzione_ordinaria | riparazione | installazione_software | sostituzione_consumabile | configurazione | verifica | pulizia | altro), `data_ora`, `descrizione`, `esito` (risolto | parziale | non_risolto | rinviato_a_fornitore), `durata_minuti?`, `segnalazione_id?`, `task_id?`, `corregge_intervento_id?`, `gruppo_bulk_id?`, `utente_id`.

Regole:
- Nessun UPDATE/DELETE applicativo; permessi revocati a livello DB per il ruolo `app_user`.
- Finestra di 24 h: l'autore può "correggere" creando un intervento con `corregge_intervento_id`; l'originale resta e viene mostrato barrato.
- `durata_minuti` è sempre facoltativo, mai preimpostato, mai aggregato per persona.
- Bulk: N interventi con lo stesso `gruppo_bulk_id`, creati in una transazione.

### segnalazioni
`asset_id?` XOR `ambiente_id?`, `origine` (qr_pubblico | docente_autenticato | manuale_at | manuale_admin), `segnalante_persona_id?`, `segnalante_nome_libero?`, `segnalante_fuori_elenco bool`, `categoria`, `descrizione`, `priorita` (bassa | normale | alta | bloccante, impostata solo dall'AT), `stato` (aperta | presa_in_carico | in_attesa | risolta | chiusa | annullata | spam), `assegnato_a_utente_id?`, `fuori_competenza bool`, `inoltrata_a text?`, `guida_rapida_mostrata bool`, `guida_rapida_passi_completati int`, `token_tracking`, `ip_hash?` (cancellato dopo 7 giorni), timestamp `creata/presa_in_carico/risolta/chiusa`.

Transizioni consentite:
```
aperta -> presa_in_carico | annullata | spam
presa_in_carico -> in_attesa | risolta | annullata
in_attesa -> presa_in_carico | risolta
risolta -> chiusa | presa_in_carico   (riapertura entro 14 giorni)
chiusa -> (terminale)
```
Chiudere con esito propone la creazione dell'intervento collegato (conferma dell'AT richiesta).

### messaggi_segnalazione
`segnalazione_id`, `autore` (at | sistema), `testo`, `template_id?`, `visibile_al_segnalante bool`, `data`.

### template_risposta
`titolo`, `testo` con placeholder `{nome}`, `{asset}`, `{ambiente}`, `categoria?`.

### guide_rapide
`tipo_asset_id?` XOR `asset_id?`, `titolo`, `passi jsonb[]` `{ordine, titolo, testo, immagine_key?}`.

### task / checklist_template
`task`: titolo, descrizione, creato_da, assegnato_a_utente_id, ambito (`asset_id` | `ambiente_id` | libero), `ricorrenza?` (RRULE), `scadenza?`, `priorita`, `stato` (da_fare | in_corso | completato | annullato), `checklist jsonb[]`, `completato_il?`, `note_chiusura?`.
`checklist_template`: nome, ambito_tipo, voci jsonb[].

### richieste_materiale
`richiesta_da`, `stato` (bozza | inviata | approvata | rifiutata | evasa), `voci jsonb[]` `{descrizione, quantita, tipo_consumabile_id?, motivazione}`, `note_admin?`, date di stato.

---

## Gruppo E — Ricognizione e consegne

### ricognizioni / ricognizioni_voci
`ricognizioni`: anno_scolastico_id, ambito (istituto | plesso | ambienti[]), avviata_da, data_inizio, data_fine?, stato.
`ricognizioni_voci`: ricognizione_id, asset_id, esito (presente | mancante | danneggiato | non_verificato), rilevato_da, data, note.
Regola: con una ricognizione aperta, ogni scansione QR di un asset in ambito lo marca `presente` (una volta sola).

### passaggi_consegne
`utente_uscente_id`, `utente_entrante_id?`, `ambienti[]`, `data`, `snapshot jsonb` (immutabile), `pdf_key`.

---

## Gruppo F — Trasversali

### allegati
`entita`, `entita_id`, `storage_key`, `mime`, `dimensione`, `sha256`, `caricato_da`, `data`. EXIF rimosso lato server. Max 5 MB; 3 per segnalazione, 10 per intervento.

### audit_log (APPEND-ONLY)
`utente_id?`, `persona_id?`, `entita`, `entita_id`, `azione`, `diff jsonb`, `data`, `ip_hash?`.
Alimentato da trigger Postgres su: asset, interventi, segnalazioni, affidamenti, utenti, istituti.

### notifiche
`utente_id`, `tipo`, `riferimento`, `canale` (push | email | in_app), `inviata_il?`, `letta_il?`.

---

## Regole di dominio da testare
1. Un asset non cambia ambiente senza movimento corrispondente.
2. Un intervento non può essere modificato dopo 24 h, né mai cancellato.
3. Una segnalazione su asset con pagina pubblica disattivata non può nascere da `qr_pubblico`.
4. Una scorta non scende senza un `consumi_consumabile` collegato a un intervento.
5. Un AT vede e modifica solo asset in ambienti a lui affidati **nell'anno corrente**.
6. Nessuna query restituisce righe di un altro `istituto_id`, nemmeno con id indovinato (404, non 403).
7. Cambiare l'anno scolastico corrente non altera lo storico né gli affidamenti passati.
8. Il PIN docente rigenerato invalida tutte le `sessioni_docente` attive.
