# Pastéis Nakachi

Sistema de delivery em evolução, preservando FastAPI, SQLAlchemy, HTML, CSS e JavaScript do projeto original. A primeira reformulação cobre identidade, catálogo e correções prioritárias de segurança; gestão completa do catálogo e checkout visitante ainda estão planejados.

**Segurança:** havia um token administrativo público. A API atual não o aceita mais. Leia [SECURITY.md](SECURITY.md) antes de atualizar uma instalação existente: a credencial antiga precisa ser revogada na hospedagem. Nenhum deploy foi feito automaticamente.

## Desenvolvimento local (PowerShell, Python 3.12)

Na raiz do repositório:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
Copy-Item backend/.env.example backend/.env
cd backend
python -m uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

Copie o exemplo somente se ainda não tiver um `.env`; preserve configurações existentes. O exemplo do backend utiliza SQLite local. O `.env` é lido no diretório de execução. Em produção, use as variáveis privadas do serviço.

Em outro terminal, na raiz:

```powershell
.\.venv\Scripts\python.exe -m http.server 5500 --bind 127.0.0.1 --directory frontend
```

Abra http://localhost:5500. API: http://localhost:8000/docs. Não abra o HTML diretamente via `file://`.

## Demonstração sem alterar dados reais

Use um banco exclusivo para demonstração. Em `backend/.env`, defina `DEMO_MODE=true` e, se desejar o simulador de Pix, `MERCADOPAGO_SANDBOX=true`. Depois, no diretório `backend`:

```powershell
python seed_demo.py
```

A carga inclui os produtos tradicionais já usados no projeto, doces, bebidas, Combo Família e três raspadinhas. Os preços são exemplos e um aviso aparece no site. Se existir qualquer produto, o comando recusa a carga sem alterar dados. Reiniciar a API nunca repõe ou sobrescreve produtos. Não ative demonstração em uma instalação real.

## Conta administrativa e configurações

- `GOOGLE_CLIENT_ID`: identificador OAuth da instalação. Cadastre a origem local/produtiva no Google. Sem configuração, o cardápio funciona e o login permanece indisponível.
- `ADMIN_EMAIL`: e-mail Google autorizado pelo backend. O usuário entra normalmente com Google. Nenhum token administrativo é inserido em JavaScript. Sem essa configuração, o painel fica bloqueado.
- `SECRET_KEY`: chave JWT aleatória, privada e persistente, de pelo menos 32 caracteres. Gere com `python -c "import secrets; print(secrets.token_urlsafe(48))"` e salve somente nas variáveis privadas. Sem configuração, apenas em desenvolvimento, a chave temporária muda ao reiniciar e invalida sessões.
- `APP_ENV=production`: exige chave configurada, frontend HTTPS e simulador/demonstração desligados. As sessões novas expiram em 12 horas por padrão.
- `LOJA_NOME`, `LOJA_CONTATO`, `LOJA_ENDERECO`, `LOJA_HORARIOS`: dados públicos do rodapé. Não preenchemos informações oficiais desconhecidas.
- `LOJA_LOGO`, `LOJA_BANNER`, `LOJA_BANNER_RASPADINHAS`: caminhos públicos das imagens originais, por exemplo `images/marca/logo.png`. Os anexos visuais ainda precisam ser copiados para essa pasta; o nome tipográfico e as ilustrações atuais são provisórios.
- `TAXA_ENTREGA`: taxa fixa em reais, calculada no servidor. Padrão de desenvolvimento: 5. Retirada tem taxa zero. Configure o valor real antes de operar.
- `MOTOBOY_WHATSAPP`: número do destinatário configurado no servidor, apenas se utilizar envio manual pelo painel.

As informações públicas usam `GET /loja`. A edição dessas configurações pelo painel está prevista para a próxima etapa. Não há ainda abertura/fechamento operacional automático.

## O que mudou e como testar

