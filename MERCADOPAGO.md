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

| Erro na tela | Solução |
|--------------|---------|
| **Unauthorized use of live credentials** | Token de **teste** com `SANDBOX=false`. Use token de **produção** ou volte `SANDBOX=true` |
| 502 ao clicar “Gerar Pix” | Token inválido, CPF faltando ou conta sem chave Pix |
| QR vazio | Conta sem chave Pix cadastrada no MP |
| Pagou e não confirmou | Confira webhook e `API_PUBLIC_URL` no Render |

Em **produção**, o site pede o **CPF do pagador** (com máscara automática `000.000.000-00`).

## Checklist — evitar problemas com o Mercado Pago

### No Render (obrigatório em produção)

- [ ] `MERCADOPAGO_ACCESS_TOKEN` = token de **Credenciais de produção**
- [ ] `MERCADOPAGO_SANDBOX=false` só quando for receber dinheiro real
- [ ] `API_PUBLIC_URL=https://pastelaria-geu7.onrender.com` (sem barra no final)
- [ ] `FRONTEND_URL=https://pastelaria-mu.vercel.app`

### No painel Mercado Pago

- [ ] Conta verificada (CPF/CNPJ)
- [ ] Chave Pix cadastrada (aleatória, e-mail ou telefone)
- [ ] Webhook: `https://pastelaria-geu7.onrender.com/pagamentos/webhook` → evento **Pagamentos**
- [ ] Regenerar Access Token se ele foi exposto em print/chat

### No site (já implementado)

- CPF com máscara automática na tela de pagamento
- Botão **Copiar código Pix** (funciona no celular)
- QR Code do MP em produção; simulador em sandbox
- Confirmação automática após pagamento (webhook + verificação a cada 5 s)

### Boas práticas

- Teste primeiro com `SANDBOX=true` (simulador, sem dinheiro)
- Em produção, teste com valor baixo (R$ 0,50) uma vez
- Depois desative os produtos **Teste MP** no admin
- Não misture token de teste com `SANDBOX=false`
- Não commite `.env` nem cole token no GitHub

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

## Devolução do dinheiro (pedido recusado)

Se o cliente **já pagou via Pix online** e você **recusar o pedido** no painel admin:

1. Clique em **Recusar pedido** no pedido com status *Aguardando aceite*
2. O sistema chama a API do Mercado Pago e faz o **estorno automático**
3. O pedido vai para status **Cancelado**
4. O valor volta para a conta do cliente (prazo depende do banco, geralmente minutos a 1 dia útil)

> Estorno automático só em **produção** (`SANDBOX=false`) com Pix real pago. No simulador de teste não há dinheiro real.

### Pedido sem pagamento finalizado

Se o cliente **não pagou** (status *Pagamento pendente*), não há o que estornar — o pedido expira sozinho. O cliente pode retomar em **Meus pedidos** → **Finalizar pagamento Pix**, ou **Desistir deste pedido** para limpar a lista (vários de uma vez: **Remover todos não pagos**).
