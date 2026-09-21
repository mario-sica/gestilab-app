# 00 — Ripresa sessione

Checklist da eseguire **all'inizio di ogni nuova conversazione** su questo progetto, prima di scrivere codice o proporre un piano. Non sostituisce gli altri documenti di `docs/`: è la procedura per orientarsi prima di aprirli, pensata per essere rieseguita identica ogni volta — non è un verbale di una sessione specifica.

Fonte di verità in ordine di autorità: **il codice e la CI reale** (verificabili, sempre aggiornati) > **il documento di riferimento architetturale** (decisioni con motivazione) > **questo documento** (procedura) > qualunque riassunto o memoria di una sessione precedente (può essere superato dagli eventi).

## 1. Verifica lo stato reale dei repository

Il progetto vive su tre repository (vedi `docs/02-architettura.md` § Tre repository):

| Repository | Percorso locale | Visibilità |
|---|---|---|
| `gestilab-app` | `~/Scrivania/Labs/gestilab-app` | pubblico |
| `gestilab-auth-service` | `~/Scrivania/Labs/gestilab-auth-service` (clone standalone) | **privato** |
| `gestilab-infra` | `~/Scrivania/Labs/gestilab-infra` | pubblico |

`gestilab-app/vendor/gestilab-auth-service` è un **submodule** (un secondo checkout, pinnato a un tag) — distinto dal clone standalone sopra. Non sviluppare lì dentro: sviluppare nel clone standalone, poi aggiornare il puntatore del submodule quando serve (vedi il documento di riferimento, sezione sui submodule).

Per ciascun repository con lavoro in corso:
```bash
git status --short   # deve essere pulito — se non lo è, capire perché prima di continuare
git branch --show-current   # deve essere "dev" — mai lavorare direttamente su main/master
git log -1 --oneline
```
Un albero non pulito o un branch che non è `dev` non è normale: indagare (potrebbe essere lavoro non concluso di una sessione precedente) prima di procedere, mai scartarlo senza capire cosa sia.

## 2. Verifica la CI

**`gestilab-app`** ha una pipeline reale (`.github/workflows/ci.yml`, triggerata su push/PR verso `dev`). Controllare l'ultimo run:
```bash
curl -s "https://api.github.com/repos/mario-sica/gestilab-app/actions/runs?branch=dev&per_page=1" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); r=d['workflow_runs'][0]; print(r['status'], r.get('conclusion'), r['html_url'])"
```
Se l'ultimo run non è `completed`/`success`, non dare per scontato che l'ultimo lavoro fosse concluso.

**`gestilab-auth-service` non ha ancora una CI propria** (gap noto, non ancora deciso se/quando colmarlo). Verificare a mano: typecheck, lint e test vanno eseguiti tramite il container `auth` dello stack di sviluppo di `gestilab-app` (che monta dal vivo il clone standalone), non tramite `vendor/gestilab-auth-service` visto da `api`/`web` (quello è il submodule, un checkout diverso e spesso più vecchio).

## 3. Confronta lo stato del codice con il backlog

**Non fidarsi ciecamente di un riassunto o di una memoria precedente**: verificare che i task dichiarati "fatti" lo siano davvero nel codice attuale. `docs/07-backlog-mvp.md` elenca ogni task con un criterio esplicito ("Fatto quando"): per la fase in corso, controllare quel criterio con grep/ls/test reali, non a memoria. Esempio: prima di assumere che un endpoint esista, cercarlo (`grep -rn` sulla rotta), non fidarsi che sia "probabilmente lì".

## 4. Consulta il documento di riferimento architetturale

Claude Docs — **GestiLab — Decisioni architetturali**: https://claude.ai/artifact/LuuucnHdbYXYF455As7356

Unica fonte per le decisioni prese e il loro perché (inclusa una sezione dedicata al flusso dei submodule git). Non riproporre discussioni già chiuse lì senza un motivo nuovo. Non duplicarne il contenuto in un file di questo repository.

## 5. Regole permanenti (valgono sempre, non solo per il task in corso)

- **Workflow git**: ogni commit su un branch dedicato (`tipo/descrizione-breve`), mai direttamente su `dev` o `main`. Merge `--no-ff` in `dev`. `main`/`master` resta permanentemente fermo al solo scheletro iniziale. **Nessuna attribuzione AI nei commit** (niente `Co-Authored-By: Claude`, niente `Generated with Claude Code`) — verificare col grep prima di ogni commit. Push automatico del branch e di `dev` dopo il merge. Branch mergiati eliminati subito, in locale e in remoto, senza bisogno di chiedere.
- **Fermarsi prima di scelte architetturali nuove**: spiegare il piano e aspettare conferma prima di scrivere codice, a meno che non sia stata concessa esplicitamente autonomia per quel batch di lavoro.
- **Backlog completo in ordine**: seguire `docs/07-backlog-mvp.md` fase per fase, task per task, così come scritto. Non proporre tagli di scope, percorsi minimi o scorciatoie verso un MVP ridotto senza che Mario lo chieda esplicitamente — è già stato deciso di procedere senza saltare nulla.
- **Un task si considera concluso solo con una verifica reale**: test automatici che passano, e — dove esiste una CI — un run reale verde, non solo l'assenza di errori evidenti in locale.
- **Locale, a costo zero, pronto per la produzione** (`docs/CLAUDE.md`): nessun dominio hardcoded, nessuna dipendenza a pagamento, ogni servizio esterno ha un equivalente in container.

## 6. Proponi un piano, non eseguirlo subito

Dopo i passi 1-5: riassumere in poche righe cosa risulta verificato (stato repo, CI, prossimo task secondo il backlog) e proporre un piano concreto per il prossimo task in ordine. Aspettare conferma prima di iniziare a scrivere codice, salvo autonomia esplicitamente concessa per quel piano specifico.

## 7. Ad ogni task concluso

1. Branch dedicato → commit (senza attribuzione AI) → push → merge `--no-ff` in `dev` → push di `dev`.
2. Dove esiste una CI, aspettare un run reale verde prima di considerare il task concluso.
3. Eliminare il branch mergiato, locale e remoto.
4. Se il task ha comportato una decisione architetturale o un bug non ovvio, aggiungere una sezione al documento di riferimento (passo 4) — mai duplicarne il contenuto altrove nel repository.
