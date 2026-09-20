# Setup ambiente di sviluppo — Fedora

Guida **idempotente**: ogni sezione comincia con una verifica. Se la verifica passa, salti l'installazione. Niente reinstallazioni inutili, niente configurazioni sovrascritte.

Presupposti: Fedora Workstation, WebStorm come IDE.

---

## 0. Diagnostica iniziale

Esegui questo script: ti dice quali sezioni leggere e quali saltare.

```bash
#!/usr/bin/env bash
# salva come preflight.sh, poi: bash preflight.sh
ok(){ printf '  \033[32m✓\033[0m %s\n' "$1"; }
ko(){ printf '  \033[31m✗\033[0m %s \033[2m→ sezione %s\033[0m\n' "$1" "$2"; }
wr(){ printf '  \033[33m!\033[0m %s\n' "$1"; }

echo "── Sistema"
for c in git curl jq make g++ psql; do
  command -v "$c" >/dev/null 2>&1 && ok "$c" || ko "$c mancante" 1
done

echo "── Git"
git config --global user.email >/dev/null 2>&1 \
  && ok "identità git: $(git config --global user.email)" || ko "identità git non configurata" 1.2
[ "$(git config --global init.defaultBranch)" = "main" ] \
  && ok "defaultBranch=main" || wr "init.defaultBranch non è 'main'"
ssh -o BatchMode=yes -o ConnectTimeout=5 -T git@github.com 2>&1 | grep -q "successfully authenticated" \
  && ok "chiave SSH GitHub funzionante" || ko "SSH GitHub non autenticato" 1.3

echo "── Node"
if command -v node >/dev/null 2>&1; then
  v=$(node -v | sed 's/v//;s/\..*//')
  [ "$v" -ge 22 ] && ok "node $(node -v)" || ko "node $(node -v) inferiore a 22" 2
else ko "node assente" 2; fi
command -v fnm >/dev/null 2>&1 && ok "fnm presente" || wr "fnm assente (consigliato, sezione 2.2)"
command -v pnpm >/dev/null 2>&1 && ok "pnpm $(pnpm -v)" || ko "pnpm assente" 2.3

echo "── Docker"
if docker info >/dev/null 2>&1; then
  ok "docker attivo senza sudo"
  docker compose version >/dev/null 2>&1 && ok "compose v2" || ko "plugin compose assente" 3.2
else
  if command -v docker >/dev/null 2>&1; then ko "docker installato ma non usabile (gruppo o servizio)" 3.2
  else ko "docker assente" 3.2; fi
fi
[ "$(getenforce 2>/dev/null)" = "Enforcing" ] && wr "SELinux enforcing: i bind mount richiedono ':z' (3.3)"
ss -lntp 2>/dev/null | grep -q ':5432 ' && wr "porta 5432 occupata sull'host (sezione 9)"

echo "── Limite inotify"
w=$(cat /proc/sys/fs/inotify/max_user_watches)
[ "$w" -ge 524288 ] && ok "inotify watches $w" || wr "inotify watches $w, basso (sezione 9)"
```

Leggi solo le sezioni segnate con ✗. Le righe `!` sono avvisi da valutare, non bloccanti.

---

## 1. Sistema base, git, SSH

### 1.1 Pacchetti
Verifica:
```bash
rpm -q git curl jq make gcc-c++ postgresql
```
Installa solo ciò che manca:
```bash
sudo dnf install -y git curl wget jq unzip make gcc-c++ openssl-devel postgresql
```
`postgresql` qui è **solo il client** (`psql`); il server gira in container.

### 1.2 Identità git
Verifica:
```bash
git config --global --get user.name
git config --global --get user.email
git config --global --get init.defaultBranch   # atteso: main
git config --global --get pull.rebase          # atteso: true
```
Imposta solo i valori vuoti:
```bash
git config --global user.name "Nome Cognome"
git config --global user.email "tua@email.it"
git config --global init.defaultBranch main
git config --global pull.rebase true
```

