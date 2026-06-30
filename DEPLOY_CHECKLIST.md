# Checklist de deploy — jvseki/Pastelaria

Repo: https://github.com/jvseki/Pastelaria

Ordem: **Supabase → Render → Vercel → Google OAuth**

---

## 1. Supabase (banco)

1. [supabase.com](https://supabase.com) → **New project**
2. Nome: `pastelaria-delivery` | Região: **South America (São Paulo)**
3. Anote a **senha do banco**
4. **SQL Editor** → cole o arquivo `supabase/setup.sql` → **Run**
5. **Project Settings → Database → Connection string → URI**
6. Escolha **Transaction pooler** (porta **6543**)
7. Copie a URL e troque `[YOUR-PASSWORD]` pela senha real

Exemplo:
```
postgresql://postgres.xxxxx:MINHA_SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
```

---

## 2. Render (API)

1. [render.com](https://render.com) → **New → Blueprint** ou **Web Service**
2. Conecte o repo **jvseki/Pastelaria**
3. Se usar Blueprint, ele le o `render.yaml` automaticamente
4. Se manual:
   - Root Directory: `backend`
   - Build: `pip install -r requirements.txt`
   - Start: `uvicorn app:app --host 0.0.0.0 --port $PORT`

### Variaveis de ambiente (Environment)

| Variavel | Valor |
|----------|--------|
| `DATABASE_URL` | URL do Supabase (passo 1) |
| `SECRET_KEY` | Gere uma string longa aleatoria |
| `GOOGLE_CLIENT_ID` | `19682040972-bqnoppb492er7rm8kdtlj3b6ie7ug5e3.apps.googleusercontent.com` |
| `ADMIN_TOKEN` | `admin-token-secreto` (igual ao `frontend/js/config.js`) |
| `MOTOBOY_WHATSAPP` | `5518997640335` |
| `FRONTEND_URL` | Preencha depois do passo 3 (URL da Vercel) |

5. Deploy → teste: `https://pastelaria-delivery-api.onrender.com`  
   Deve retornar: `{"message":"Pastelaria Delivery API","status":"online"}`

---

## 3. Vercel (site)

1. [vercel.com](https://vercel.com) → **Add New Project**
2. Importe **jvseki/Pastelaria**
3. **Root Directory:** clique Edit → selecione `frontend`
4. Framework Preset: **Other** (site estatico)
5. Deploy

Anote a URL, ex: `https://pastelaria-xxx.vercel.app`

6. Volte ao **Render** e atualize:
   ```
   FRONTEND_URL=https://pastelaria-xxx.vercel.app
   ```
7. **Manual Deploy** no Render para aplicar

---

## 4. Google OAuth (producao)

1. [Google Cloud Console](https://console.cloud.google.com/) → Credenciais → seu OAuth Client
2. **Origens JavaScript autorizadas** — adicione:
   ```
   https://pastelaria-xxx.vercel.app
   ```
3. Salve e aguarde ~5 min

Detalhes: [GOOGLE_SETUP.md](GOOGLE_SETUP.md)

---

## 5. Testar

- [ ] Site abre na Vercel
- [ ] Cardapio carrega (API + Supabase OK)
- [ ] Login Google funciona
- [ ] Pedido teste completo
- [ ] Admin em `/admin.html` (email admin configurado)
- [ ] Fechar dia (gaveta) funciona

---

## Problemas comuns

**Cardapio nao carrega:** API dormindo (Render free) — espere 30s e recarregue.

**Erro de login Google:** Origem da Vercel nao cadastrada no Google Cloud.

**Admin nao funciona:** `ADMIN_TOKEN` diferente entre Render e `config.js`.

**Erro de banco:** Senha errada na `DATABASE_URL` ou SQL nao rodou no Supabase.
