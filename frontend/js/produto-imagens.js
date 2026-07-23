const IMAGENS_PRODUTOS = {
    "Pastel de Queijo": "images/produtos/pastel-queijo.svg",
    "Pastel de Carne": "images/produtos/pastel-carne.svg",
    "Pastel de Frango": "images/produtos/pastel-frango.svg",
    "Pastel de Palmito": "images/produtos/pastel-palmito.svg",
    "Pastel de Nutella": "images/produtos/pastel-nutella.svg",
    "Pastel de Doce de Leite": "images/produtos/pastel-doce-leite.svg",
    "Coca-Cola Lata": "images/produtos/coca-cola.svg",
    "Agua Mineral": "images/produtos/agua.svg",
    "Suco Natural": "images/produtos/suco.svg",
    "Caldo de Cana": "images/produtos/caldo-cana.svg",
    "Combo Familia": "images/produtos/combo.svg",
    "Combo Família": "images/produtos/combo.svg",
    "Teste MP 1 real": "images/produtos/padrao.svg",
};

function imagemProduto(produto) {
    if (!produto) return "images/produtos/padrao.svg";
    return IMAGENS_PRODUTOS[produto.nome] || "images/produtos/padrao.svg";
}

function aplicarImagensLocais(lista) {
    return lista.map((p) => ({ ...p, imagem: imagemProduto(p) }));
}
