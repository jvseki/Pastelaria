-- Cole no Supabase: SQL Editor → New query → Run
-- Projeto: pastelaria-delivery

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
    numero_dia INTEGER,
    data_pedido TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS itens_pedido (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    produto_id INTEGER NOT NULL REFERENCES produtos(id),
    quantidade INTEGER NOT NULL DEFAULT 1
);

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
CREATE INDEX IF NOT EXISTS idx_enderecos_usuario ON enderecos(usuario_id);

-- Produtos sao criados automaticamente pela API ao subir (app.py)
