# Mercado Pago — guia passo a passo

Integração **Checkout Pro** na Pastelaria Delivery: o cliente paga online (Pix ou cartão) e é redirecionado de volta ao site.

## Produtos de teste no cardápio

| Produto | Preço | Categoria |
|---------|-------|-----------|
| Teste MP 1 centavo | R$ 0,01 | Teste MP |
| Teste MP 50 centavos | R$ 0,50 | Teste MP |

Use esses itens para testar pagamentos com valores baixos.

---

## Passo 1 — Credenciais no painel

1. Acesse [Suas integrações](https://www.mercadopago.com.br/developers/panel/app)
2. Abra a aplicação **Checkout Pro**
3. Vá em **Credenciais de teste** (recomendado para começar)
4. Copie:
   - **Public Key** → chave curta (frontend)
   - **Access Token** → chave longa (**segredo**, só no backend)

> **Nunca** cole o Access Token no chat, no GitHub ou no `config.js` do frontend.

---

## Passo 2 — Configurar o backend local

```powershell
cd backend
Copy-Item .env.example .env
```

Edite `backend/.env` e adicione:

```env
MERCADOPAGO_ACCESS_TOKEN=APP_USR-seu-access-token-aqui
MERCADOPAGO_PUBLIC_KEY=APP_USR-sua-public-key-aqui
MERCADOPAGO_SANDBOX=true
FRONTEND_URL=http://localhost:5500
API_PUBLIC_URL=http://localhost:8000
```

| Variável | O que é |
|----------|---------|
| `MERCADOPAGO_ACCESS_TOKEN` | Token longo — **só no backend** |
| `MERCADOPAGO_PUBLIC_KEY` | Chave pública (reservada para uso futuro no frontend) |
| `MERCADOPAGO_SANDBOX` | `true` = usa ambiente de teste do MP |
| `FRONTEND_URL` | URL do site (para voltar após pagar) |
| `API_PUBLIC_URL` | URL pública da API (webhooks em produção) |

---

## Passo 3 — Rodar API e frontend

**Terminal 1 — API:**

```powershell
cd backend
pip install -r requirements.txt
uvicorn app:app --reload
```

API em `http://localhost:8000`

**Terminal 2 — Site:**

```powershell
cd frontend
npx serve .
```

Abra a URL que aparecer (ex.: `http://localhost:3000` ou `http://localhost:5500`).

Se usar porta diferente de 5500, ajuste `FRONTEND_URL` no `.env` e reinicie a API.

---

## Passo 4 — Testar o fluxo

1. Faça login com Google
2. Cadastre endereço (ou escolha retirada)
3. No cardápio, filtre **Teste MP**
4. Adicione **Teste MP 1 centavo** ou **50 centavos** ao carrinho
5. Vá ao carrinho → continuar → pagamento
6. Selecione **Mercado Pago**
7. Marque a confirmação → **Ir para o Mercado Pago**
8. Na página do MP (sandbox), use **cartão de teste**:

| Campo | Valor |
|-------|-------|
| Número | `5031 4332 1540 6351` (Mastercard) |
| CVV | `123` |
| Validade | `11/30` |
| Nome | `APRO` (aprovado) |

Documentação: [testar compras](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/integration-test/test-purchases)

9. Após pagar, você volta para `pedido.html` com confirmação

---

## Passo 5 — Produção (Render + Vercel)

No **Render** (variáveis da API), adicione:

```env
MERCADOPAGO_ACCESS_TOKEN=...
MERCADOPAGO_PUBLIC_KEY=...
MERCADOPAGO_SANDBOX=false
FRONTEND_URL=https://pastelaria-mu.vercel.app
API_PUBLIC_URL=https://pastelaria-geu7.onrender.com
```

Use credenciais de **produção** só quando for receber dinheiro real.

---

## Como funciona no código

```
Cliente → Pagamento → POST /pagamentos/checkout
         → Cria pedido (status: aguardando_pagamento)
         → Cria preferência no MP
         → Redireciona para checkout_url

MP aprova → Webhook POST /pagamentos/webhook
         → pedido.status = pendente
         → pagamento_confirmado = true
         → Admin vê o pedido
```

Pagamento na entrega (Pix/Dinheiro/Cartão) continua funcionando como antes.

---

## Problemas comuns

| Problema | Solução |
|----------|---------|
| Opção Mercado Pago não aparece | Confira `MERCADOPAGO_ACCESS_TOKEN` no `.env` e reinicie a API |
| Erro 502 ao pagar | Token inválido ou credencial de produção em sandbox (ou vice-versa) |
| Webhook não chega localmente | Normal em localhost; use retorno `back_urls` ou deploy na Render |
| Valor R$ 0,01 rejeitado | Teste com R$ 0,50 ou use sandbox com cartão `APRO` |

---

## Segurança

- Regenerar Access Token se ele foi exposto
- Não commitar `.env`
- `MERCADOPAGO_SANDBOX=true` enquanto estiver testando