### 1.3 Chiave SSH GitHub
Verifica — **se risponde, non generare una nuova chiave**:
```bash
ssh -T git@github.com
# "Hi <utente>! You've successfully authenticated" → sezione completata
ls -1 ~/.ssh/*.pub 2>/dev/null
```
Solo se non hai alcuna chiave:
```bash
ssh-keygen -t ed25519 -C "tua@email.it"
cat ~/.ssh/id_ed25519.pub   # incolla in GitHub > Settings > SSH keys
```
Se una chiave esiste ma non è caricata su GitHub, carica quella. Generarne un'altra sporca la configurazione.

---

## 2. Node e pnpm

### 2.1 Verifica
```bash
node -v          # serve ≥ 22
pnpm -v
command -v fnm
```
Se Node è ≥ 22 e pnpm risponde, **salta alla sezione 3**.

### 2.2 Node via fnm
Controlla da dove viene il Node attuale:
```bash
rpm -qf "$(command -v node)" 2>/dev/null   # se risponde, viene da dnf
```
Un Node da `dnf` funziona, ma non ti lascia cambiare versione per progetto. Passaggio a fnm:
```bash
command -v fnm >/dev/null || curl -fsSL https://fnm.vercel.app/install | bash
# riapri il terminale
fnm install 22 && fnm default 22
```
Aggiungi l'inizializzazione alla shell **solo se non c'è già**:
```bash
grep -q 'fnm env' ~/.zshrc || echo 'eval "$(fnm env --use-on-cd)"' >> ~/.zshrc
```
Nel repo c'è `.node-version` con `22`: fnm cambia versione entrando nella cartella.

### 2.3 pnpm
```bash
which -a pnpm    # se compare più di una volta, hai installazioni concorrenti
pnpm -v || { corepack enable && corepack prepare pnpm@latest --activate; }
```
Se pnpm esiste già (script standalone o `npm -g`), tienilo e non aggiungere corepack sopra: due gestori della stessa binaria generano conflitti di versione silenziosi.

---

## 3. Docker

### 3.1 Verifica
```bash
docker info >/dev/null 2>&1 && echo "docker usabile senza sudo"
docker compose version
```
Se entrambi rispondono, **vai direttamente a 3.3**: SELinux va controllato comunque.

### 3.2 Installazione o riparazione
Solo se Docker è assente:
```bash
sudo dnf -y install dnf-plugins-core
sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```
Se è installato ma `docker info` chiede sudo:
```bash
id -nG | grep -q docker || sudo usermod -aG docker "$USER"
# poi esci e rientra dalla sessione, oppure: newgrp docker
```
Se il gruppo c'è ma il comando fallisce:
```bash
systemctl is-active docker || sudo systemctl enable --now docker
```
**Podman**: se lo usi già, puoi restare, ma `podman-compose` gestisce healthcheck e `depends_on` in modo diverso e la CI usa Docker. Disattiva il socket Podman solo in caso di conflitto reale:
```bash
systemctl --user is-active podman.socket && systemctl --user disable --now podman.socket
```

### 3.3 SELinux — da controllare anche se Docker era già pronto
```bash
getenforce
```
Con `Enforcing`, i bind mount del codice richiedono l'etichetta `:z`:
```yaml
volumes:
  - ./apps/api:/app/apps/api:z
```
Senza `:z` il container vede la cartella vuota o riceve `permission denied`. **Non disattivare SELinux**: è il compose del progetto che deve essere scritto correttamente.

### 3.4 Firewall — solo se i container non si raggiungono
```bash
sudo firewall-cmd --get-active-zones | grep -A1 trusted | grep -q docker0 || {
  sudo firewall-cmd --permanent --zone=trusted --add-interface=docker0
  sudo firewall-cmd --reload
}
```

---

## 4. Avvio del progetto (profilo dev)

Controlla le porte prima di partire:
```bash
for p in 3000 3001 5432 6379 9000 9001 8025 8080; do
  ss -lntp 2>/dev/null | grep -q ":$p " && echo "porta $p OCCUPATA" || echo "porta $p libera"
done
```
La 5432 occupata significa quasi sempre Postgres installato sull'host: `sudo systemctl disable --now postgresql`.

