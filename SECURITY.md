# Segurança da Pastéis Nakachi

## Correção local de 24/10/2026

O repositório continha um **token administrativo fixo no JavaScript público e em `.env.vknp.example`**. Considere esse token comprometido. A varredura local encontrou esse padrão em oito objetos de arquivo do histórico; isso não significa oito credenciais diferentes. Não houve investigação dos logs da hospedagem e não é possível afirmar se houve uso indevido.

O backend atualizado **não aceita mais ADMIN_TOKEN**. Todas as rotas administrativas exigem um JWT válido da sessão Google e conferem o e-mail do usuário no banco contra `ADMIN_EMAIL`, configurado exclusivamente no servidor. Alterar `is_admin` no navegador não concede permissão na API. Configure `ADMIN_EMAIL` antes de testar o painel; sem ele ninguém recebe acesso administrativo.

Também foram corrigidos: chave JWT padrão conhecida, redirecionamento livre após login, renderização de dados de clientes como HTML no painel, taxa de entrega confiada ao navegador, quantidades inválidas e compra de produto inativo. O modo de produção rejeita demonstração/Pix simulado e exige chave JWT configurada e frontend HTTPS. CORS permite somente a origem configurada em produção.

## Ações necessárias na hospedagem (não executadas)

1. **Se o backend antigo continua online, revogue/troque imediatamente o ADMIN_TOKEN nele.** A remoção local não protege uma versão já publicada. Até atualizar a API, desabilite o acesso administrativo antigo se necessário.
2. Gere uma `SECRET_KEY` aleatória e persistente, com pelo menos 32 caracteres. A rotação invalida as sessões existentes; os usuários precisarão entrar novamente. Não reutilize valores de exemplos ou do histórico.
3. Configure `ADMIN_EMAIL`, `GOOGLE_CLIENT_ID`, `APP_ENV=production`, `DEMO_MODE=false`, `MERCADOPAGO_SANDBOX=false` e `FRONTEND_URL=https://SEU_DOMINIO`. Use as variáveis privadas da hospedagem, nunca JavaScript público.
4. Aplique frontend e backend juntos somente após revisar/testar a mudança. Valide que um cliente comum recebe 403 em `/admin/pedidos` e um token antigo recebe 401. Verifique logs e pedidos para procurar ações administrativas inesperadas.
5. No GitHub, habilite secret scanning e push protection quando disponíveis. Ative proteção da branch principal e revisão de pull requests. Estas configurações não foram alteradas por esta sessão.

O histórico continua contendo os valores antigos. Apagar um arquivo ou tornar o repositório privado não revoga credenciais nem apaga cópias existentes. Depois da revogação, uma limpeza coordenada com `git-filter-repo` pode reduzir a exposição histórica; não foi executado force-push nem reescrita de histórico, pois afetam clones e colaboradores.

## Prevenção

- `.gitignore` exclui ambientes, bancos locais e formatos usuais de chaves. `.dockerignore` também os exclui do contexto do backend. Arquivos já rastreados não são removidos automaticamente por essas regras.
- `python scripts/check_secrets.py` verifica arquivos rastreados sem imprimir valores. `--history` verifica objetos Git locais. É uma verificação de padrões conhecidos, **não uma garantia de ausência de outros segredos**; não consulta branches remotas que não estejam no clone.
- O workflow `security.yml` executa a verificação e testes de autorização/pedidos em pushes e pull requests, sem segredos de produção. Dependabot propõe atualizações de dependências; revise e teste os PRs.
- Endereço, horário e contato da loja permanecem vazios até configuração explícita. O identificador público OAuth não é uma chave privada; mesmo assim, o exemplo agora não aponta para a conta de outra instalação.

## Limites e trabalho pendente

Esta entrega reduz riscos concretos; não é uma auditoria completa nem certifica a aplicação para produção. Ainda precisam de revisão: assinatura e limites de requisição do webhook Mercado Pago, idempotência das atualizações de pagamento, conferência do valor/moeda recebido, snapshots de preço/endereço nos pedidos, limitação de requisições no login/checkout e políticas CSP compatíveis com os scripts atuais. Não foram testados OAuth real, pagamentos reais, HTTPS da hospedagem ou vulnerabilidades transitivas das dependências.

A sessão ainda usa JWT acessível ao JavaScript, herdado da aplicação. Uma migração planejada para cookies HttpOnly com proteção CSRF e revogação de sessões é recomendada antes de ampliar o uso administrativo. Foram escapados os campos dinâmicos identificados nesta revisão; ainda é necessária revisão completa dos demais usos de `innerHTML`.

Não publique tokens, dados de clientes ou detalhes exploráveis de vulnerabilidades em issues públicas. Use o canal privado de reporte de vulnerabilidades do GitHub, se habilitado.
