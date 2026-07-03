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

## Produção — QR Code Pix verdadeiro

Com `MERCADOPAGO_SANDBOX=false`, o site chama a API do Mercado Pago e exibe o **QR real** (imagem base64 do MP + copia-e-cola que funciona no app do banco).

### Pré-requisitos no Mercado Pago

1. Conta Mercado Pago **verificada** (CPF/CNPJ)
2. **Chave Pix cadastrada** na conta ([Suas chaves Pix](https://www.mercadopago.com.br/pix-keys/app/key-management))
3. Aplicação criada em [Suas integrações](https://www.mercadopago.com.br/developers/panel/app)

### Passo a passo no Render

1. Painel MP → sua app → **Credenciais de produção** → copie o **Access Token**
2. No Render, configure:

```env
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...   # token de PRODUÇÃO
MERCADOPAGO_SANDBOX=false
FRONTEND_URL=https://pastelaria-mu.vercel.app
API_PUBLIC_URL=https://pastelaria-geu7.onrender.com
```

3. Salve e aguarde o redeploy
4. Faça um pedido no site → **Pix online**
5. O QR **não** terá faixa “Modo teste” — é cobrança real
6. Pague pelo app do banco → o pedido confirma sozinho (webhook + polling)

### Webhook (recomendado)

No painel MP → sua app → **Webhooks**:

- URL: `https://pastelaria-geu7.onrender.com/pagamentos/webhook`
- Evento: **Pagamentos**

Sem webhook, o site ainda tenta confirmar a cada 5 segundos na tela do Pix.

### Como saber se está no modo certo

| Sinal | Simulador (teste) | Pix real |
|-------|-------------------|----------|
| Banner amarelo “Modo teste” | Sim | Não |
| Botão “Simular pagamento” | Sim | Não |
| Texto “Aguardando confirmação do Pix…” | Não | Sim |
| Dinheiro na conta MP | Não | Sim |

### Erro ao gerar Pix em produção

| Erro | Solução |
|------|---------|
| Erro na tela | Solução |
|--------------|---------|
| **Unauthorized use of live credentials** | Token de **teste** com `SANDBOX=false`. Use token de **produção** ou volte `SANDBOX=true` |
| 502 ao clicar “Gerar Pix” | Token inválido, CPF faltando ou conta sem chave Pix |
| QR vazio | Conta sem chave Pix cadastrada no MP |
| Pagou e não confirmou | Confira webhook e `API_PUBLIC_URL` no Render |

Em **produção**, o site pede o **CPF do pagador** — exigência da API Pix do Mercado Pago.

> **Atenção:** em produção cada pedido gera cobrança real. Use valor baixo no primeiro teste (ex.: R$ 0,50) e depois remova os produtos “Teste MP” do cardápio.

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
