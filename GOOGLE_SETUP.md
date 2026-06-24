# Configurar Login com Google

Guia rápido para ativar o botão **"Continuar com Google"** no Pastelaria Delivery.

## 1. Criar projeto no Google Cloud

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um projeto novo (ex: `Pastelaria Delivery`)
3. No menu, vá em **APIs e Serviços → Tela de consentimento OAuth**
4. Escolha **Externo** → Preencha nome do app e e-mail de suporte
5. Em **Escopos**, adicione: `email`, `profile`, `openid`
6. Em **Usuários de teste**, adicione seu e-mail Gmail (enquanto o app não for publicado)

## 2. Criar credencial OAuth

1. Vá em **APIs e Serviços → Credenciais**
2. Clique em **+ Criar credenciais → ID do cliente OAuth**
3. Tipo: **Aplicativo da Web**
4. Nome: `Pastelaria Delivery Web`

### Origens JavaScript autorizadas

Adicione todas as URLs onde o frontend roda:

```
http://localhost:3000
http://localhost:3456
http://localhost:5500
http://127.0.0.1:5500
https://seu-app.vercel.app
```

### URIs de redirecionamento

Para o fluxo usado (Google Identity Services / botão), normalmente **não precisa** de redirect URI, mas adicione por segurança:

```
http://localhost:5500
http://localhost:5500/login.html
https://seu-app.vercel.app
https://seu-app.vercel.app/login.html
```

5. Clique em **Criar** e copie o **ID do cliente** (termina em `.apps.googleusercontent.com`)

## 3. Configurar o backend

Edite `backend/.env`:

```env
GOOGLE_CLIENT_ID=123456789-xxxx.apps.googleusercontent.com
FRONTEND_URL=http://localhost:5500
```

Reinicie a API:

```powershell
cd backend
uvicorn app:app --reload
```

> **Importante:** o Client ID fica **somente no backend**. O frontend busca automaticamente em `GET /auth/config`.

## 4. Testar

1. Suba o frontend (Live Server, `npx serve`, etc.)
2. Abra `login.html`
3. Clique em **Continuar com Google**
4. Escolha sua conta Gmail
5. Você será redirecionado para cadastro de endereço ou cardápio

## 5. Deploy (Vercel + Render)

### Render (backend)

Variável de ambiente:

```
GOOGLE_CLIENT_ID=seu-id.apps.googleusercontent.com
FRONTEND_URL=https://seu-app.vercel.app
```

### Vercel (frontend)

Em `frontend/js/config.js`, aponte apenas a API:

```javascript
window.API_URL = "https://sua-api.onrender.com";
```

O Google Client ID **não precisa** ir no frontend — vem da API.

### Google Cloud (produção)

Adicione a URL da Vercel em **Origens JavaScript autorizadas**:

```
https://seu-app.vercel.app
```

## Solução de problemas

| Problema | Solução |
|----------|---------|
| Botão Google não aparece | Verifique se `GOOGLE_CLIENT_ID` está no `.env` e reinicie o uvicorn |
| `origin is not allowed` / 403 no botão Google | Adicione a **origem exata** da barra de endereço (ex: `http://127.0.0.1:5500`) em Origens JavaScript autorizadas. `localhost` e `127.0.0.1` são origens diferentes. |
| `403 access_denied` | Adicione seu e-mail em **Usuários de teste** no OAuth |
| `Token Google inválido` | Client ID do `.env` deve ser o mesmo das credenciais OAuth Web |

## Fluxo técnico

```
Frontend (login.html)
    → Google Identity Services (popup/conta)
    → recebe JWT (credential)
    → POST /auth/google { credential }
Backend
    → valida JWT com google-auth
    → cria/atualiza usuário no banco
    → retorna access_token JWT próprio
Frontend
    → salva token + usuário no localStorage
    → redireciona para cadastro ou pedido
```
