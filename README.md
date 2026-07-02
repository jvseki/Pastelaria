# Pastelaria Delivery

Sistema web de delivery para pastelaria com cardápio, carrinho, pagamento, login Google e painel administrativo.

## Tecnologias

- **Frontend:** HTML, CSS, JavaScript puro
- **Backend:** Python + FastAPI
- **Banco:** PostgreSQL
- **Deploy frontend:** Vercel
- **Deploy backend:** Render

## Estrutura

```
Pastelaria/
├── frontend/          # Interface do cliente e admin
│   ├── index.html     # Cardápio
│   ├── carrinho.html
│   ├── login.html
│   ├── cadastro.html
│   ├── pagamento.html
│   ├── pedido.html
│   ├── admin.html
│   ├── css/style.css
│   └── js/
├── backend/           # API FastAPI
│   ├── app.py
│   ├── config.py
│   ├── database.py
│   ├── models/
│   ├── routes/
│   └── services/
└── render.yaml
```

## Como rodar localmente

### 1. Backend (API)

```powershell
cd backend
Copy-Item .env.example .env
pip install -r requirements.txt
uvicorn app:app --reload
```

API em `http://localhost:8000`

### 2. Frontend

Abra a pasta `frontend` com Live Server (VS Code) ou:

```powershell
cd frontend
npx serve .
```

Acesse `http://localhost:3000` (ou a porta do Live Server).

> O frontend precisa da API rodando para cardápio, login, pedidos e admin.

### Backend + PostgreSQL (opcional)

1. Crie o banco no pgAdmin e execute `backend/schema.sql`
2. Copie `.env.example` para `.env` e configure:

```powershell
cd backend
Copy-Item .env.example .env
pip install -r requirements.txt
uvicorn app:app --reload
```

Por padrão o `.env` usa **SQLite** (`pastelaria.db`) para você subir a API sem configurar PostgreSQL. Para usar PostgreSQL, troque no `.env`:

```
DATABASE_URL=postgresql://postgres:SUA_SENHA@localhost:5432/pastelaria
```

API disponível em `http://localhost:8000`

> **Erro `UnicodeDecodeError` no Windows?** Isso geralmente significa que o PostgreSQL não está rodando ou a senha no `.env` está errada. Use SQLite (padrão) ou confira o serviço no pgAdmin.

3. Em `frontend/js/config.js`, aponte `API_URL` para `http://localhost:8000`

## Fluxo do cliente

1. Cardápio → adicionar produtos ao carrinho
2. Carrinho → ajustar quantidades
3. Login com Google
4. Cadastro de endereço
5. Pagamento (Pix / Dinheiro / Cartão)
6. Confirmação do pedido

## Painel Admin

Acesse `/admin.html` para:

- Ver pedidos em tempo real
- Atualizar status (Aceitar → Preparando → Saiu p/ entrega → Finalizado)
- Confirmar pagamento na entrega
- Enviar pedido para motoboy via WhatsApp com link do Google Maps
- **Fechar dia (gaveta)** — arquiva todos os pedidos ativos e guarda o histórico

## Deploy

Guia completo com **Supabase**: **[DEPLOY_SUPABASE.md](DEPLOY_SUPABASE.md)**

Resumo:

| Onde | O quê |
|------|--------|
| **Supabase** | Banco PostgreSQL |
| **Render** | API FastAPI (`backend/`) |
| **Vercel** | Site (`frontend/`) |

### Vercel (frontend)

1. Conecte o repositório na Vercel
2. Root directory: `frontend`
3. Configure variáveis em `config.js` ou injete via script no deploy

### Render (backend)

1. Conecte o repositório no Render
2. Use o `render.yaml` ou configure manualmente:
   - Root: `backend`
   - Build: `pip install -r requirements.txt`
   - Start: `uvicorn app:app --host 0.0.0.0 --port $PORT`
3. Adicione `DATABASE_URL` do PostgreSQL (Render ou externo)

## Configurações

| Variável | Descrição |
|----------|-----------|
| `GOOGLE_CLIENT_ID` | Login com Google OAuth — **só no backend** |
| `ADMIN_TOKEN` | Token de acesso ao painel admin |
| `MOTOBOY_WHATSAPP` | Número do motoboy (ex: 5511999999999) |
| `GOOGLE_MAPS_API_KEY` | Geocodificação de endereços |

### Mercado Pago (pagamento online)

Guia completo: **[MERCADOPAGO.md](MERCADOPAGO.md)**

### Login com Google

Siga o guia **[GOOGLE_SETUP.md](GOOGLE_SETUP.md)** — leva cerca de 5 minutos.

Resumo: crie credencial OAuth no Google Cloud, coloque o Client ID em `backend/.env` e reinicie a API. O frontend detecta automaticamente.