```bash
git clone git@github.com:<utente>/gestilab.git
cd gestilab
[ -f .env ] || cp .env.example .env     # non sovrascrive un .env esistente
pnpm install
pnpm dev
```
Al primo avvio, in un secondo terminale:
```bash
pnpm db:migrate
pnpm db:seed
```

| Servizio | URL |
|---|---|
| App tenant demo | http://dellaquila.localhost:3000 |
| Secondo tenant (prova isolamento) | http://demo.localhost:3000 |
| API | http://localhost:3001/api/v1/salute |
| OpenAPI | http://localhost:3001/docs |
| Mailpit | http://localhost:8025 |
| MinIO console | http://localhost:9001 |
| Adminer | http://localhost:8080 |

`*.localhost` risolve a 127.0.0.1 su Firefox e Chromium senza toccare `/etc/hosts`. Se il tuo browser non lo fa:
```bash
grep -q dellaquila.localhost /etc/hosts || \
  echo "127.0.0.1 dellaquila.localhost demo.localhost" | sudo tee -a /etc/hosts
```

---

## 5. HTTPS locale e dominio `gestilab.test`

Serve per il profilo `local-prod`: senza HTTPS non puoi provare service worker, Web Push, cookie `Secure` e camera. Costo zero: `.test` è un TLD riservato dalla RFC 2606, non registrabile e non risolvibile su Internet.

### 5.1 Verifica
```bash
command -v mkcert && mkcert -CAROOT        # CA locale già presente?
getent hosts dellaquila.gestilab.test      # risoluzione già configurata?
```
Se entrambi rispondono, salta alla 5.4.

### 5.2 CA locale con mkcert
```bash
sudo dnf install -y nss-tools
# scarica mkcert dai rilasci ufficiali su GitHub, poi:
mkcert -install                              # installa la CA nei trust store del sistema e dei browser
mkcert -cert-file certs/local.pem -key-file certs/local-key.pem \
       "gestilab.test" "*.gestilab.test"
```
La cartella `certs/` è in `.gitignore`: i certificati non si versionano mai, nemmeno quelli locali.

### 5.3 Risoluzione DNS
Opzione consigliata, `dnsmasq`, che risolve l'intero wildcard senza elencare i sottodomini:
```bash
sudo dnf install -y dnsmasq
echo 'address=/gestilab.test/127.0.0.1' | sudo tee /etc/dnsmasq.d/gestilab.conf
sudo systemctl enable --now dnsmasq
```
Su Fedora con NetworkManager, se dnsmasq non viene interrogato:
```bash
grep -q '^dns=dnsmasq' /etc/NetworkManager/NetworkManager.conf || \
  sudo sed -i '/^\[main\]/a dns=dnsmasq' /etc/NetworkManager/NetworkManager.conf
sudo systemctl restart NetworkManager
```
Alternativa minimale senza dnsmasq (va aggiornata a ogni nuovo tenant):
```bash
grep -q gestilab.test /etc/hosts || echo \
  "127.0.0.1 gestilab.test dellaquila.gestilab.test demo.gestilab.test app.gestilab.test console.gestilab.test" \
  | sudo tee -a /etc/hosts
```

### 5.4 Avvio del profilo local-prod
```bash
pnpm local-prod
curl -sI https://dellaquila.gestilab.test | head -1     # 200, certificato valido
```
Qui i cookie sono `Secure`, il service worker si registra, le push funzionano. È il profilo in cui verificare ogni modifica infrastrutturale.

---

## 5bis. Prove da telefono reale

Il telefono deve stare sulla stessa rete Wi-Fi della macchina. Due passaggi:

1. Fai risolvere il dominio sul telefono. La via più semplice è un DNS locale: aggiungi al file di dnsmasq l'IP della macchina invece di 127.0.0.1 e imposta quel DNS sul telefono.
```bash
ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v 127.0.0.1
echo 'address=/gestilab.test/192.168.X.Y' | sudo tee /etc/dnsmasq.d/gestilab.conf
sudo systemctl restart dnsmasq
sudo firewall-cmd --permanent --add-service=dns --add-port=443/tcp && sudo firewall-cmd --reload
```
2. Installa la CA di mkcert sul telefono, altrimenti il certificato risulta non attendibile e il service worker non si registra.
```bash
mkcert -CAROOT      # copia rootCA.pem sul telefono e installalo come certificato CA
```
Su Android: Impostazioni > Sicurezza > Cifratura e credenziali > Installa un certificato > Certificato CA. Su iOS: installa il profilo e poi attivalo in Generali > Info > Attendibilità certificati.