| Área | Arquivos principais | Verificação |
| --- | --- | --- |
| Identidade e catálogo | `frontend/index.html`, `cardapio.html`, `css/nakachi.css`, `js/inicio.js`, `js/cardapio.js` | Abra em celular/desktop, busque um sabor, filtre categorias, adicione quantidade e revise a sacola. |
| Marca e imagens | `frontend/js/loja.js`, `js/produto-imagens.js`, `backend/routes/loja.py` | Configure dados e imagens, reinicie a API e confira o rodapé, banner e logo. |
| Dados demonstrativos | `backend/seed_demo.py`, `backend/app.py` | Em banco vazio, execute a carga; execute novamente e confira a recusa. Alterações não são sobrescritas ao reiniciar. |
| Autorização | `backend/routes/admin.py`, `auth.py`, `frontend/js/auth.js`, `api.js` | Cliente comum recebe 403; conta de `ADMIN_EMAIL` acessa o painel. Token estático antigo recebe 401. |
| Pedidos | `backend/routes/pedidos.py`, `services/pedido_service.py` | Quantidade negativa e produto inativo são recusados; envio de taxa zero não altera a taxa do servidor. Pix manual continua não pago. |
| Prevenção | `.gitignore`, `backend/.dockerignore`, `.github/`, `scripts/check_secrets.py` | Execute os comandos abaixo. |

Testes isolados, sem credenciais e sem banco real:

```powershell
cd backend
python -m unittest discover -s tests -v
cd ..
python scripts/check_secrets.py
python scripts/check_secrets.py --history
```

O último comando deve encontrar o token antigo no histórico até uma limpeza coordenada; só imprime arquivo, posição e tipo de achado. Não faça force-push apenas para silenciar o resultado. Revogue a credencial primeiro.

Teste também teclado (Tab, Enter e Escape), zoom, erro ao desligar a API e listas vazias em banco sem produtos. Login Google e pagamentos reais precisam de homologação própria.

## Hospedagem e evolução

### Movimento 3D na rolagem

A home e o cardápio têm uma vitrine em camadas, perspectiva ligada ao scroll, entrada suave dos cards e movimento das imagens. No desktop, as imagens também reagem ao mouse. No celular, a rolagem nativa controla os efeitos sem bloquear os gestos de toque.

Implementação em `frontend/css/motion.css` e `frontend/js/motion.js`, carregada apenas em `index.html` e `cardapio.html`. Usa CSS 3D e JavaScript, sem novas dependências. Não são modelos 3D nem vídeos renderizados com Remotion: são as imagens existentes organizadas em planos com profundidade.

O botão **Pausar efeitos** salva a preferência localmente. A opção de movimento reduzido do sistema desativa as animações automaticamente. As atualizações usam `requestAnimationFrame` apenas quando há rolagem, mouse ou mudança de conteúdo; não há um loop de animação permanente. Cards novos após busca/filtros são observados automaticamente.

Para testar, abra a home e o cardápio no servidor local, role para cima e para baixo, pause os efeitos e navegue entre páginas. Confira também a preferência de movimento reduzido do sistema. Foram verificados tamanhos de 320, 390 e 1440 pixels, pausa persistente, mudança de preferência, filtros e adição à sacola em navegador automatizado com API simulada. Desempenho em celulares físicos ainda precisa ser avaliado.

O Docker Compose existente continua disponível. O Nginx encaminha `/loja` para a API e bloqueia arquivos ocultos. A imagem Docker exclui `.env`, bancos e chaves. Configure HTTPS no proxy público. Em hospedagem separada, ajuste a URL pública da sua API em `frontend/js/config.js`; não é mais usado automaticamente o backend da template.

Consulte [DIAGNOSTICO_NAKACHI.md](DIAGNOSTICO_NAKACHI.md) para o diagnóstico, decisões, limites e próximas etapas; [SECURITY.md](SECURITY.md) para revogação e pendências. Os guias antigos de deploy são referências de infraestrutura: as regras de autenticação e ambiente deste README prevalecem.
