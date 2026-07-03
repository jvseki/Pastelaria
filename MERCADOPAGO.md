# Pix online — guia

Pagamento **Pix** integrado na Pastelaria Delivery.

## Modos

| `MERCADOPAGO_SANDBOX` | Comportamento |
|----------------------|---------------|
| `true` (padrão) | **Simulador Pix** no próprio site — sem redirect, sem cartão, sem conta MP |
| `false` | Pix **real** via API do Mercado Pago (produção) |

## Testar agora (sandbox)

1. Janela anônima → login Google no site
2. Cardápio → **Teste MP** → **Teste MP 50 centavos**
3. Pagamento → **Pix online** → **Gerar Pix e pagar**
4. Na tela do QR Code → **Simular pagamento aprovado**
5. Pedido confirmado na fila da pastelaria

Não precisa de credenciais do Mercado Pago em sandbox.

## Produção (dinheiro real)

No [painel Mercado Pago](https://www.mercadopago.com.br/developers/panel/app):

1. Copie o **Access Token** de **Credenciais de produção**
2. No Render:

```env
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
MERCADOPAGO_SANDBOX=false
FRONTEND_URL=https://pastelaria-mu.vercel.app
API_PUBLIC_URL=https://pastelaria-geu7.onrender.com
```

3. Cliente vê QR Code Pix real e paga no app do banco
4. Webhook `/pagamentos/webhook` confirma automaticamente

## Endpoints da API

| Rota | Função |
|------|--------|
| `GET /pagamentos/config` | Se Pix online está habilitado |
| `POST /pagamentos/checkout` | Cria pedido + dados do Pix |
| `POST /pagamentos/simular/{id}` | Sandbox: confirma pagamento fictício |
| `POST /pagamentos/confirmar/{id}` | Produção: consulta status no MP |
| `POST /pagamentos/webhook` | Produção: notificação do MP |

## Formas de pagamento no site

| Opção | Quando |
|-------|--------|
| **Pix online** | Paga agora (simulado ou real) |
| Pix / Dinheiro ao receber | Presencial na entrega |
| Cartão ao receber | Presencial na entrega |

## Segurança

- Access Token só no backend (Render)
- Não commitar `.env`
- Regenerar token se exposto