Nessun tunnel, nessun account, nessuna spesa. Un tunnel serve solo il giorno in cui vorrai far provare l'app a qualcuno fuori dalla tua rete.

## 6. WebStorm

Verifica prima cosa è già configurato: *Settings > Languages & Frameworks > Node.js* deve puntare all'interprete fnm, non a `/usr/bin/node`.
```bash
fnm which 22    # percorso da incollare in WebStorm
```

**Plugin** (controlla quali hai già installato): Docker, Tailwind CSS, Prettier, EnvFile, .ignore, Conventional Commit.

**Impostazioni:**
- *Package manager*: pnpm.
- *Prettier*: "Run on save", pattern `{**/*,*}.{js,ts,jsx,tsx,css,json,md}`.
- *ESLint*: "Automatic ESLint configuration".
- *TypeScript*: versione del progetto (`node_modules/typescript`), non quella dell'IDE.
- *Editor > File Types*: escludi `node_modules`, `.next`, `dist`, `.turbo` dalla ricerca.
- *Docker*: socket Unix `/var/run/docker.sock`.

**Run configurations:** `dev`, `test` (Vitest), `e2e` (Playwright), `db:migrate`, `db:seed`, e *Attach to Node.js* sulla porta 9229 per il debug dell'API nel container (esponi 9229 in `compose.dev.yaml`, avvio con `--inspect=0.0.0.0:9229`).

**VM options** (Help > Edit Custom VM Options): controlla il valore attuale di `-Xmx` prima di cambiarlo; con almeno 16 GB, `-Xmx4096m` è ragionevole.

---

## 7. Claude Code

```bash
command -v claude || echo "installa secondo la documentazione ufficiale corrente"
cd gestilab
[ -e CLAUDE.md ] || ln -s docs/CLAUDE.md CLAUDE.md
claude
```
`.claudeignore` deve escludere `node_modules`, `.next`, `dist`, `pnpm-lock.yaml`, `*.png`.

Uso consigliato: un task del backlog alla volta, con la sua verifica come criterio di chiusura; mai schema, API e UI nella stessa sessione.

---

## 8. Controllo finale

```bash
node -v && pnpm -v && docker compose version
docker compose ps                                       # tutti "healthy"
curl -s localhost:3001/api/v1/salute
curl -sI http://dellaquila.localhost:3000 | head -1      # 200
curl -sI http://pippo.localhost:3000 | head -1           # 404 → isolamento tenant ok
curl -sI https://dellaquila.gestilab.test | head -1      # 200 in profilo local-prod
pnpm test
pnpm backup:verifica                                     # ripristino riuscito
```
Se il 404 su `pippo.localhost` non arriva, la risoluzione del tenant è rotta: fermati lì, non proseguire.

---

## 9. Problemi frequenti su Fedora

| Sintomo | Verifica | Soluzione |
|---|---|---|
| Container vede la cartella vuota | `getenforce` | aggiungi `:z` al bind mount |
| `permission denied` sul socket Docker | `id -nG \| grep docker` | esci e rientra dalla sessione |
| Porta 5432 occupata | `ss -lntp \| grep 5432` | `sudo systemctl disable --now postgresql` |
| Scritture lente nel container | `node_modules` montato dall'host | volume nominato per `node_modules` |
| `EACCES` con pnpm | `which -a pnpm` | tieni una sola installazione |
| Camera non attiva sul telefono | contesto non sicuro | tunnel o mkcert (sezione 5) |
| Watch dei file non scatta | `cat /proc/sys/fs/inotify/max_user_watches` | `echo fs.inotify.max_user_watches=524288 \| sudo tee /etc/sysctl.d/99-inotify.conf && sudo sysctl --system` |
| fnm non cambia versione entrando nel repo | `grep 'fnm env' ~/.zshrc` | aggiungi `eval "$(fnm env --use-on-cd)"` |
