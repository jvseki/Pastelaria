# Migracao Hostinger → VKNP

Guia para mover **site + API + PostgreSQL** do VPS Hostinger atual para o novo servidor VKNP.

## Visao geral

| Etapa | Onde | O que faz |
|-------|------|-----------|
| 1 | Hostinger | Gera pacote com banco + `.env` |
| 2 | VKNP | Instala Docker, clona repo, sobe containers |
| 3 | VKNP | Restaura banco e valida |
| 4 | Externo | Atualiza Google OAuth, Mercado Pago, DNS |

**Servidor atual (Hostinger):** `179.197.75.69`  
**Servidor destino (VKNP):** substitua `SEU_IP_VKNP` pelo IP do novo VPS.

---

## Passo 1 — Preparar pacote no Hostinger

No servidor atual (`/opt/Pastelaria`):

```bash
cd /opt/Pastelaria
bash deploy/scripts/prepare-migration.sh
```

Isso gera em `/opt/`:

- `pastelaria-migration-YYYYMMDD_HHMMSS.tar.gz` — pacote completo
- pasta com backup SQL, `.env`, scripts e este guia

Envie para o VKNP:

```bash
scp /opt/pastelaria-migration-*.tar.gz root@SEU_IP_VKNP:/opt/
```

---

## Passo 2 — Configurar Git (push/pull nos dois servidores)

### Chave SSH no GitHub

Em cada servidor, mostre a chave publica:

```bash
cat ~/.ssh/id_ed25519.pub
```

No GitHub: **Settings → SSH and GPG keys → New SSH key**  
Adicione a chave de cada servidor (Hostinger e VKNP).

Teste:

```bash
ssh -T git@github.com
git remote set-url origin git@github.com:jvseki/Pastelaria.git
git pull origin main
```

### Atualizar app depois de mudancas no codigo

```bash
cd /opt/Pastelaria
bash deploy/scripts/deploy-update.sh
```

---

## Passo 3 — Bootstrap no VKNP

Conecte no VKNP:

```bash
ssh root@SEU_IP_VKNP
```

Extraia o pacote (se enviou o tar):

```bash
cd /opt
tar -xzf pastelaria-migration-*.tar.gz
```

### Opcao A — Setup automatico (servidor limpo)

```bash
cd /opt/Pastelaria
bash deploy/scripts/setup-vknp.sh http://SEU_IP_VKNP
```

### Opcao B — Setup manual

```bash
apt update && apt install -y git curl
curl -fsSL https://get.docker.com | sh

cd /opt
git clone git@github.com:jvseki/Pastelaria.git
cd Pastelaria

cp .env.vknp.example .env
nano .env   # ajuste POSTGRES_PASSWORD, URLs, tokens

docker compose up -d --build
```

Se trouxe o `.env` do pacote de migracao, copie-o por cima:

```bash
cp /opt/pastelaria-migration-*/.env /opt/Pastelaria/.env
# Edite FRONTEND_URL e API_PUBLIC_URL para o IP/domino do VKNP
nano /opt/Pastelaria/.env
```

---

## Passo 4 — Restaurar banco no VKNP

Com os containers rodando:

```bash
cd /opt/Pastelaria
bash deploy/scripts/restore-db.sh /opt/pastelaria-migration-*/pastelaria_*.sql
```

Ou backup avulso:

```bash
bash deploy/scripts/backup-db.sh          # no Hostinger
bash deploy/scripts/restore-db.sh arquivo.sql  # no VKNP
```

---

## Passo 5 — Validar no VKNP

```bash
docker compose ps
docker compose logs -f api
```

No navegador: `http://SEU_IP_VKNP`

- [ ] Cardapio carrega
- [ ] Login Google funciona
- [ ] Pedido com Pix
- [ ] Painel admin (`/admin.html`)

---

## Passo 6 — Servicos externos (obrigatorio em producao)

### Google OAuth

[Google Cloud Console](https://console.cloud.google.com/) → Credenciais → OAuth Client:

**Origens JavaScript autorizadas** — adicione:

```
http://SEU_IP_VKNP
https://seudominio.com.br
```

Pode manter o IP antigo temporariamente durante a transicao.

### Mercado Pago

Atualize o webhook para o novo endereco:

```
https://SEU_DOMINIO_OU_IP/pagamentos/webhook
```

Confirme no `.env` do VKNP:

```env
API_PUBLIC_URL=http://SEU_IP_VKNP
MERCADOPAGO_SANDBOX=false
```

### DNS (quando tiver dominio)

1. Registro **A** apontando para o IP do VKNP
2. Certbot/HTTPS
3. Atualize `FRONTEND_URL` e `API_PUBLIC_URL` para `https://...`
4. `docker compose restart api`

---

## Comandos uteis

| Acao | Comando |
|------|---------|
| Backup do banco | `bash deploy/scripts/backup-db.sh` |
| Atualizar app | `bash deploy/scripts/deploy-update.sh` |
| Gerar pacote migracao | `bash deploy/scripts/prepare-migration.sh` |
| Restaurar banco | `bash deploy/scripts/restore-db.sh arquivo.sql` |
| Logs | `docker compose logs -f` |

---

## Corte de producao (quando VKNP estiver ok)

1. Coloque o Hostinger em manutencao ou pare: `docker compose down`
2. Aponte DNS para o VKNP
3. Remova IP antigo do Google OAuth (depois de validar o novo)
4. Confirme webhook Mercado Pago no novo URL

---

## Problemas comuns

| Problema | Solucao |
|----------|---------|
| `git push` pede senha | Configure chave SSH no GitHub |
| Site nao abre no VKNP | `ufw allow 80/tcp`; `docker compose ps` |
| Login Google falha | Adicione URL do VKNP nas origens OAuth |
| Pix nao confirma | `API_PUBLIC_URL` deve ser URL publica do VKNP |
| Banco vazio apos migrate | Rode `restore-db.sh` com o SQL correto |
