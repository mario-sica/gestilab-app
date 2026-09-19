# Certificati locali (mkcert)

Questa cartella contiene il certificato TLS usato dal profilo `local-prod`,
generato in locale con [mkcert](https://github.com/FiloSottile/mkcert). I
file `.pem` **non sono versionati** (vedi `.gitignore` alla radice): sono
segreti locali legati alla CA di sviluppo della tua macchina, non hanno senso
fuori da essa.

## Setup (una tantum per macchina)

```bash
sudo dnf install -y mkcert nss-tools   # o il pacchetto equivalente della tua distro
mkcert -install                          # installa la CA locale nel trust store di sistema/browser
```

Poi, dalla radice del repository:

```bash
mkcert -cert-file docker/traefik/certs/gestilab.test.pem \
       -key-file docker/traefik/certs/gestilab.test-key.pem \
       "*.gestilab.test" gestilab.test
```

Serve anche far risolvere i sottodomini verso `127.0.0.1`, ad esempio
aggiungendo a `/etc/hosts`:

```
127.0.0.1 dellaquila.gestilab.test demo.gestilab.test app.gestilab.test console.gestilab.test
```

A questo punto `pnpm local-prod` porta su lo stack con Traefik in ascolto su
`:443` con questo certificato.
