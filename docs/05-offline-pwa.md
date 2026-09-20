# 05 — PWA, offline e sincronizzazione

Vincolo reale: i laboratori hanno spesso Wi-Fi assente, e i seminterrati e le officine non hanno nemmeno copertura mobile. L'AT deve poter lavorare senza rete e ritrovare tutto sincronizzato. Il problema è reso semplice per progettazione: **gli interventi sono append-only**, quindi la sincronizzazione è una coda, non una fusione di stati.

## Perimetro
| Area | Offline |
|---|---|
| `/tecnico/*` | Sì: consultazione e scrittura |
| `/admin/*` | No: richiede rete |
| `/docente/*` | No, ma la pagina pubblica è cacheabile per la guida rapida |
| `/q/{token}` | Guida rapida disponibile offline se già visitata; l'invio richiede rete |

## Cache locale (IndexedDB, Dexie)
Store:
- `asset` — asset degli ambienti affidati nell'anno corrente (campi di scheda, non allegati)
- `ambienti`, `tipi_asset`, `software`, `tipi_consumabile`, `template_risposta`, `guide_rapide`
- `interventi_recenti` — ultimi 90 giorni per gli asset in cache
- `segnalazioni_aperte`
- `task_attivi`
- `outbox` — mutazioni in attesa
- `meta` — versioni, ultimo sync, id tenant

Regole:
- La cache è **per tenant e per utente**: la chiave del database è `gestilab:{tenantId}:{utenteId}`. Al logout viene cancellata.
- Aggiornamento incrementale: `GET /sync/delta?da={timestamp}` restituisce entità modificate ed eliminate.
- Limite prudenziale 50 MB; se superato si riduce la finestra storica a 30 giorni.

## Outbox
Ogni mutazione offline è un record:
```ts
type Mutazione = {
  id: string            // UUIDv7 generato dal client, chiave di idempotenza
  tipo: 'intervento.crea' | 'intervento.bulk' | 'segnalazione.stato'
      | 'segnalazione.messaggio' | 'asset.crea' | 'asset.aggiorna'
      | 'movimento.crea' | 'task.aggiorna' | 'consumo.crea'
      | 'ricognizione.rileva'
  payload: unknown      // validato con lo schema Zod condiviso PRIMA di accodare
  creataIl: string
  tentativi: number
  statoInvio: 'in_attesa' | 'in_corso' | 'fallita' | 'conflitto'
  errore?: { codice: string; messaggio: string }
}
```

Regole:
1. La validazione Zod avviene al momento dell'accodamento: una mutazione non valida non entra mai in coda, l'errore è mostrato subito.
2. Invio in ordine FIFO, a lotti di 20, tramite `POST /sync`. Il server elabora ogni mutazione in una transazione propria e risponde per ciascuna con `ok`, `gia_applicata`, `conflitto` o `errore`.
3. Idempotenza sull'`id`: un reinvio non duplica.
4. Ritentativi con backoff esponenziale (5 s, 15 s, 60 s, 5 min, max 6 tentativi), poi la mutazione passa in `fallita` e viene mostrata all'utente con l'azione "riprova" o "scarta".
5. Le foto sono salvate in IndexedDB come Blob, compresse lato client (lato lungo max 1600 px, qualità 0.7, ~300 KB), inviate dopo la mutazione che le referenzia.

## Conflitti
| Caso | Politica |
|---|---|
| Intervento creato offline | Nessun conflitto possibile: append-only |
| Asset modificato offline e anche online | Last-write-wins, ma il server restituisce `conflitto` con la versione corrente; l'app mostra un avviso non bloccante con "mantieni la mia / tieni quella del server" |
| Segnalazione già chiusa da un altro AT | La transizione risponde 409; l'app mostra lo stato reale e scarta la mutazione dopo conferma |
| Asset cancellato nel frattempo | La mutazione fallisce con 404; l'intervento viene conservato in locale come "non sincronizzabile" ed esportabile, mai perso in silenzio |
| Consumo su scorta insufficiente | 422; il server applica comunque se la mutazione porta `forza: true`, scelta dall'utente al rientro in rete |

Principio: **nulla scompare senza che l'utente lo sappia.** Una mutazione scartata richiede un'azione esplicita.

## Interfaccia
- Indicatore di stato sempre visibile in alto: "Tutto sincronizzato" / "3 in attesa" / "1 non riuscita".
- Tocco sull'indicatore → elenco delle mutazioni in coda con dettaglio e azioni.
- Il salvataggio offline mostra la stessa conferma di quello online: l'utente non deve pensare alla rete.
- Al rientro in rete la sincronizzazione parte da sola (`online` event + Background Sync dove disponibile).
- Avviso al logout se la coda non è vuota, con blocco finché non è svuotata o esportata.

## Service worker
- Generato con Workbox o scritto a mano, comunque minimale.
- Strategie: app shell e asset statici `StaleWhileRevalidate`; chiamate API mai cacheate come risposta (la cache dei dati è IndexedDB, non il service worker); navigazioni offline servite dall'app shell.
- La pagina pubblica `/q/{token}` è `NetworkFirst` con fallback alla copia precedente, in modo che la guida rapida resti leggibile.
- Aggiornamento versione: prompt non invasivo "Nuova versione disponibile — aggiorna", mai ricarica forzata con la coda piena.

## Push
- Web Push VAPID per le notifiche di nuova segnalazione all'AT affidatario. Le chiavi VAPID si generano con `web-push generate-vapid-keys`: **non hanno alcun costo**, né in locale né in produzione, e non richiedono servizi di terze parti.
- Service worker e push richiedono un contesto sicuro: si provano nel profilo `local-prod` (`https://dellaquila.gestilab.test`), non in `pnpm dev` su HTTP.
- iOS richiede che la PWA sia aggiunta alla schermata Home: se il permesso non è ottenibile, fallback su email. Va spiegato nell'onboarding, non scoperto in produzione.

## Scansione QR
- `BarcodeDetector` dove disponibile (Chromium su Android), fallback su `zxing-js/browser`.
- Richiesta permesso camera con spiegazione preventiva; alternativa sempre presente: inserimento manuale del codice breve a 6 caratteri.
- La risoluzione del token avviene prima in cache locale, poi in rete.
- Esito annunciato via `aria-live` e con feedback aptico dove supportato.

## Test
- Test di integrazione della coda con rete simulata assente (Playwright `context.setOffline(true)`).
- Test di idempotenza: stesso lotto inviato due volte → nessun duplicato.
- Test di conflitto su asset modificato da due sessioni.
- Test di capienza: 500 mutazioni in coda con 100 foto, verifica di memoria e tempi.
- Prova manuale obbligatoria su telefono reale in `local-prod`: installazione PWA, scansione QR, lavoro offline in un ambiente senza rete, sincronizzazione al rientro.
