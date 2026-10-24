# Diagnóstico e execução gradual

## Base aproveitada

FastAPI, SQLAlchemy/PostgreSQL (SQLite local), HTML/CSS/JavaScript sem framework. Já existem catálogo público, carrinho persistente, montagem de Combo Família, autenticação Google, endereços, retirada/entrega, pedidos por usuário, painel com atualização a cada 15 segundos, gavetas diárias e integração Pix com simulador.

O catálogo vinha de banco, porém o startup restaurava os dados fixos sobre os produtos existentes. O frontend ignorava `produto.imagem` e escolhia a imagem pelo nome. O painel administra pedidos, mas não possui CRUD de produtos/categorias, uploads, configurações de loja ou relatório financeiro por período. O fechamento diário existente não equivale a um financeiro validado.

Pedidos não armazenam preço unitário e endereço como snapshots: alterações posteriores afetam o histórico. Combos têm opções fixas no frontend. O fluxo ainda exige login Google. As migrações são DDL condicionais no startup; faltam versionamento formal e ensaios de migração PostgreSQL. Os riscos de segurança e as correções estão em [SECURITY.md](SECURITY.md).

## Primeira etapa implementada

- Nova home e catálogo, busca tolerante a acentos, filtros vindos dos produtos, cards compartilhados, área de raspadinhas, estados de carregamento/erro/vazio e nova tentativa.
- Identidade vermelho, carvão, creme e dourado, com verde nas raspadinhas. `nakachi.css` é uma camada separada para preservar alterações locais em `style.css` e nos SVGs.
- Navegação por teclado, zoom liberado, foco contido no modal de produto, Escape para fechar, foco devolvido ao acionador e preferência de movimento reduzido.
- Nome da marca nas páginas, sacola no cabeçalho e rodapé com contato, endereço e horários obtidos de `/loja`; dados desconhecidos ficam claramente indicados.
- Imagens cadastradas no banco têm prioridade, URLs inválidas são recusadas e imagens ausentes têm fallback.
- Carga demonstrativa explícita, autorizada somente com `DEMO_MODE=true` e catálogo vazio. Não roda no startup e não sobrescreve cadastros existentes. Produtos de teste de pagamento não são inseridos nessa carga.
- Correções de segurança priorizadas após o pedido adicional do usuário, com testes isolados.

## Referências visuais

As três imagens foram observadas na conversa, mas os arquivos de imagem não estavam disponíveis no diretório de anexos. Não foi criada uma imitação do logotipo. O cabeçalho usa provisoriamente o nome tipográfico, e as imagens existentes do projeto são ilustrativas. Para usar os originais sem redesenhar, copie-os para `frontend/images/marca/` e configure `LOJA_LOGO`, `LOJA_BANNER` e `LOJA_BANNER_RASPADINHAS` no backend. Os caminhos são relativos à página, por exemplo `images/marca/logo.png`. Não renomeie uma imagem para uma extensão diferente da real.

## Próximas etapas

1. **Administração e catálogo:** migrações versionadas, categorias ordenáveis, CRUD de produtos, upload com validação, adicionais e combos configuráveis. Manter desativação para itens referenciados por pedidos.
2. **Operação da loja:** configurações persistidas e editáveis no painel; abertura/fechamento validado também no pedido, horários, preparo, modalidades e pagamentos. O indicador aberto/fechado ainda não foi colocado, pois não há uma regra operacional confiável no sistema.
3. **Pedidos e pagamentos:** snapshots monetários/endereço, validação de combinações no servidor, checkout visitante com acompanhamento protegido, revisão do webhook e transições de estado. Taxa fixa e validação de quantidade/disponibilidade já foram corrigidas nesta entrega.
4. **Qualidade e operação:** teste PostgreSQL e integrações em ambiente de homologação; financeiro por período com cancelados/concluídos separados; endurecimento de sessão, rate limiting e política de conteúdo.

Nenhum banco existente foi apagado, nenhum produto real foi alterado e nenhum deploy foi executado. A primeira etapa não representa conclusão de todas as funcionalidades propostas no briefing.
