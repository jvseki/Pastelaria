> Atualiza??o de seguran?a: siga [SECURITY.md](SECURITY.md) e o [README](README.md). O acesso administrativo agora usa sess?o Google e ADMIN_EMAIL no servidor. Em produ??o use APP_ENV=production, HTTPS e MERCADOPAGO_SANDBOX=false. As instru??es antigas de ambiente abaixo precisam ser adaptadas.

# Deploy com Supabase + Render + Vercel

Guia passo a passo para colocar a Pastelaria Delivery no ar usando **Supabase** (banco PostgreSQL), **Render** (API) e **Vercel** (site).

---

## Visão geral

```
Cliente (navegador)
       ↓
  Vercel (frontend)
       ↓
  Render (backend FastAPI)
       ↓
  Supabase (PostgreSQL)
```

---

## Parte 1 — Supabase (banco de dados)

### 1.1 Criar projeto

1. Acesse [supabase.com](https://supabase.com) e crie uma conta
2. **New project**
3. Escolha nome (ex: `pastelaria-delivery`), senha forte do banco e região (**South America** se disponível)
4. Aguarde o projeto ficar pronto (~2 min)

### 1.2 Criar tabelas

No painel Supabase: **SQL Editor** → **New query** → cole e execute:

```sql
-- Usuários e endereços
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(200) NOT NULL,
    email_google VARCHAR(200) UNIQUE NOT NULL,
    telefone VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS enderecos (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    rua VARCHAR(200) NOT NULL,
    numero VARCHAR(20) NOT NULL,
    bairro VARCHAR(100) NOT NULL,
    referencia TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS produtos (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(200) NOT NULL,
    descricao TEXT,
    preco DOUBLE PRECISION NOT NULL,
    imagem VARCHAR(500),
    categoria VARCHAR(100) NOT NULL,
    ativo BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS pedidos (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    pagamento VARCHAR(50) NOT NULL,
    troco DOUBLE PRECISION,
    status VARCHAR(50) DEFAULT 'pendente',
    pagamento_confirmado BOOLEAN DEFAULT FALSE,
    arquivado BOOLEAN DEFAULT FALSE,
    data_pedido TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS itens_pedido (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    produto_id INTEGER NOT NULL REFERENCES produtos(id),
    quantidade INTEGER NOT NULL DEFAULT 1
);

-- Gaveta: histórico ao fechar o dia
CREATE TABLE IF NOT EXISTS gavetas_diarias (
    id SERIAL PRIMARY KEY,
    data_referencia DATE NOT NULL,
    fechado_em TIMESTAMPTZ DEFAULT NOW(),
    qtd_pedidos INTEGER DEFAULT 0,
    total_vendas DOUBLE PRECISION DEFAULT 0,
    pedidos_snapshot JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_arquivado ON pedidos(arquivado);
CREATE INDEX IF NOT EXISTS idx_pedidos_data ON pedidos(data_pedido DESC);
CREATE INDEX IF NOT EXISTS idx_gavetas_data ON gavetas_diarias(data_referencia DESC);
```

> Os produtos iniciais são criados automaticamente pela API na primeira subida (`app.py`).

### 1.3 Pegar a URL de conexão

1. **Project Settings** → **Database**
2. Em **Connection string**, escolha **URI**
3. Copie a string **Session mode** ou **Transaction pooler** (porta 6543 recomendada no Render)
4. Substitua `[YOUR-PASSWORD]` pela senha do banco

Exemplo:

```
postgresql://postgres.xxxxxxxxxxxx:SUA_SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
```

Guarde essa URL — será o `DATABASE_URL` no Render.

---

## Parte 2 — Render (backend / API)

### 2.1 Subir o código

1. Coloque o projeto no **GitHub** (se ainda não estiver)
2. Acesse [render.com](https://render.com) → **New** → **Web Service**
3. Conecte o repositório
4. Configuração:

| Campo | Valor |
|--------|--------|
| Root Directory | `backend` |
| Runtime | Python 3 |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn app:app --host 0.0.0.0 --port $PORT` |

### 2.2 Variáveis de ambiente (Render)

Em **Environment** → adicione:

| Variável | Valor |
|----------|--------|
| `DATABASE_URL` | URL do Supabase (passo 1.3) |
| `SECRET_KEY` | String aleatória longa (ex: gere no 1Password) |
| `GOOGLE_CLIENT_ID` | Seu Client ID do Google OAuth |
| `ADMIN_EMAIL` | E-mail Google autorizado no backend; nunca configure token administrativo no frontend |
| `MOTOBOY_WHATSAPP` | `SEU_NUMERO_CONFIGURADO` |
| `FRONTEND_URL` | URL da Vercel (preencha depois do passo 3) |

### 2.3 Deploy

Clique **Create Web Service**. Anote a URL da API, ex:

```
https://pastelaria-delivery-api.onrender.com
```

Teste no navegador: deve aparecer `{"message":"Pastelaria Delivery API","status":"online"}`

---

## Parte 3 — Vercel (frontend)

### 3.1 Deploy

1. [vercel.com](https://vercel.com) → **Add New Project**
2. Importe o mesmo repositório
3. **Root Directory:** `frontend`
4. Framework: Other (site estático)
5. Deploy

### 3.2 Apontar para a API

Edite `frontend/js/config.js` **antes do deploy** (ou depois e redeploy):

```javascript
window.API_URL = "https://SUA-API.onrender.com";
window.GOOGLE_CLIENT_ID = "seu-client-id.apps.googleusercontent.com";
// ... demais configs
```

Ou crie um script de build que injeta a URL — por simplicidade, edite `config.js` com a URL de produção.

### 3.3 Atualizar FRONTEND_URL no Render

Volte ao Render e coloque em `FRONTEND_URL` a URL da Vercel:

```
https://seu-projeto.vercel.app
```

Reinicie o serviço no Render.

---

## Parte 4 — Google OAuth (produção)

No [Google Cloud Console](https://console.cloud.google.com):

1. **APIs & Services** → **Credentials** → seu OAuth Client
2. **Authorized JavaScript origins:**
   - `https://seu-projeto.vercel.app`
   - `http://localhost:5500` (dev)
3. **Authorized redirect URIs:** (se usar redirect; login atual usa popup/GSI)

Veja também [GOOGLE_SETUP.md](GOOGLE_SETUP.md).

---

## Parte 5 — Testar em produção

1. Abra o site na Vercel
2. Cardápio carrega? → API + banco OK
3. Login Google funciona?
4. Faça um pedido teste
5. Admin (`/admin.html`) — login com e-mail admin configurado em `auth.js`
6. **Fechar dia (gaveta)** — arquiva pedidos no Supabase

---

## Gaveta diária (fechar o dia)

No painel **Admin**:

1. Finalize os pedidos do dia
2. Clique **Fechar dia (gaveta)**
3. Os pedidos saem da lista ativa e ficam guardados em **Gaveta — histórico arquivado**
4. Clique numa gaveta para ver os pedidos daquele fechamento

Os dados ficam na tabela `gavetas_diarias` no Supabase (backup permanente).

---

## Checklist rápido

- [ ] Projeto Supabase criado + SQL executado
- [ ] `DATABASE_URL` no Render
- [ ] API online no Render
- [ ] Frontend na Vercel com `API_URL` correto
- [ ] `FRONTEND_URL` no Render = URL Vercel
- [ ] Google OAuth com origem da Vercel
- [ ] Pedido teste + admin + gaveta testados

---

## Problemas comuns

**API não conecta no Supabase**
- Confira senha na URL (caracteres especiais devem ser URL-encoded)
- Use connection string do **pooler** (porta 6543)
- O projeto já adiciona `sslmode=require` automaticamente para URLs Supabase

**CORS / login**
- `FRONTEND_URL` no Render deve bater com a URL exata da Vercel (sem barra no final)

**Render free tier “dorme”**
- Primeira requisição pode demorar ~30s — normal no plano gratuito

**Produtos não aparecem**
- A API cria/atualiza produtos no startup; veja logs do Render

---

## Desenvolvimento local com Supabase

No `backend/.env`:

```env
DATABASE_URL=postgresql://postgres.xxxx:SENHA@....pooler.supabase.com:6543/postgres
FRONTEND_URL=http://localhost:5500
```

```powershell
cd backend
uvicorn app:app --reload
```

```powershell
cd frontend
npx serve .
```

Assim você testa localmente já com o banco de produção (cuidado com dados reais).
