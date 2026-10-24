> Atualiza??o de seguran?a: siga [SECURITY.md](SECURITY.md) e o [README](README.md). O acesso administrativo agora usa sess?o Google e ADMIN_EMAIL no servidor. Em produ??o use APP_ENV=production, HTTPS e MERCADOPAGO_SANDBOX=false. As instru??es antigas de ambiente abaixo precisam ser adaptadas.

# Deploy na Hostinger KVM — Pastelaria

Guia para subir **site + API + PostgreSQL** no mesmo VPS (Ubuntu 24.04).

## Na tela "Recursos adicionais" (agora)

Marque:

- **Gerenciador Docker** — necessário para rodar o projeto com containers
- **Detector de malware** — opcional, mas é grátis e ajuda na segurança

Clique em **Finalizar configuração** e aguarde o VPS ficar pronto (alguns minutos).

Anote:

- **IP do servidor** (ex.: `123.45.67.89`)
- **Senha root** ou chave SSH
- Acesso ao painel hPanel → VPS

---

## Passo 1 — Conectar no servidor

No Windows (PowerShell):

```powershell
ssh root@SEU_IP
```

Na primeira vez, aceite a fingerprint digitando `yes`.

---

## Passo 2 — Instalar Git (se ainda não tiver)

```bash
apt update && apt install -y git
```

O Docker já vem se você marcou **Gerenciador Docker** na Hostinger.

Confirme:

```bash
docker --version
docker compose version
```

---

## Passo 3 — Clonar o projeto

```bash
cd /opt
git clone https://github.com/jvseki/Pastelaria.git
cd Pastelaria
```

---

## Passo 4 — Configurar variáveis

```bash
cp .env.example .env
nano .env
```

Altere pelo menos:

```env
POSTGRES_PASSWORD=uma-senha-forte-aqui
FRONTEND_URL=http://SEU_IP
API_PUBLIC_URL=http://SEU_IP
SECRET_KEY=chave-secreta-longa
GOOGLE_CLIENT_ID=... (o mesmo do Google Cloud)
ADMIN_EMAIL=seu-email-google-autorizado
MERCADOPAGO_SANDBOX=true
```

Para testar Pix real no VPS, copie do Render:

```env
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
MERCADOPAGO_SANDBOX=false
```

Salvar no nano: `Ctrl+O`, Enter, `Ctrl+X`.

---

## Passo 5 — Subir tudo

```bash
docker compose up -d --build
```

Aguarde o build (primeira vez demora ~2–5 min).

Verificar:

```bash
docker compose ps
docker compose logs -f api
```

Deve aparecer `pastelaria` com 3 containers: `db`, `api`, `web` — todos `running`.

---

## Passo 6 — Abrir no navegador

Acesse:

```
http://SEU_IP
```

O site deve abrir. A API roda no mesmo endereço (Nginx faz o proxy).

Teste rápido:

- Cardápio carrega
- Login Google (veja passo 7)
- Fazer pedido com Pix simulado (`MERCADOPAGO_SANDBOX=true`)

---

## Passo 7 — Google Login no VPS

No [Google Cloud Console](https://console.cloud.google.com/) → Credenciais → seu OAuth Client:

**Origens JavaScript autorizadas:**

```
http://SEU_IP
```

(Depois, se usar domínio: `https://seudominio.com.br`)

**URIs de redirecionamento:** geralmente não precisa mudar para Google Sign-In no frontend.

Salve e aguarde ~5 min para propagar.

---

## Passo 8 — Firewall (recomendado)

No painel Hostinger ou no servidor:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

---

## Comandos úteis

| Ação | Comando |
|------|---------|
| Ver logs | `docker compose logs -f` |
| Reiniciar | `docker compose restart` |
| Parar | `docker compose down` |
| Atualizar código | `git pull && docker compose up -d --build` |
| Backup do banco | `docker compose exec db pg_dump -U postgres pastelaria > backup.sql` |

---

## Migrar banco do Supabase (quando for produção)

No seu PC (com a URL do Supabase):

```bash
pg_dump "postgresql://..." > supabase_backup.sql
```

No VPS:

```bash
docker compose exec -T db psql -U postgres pastelaria < supabase_backup.sql
```

---

## Domínio + HTTPS (depois)

1. Aponte o domínio (registro A) para o IP do VPS
2. Instale Certbot: `apt install certbot python3-certbot-nginx`
3. Atualize `FRONTEND_URL` e `API_PUBLIC_URL` para `https://seudominio.com.br`
4. Configure SSL no Nginx (ou use proxy da Hostinger)

Atualize também o **webhook do Mercado Pago**:

```
https://seudominio.com.br/pagamentos/webhook
```

---

## Problemas comuns

| Problema | Solução |
|----------|---------|
| Site não abre | `docker compose ps` — container `web` rodando? Firewall porta 80? |
| Erro de banco | Aguarde `db` ficar healthy; confira `POSTGRES_PASSWORD` no `.env` |
| Login Google falha | Adicione `http://SEU_IP` nas origens autorizadas do Google |
| Pix não confirma | `API_PUBLIC_URL` deve ser a URL pública acessível pelo MP |
| CORS | `FRONTEND_URL` no `.env` deve ser exatamente a URL do site |
