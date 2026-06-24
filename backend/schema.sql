-- Schema PostgreSQL - Pastelaria Delivery
-- Execute no pgAdmin ou via psql

CREATE DATABASE pastelaria;

\c pastelaria;

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
    data_pedido TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gavetas_diarias (
    id SERIAL PRIMARY KEY,
    data_referencia DATE NOT NULL,
    fechado_em TIMESTAMPTZ DEFAULT NOW(),
    qtd_pedidos INTEGER DEFAULT 0,
    total_vendas DOUBLE PRECISION DEFAULT 0,
    pedidos_snapshot JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS itens_pedido (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    produto_id INTEGER NOT NULL REFERENCES produtos(id),
    quantidade INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_pedidos_status ON pedidos(status);
CREATE INDEX idx_pedidos_arquivado ON pedidos(arquivado);
CREATE INDEX idx_pedidos_data ON pedidos(data_pedido DESC);
CREATE INDEX idx_gavetas_data ON gavetas_diarias(data_referencia DESC);
CREATE INDEX idx_enderecos_usuario ON enderecos(usuario_id);

-- Produtos iniciais
INSERT INTO produtos (nome, descricao, preco, imagem, categoria) VALUES
('Pastel de Queijo', 'Massa crocante recheada com queijo derretido', 8.00, 'https://images.unsplash.com/photo-1626087927383-36f2a4a8a84e?w=400&h=300&fit=crop', 'Salgados'),
('Pastel de Carne', 'Recheio de carne moída temperada', 9.00, 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop', 'Salgados'),
('Pastel de Frango', 'Frango desfiado com catupiry', 9.50, 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=400&h=300&fit=crop', 'Salgados'),
('Pastel de Nutella', 'Doce com Nutella', 12.00, 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop', 'Doces'),
('Coca-Cola Lata', 'Refrigerante 350ml', 6.00, 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=400&h=300&fit=crop', 'Bebidas');
