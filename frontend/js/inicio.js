const DESTAQUES_NOMES = [
    "Pastel de Queijo",
    "Pastel de Frango",
    "Pastel de Nutella",
    "Combo Familia",
];

function renderizarDestaques(lista) {
    const grid = document.getElementById("destaquesGrid");
    if (!grid) return;

    const destaques = DESTAQUES_NOMES.map((nome) => lista.find((p) => p.nome === nome)).filter(Boolean);

    if (!destaques.length) {
        grid.innerHTML = `<p class="home-empty">Cardapio em breve.</p>`;
        return;
    }

    grid.innerHTML = destaques
        .map((p, i) => {
            const img = imagemProduto(p);
            const tag = p.categoria === "Combos" ? "Combo imperdível" : "Mais pedido";
            return `
        <article class="destaque-card ${i === 0 ? "destaque-card--hero" : ""}" onclick="clicarProduto(${p.id})" role="button" tabindex="0">
            <div class="destaque-card-img produto-img-cartoon">
                <img src="${img}" alt="${p.nome}" loading="lazy">
                <span class="destaque-tag">${tag}</span>
            </div>
            <div class="destaque-card-body">
                <span class="produto-categoria">${p.categoria}</span>
                <h3>${p.nome}</h3>
                <p>${p.descricao}</p>
                <div class="destaque-card-footer">
                    <span class="produto-preco">${formatarPreco(p.preco)}</span>
                    <span class="destaque-link">Adicionar →</span>
                </div>
            </div>
        </article>`;
        })
        .join("");
}

async function carregarInicio() {
    try {
        let lista = await api.getProdutos();
        lista = lista.filter((p) => p.ativo !== false);
        produtos = aplicarImagensLocais(lista);
        renderizarDestaques(produtos);
    } catch (error) {
        const grid = document.getElementById("destaquesGrid");
        if (grid) {
            grid.innerHTML = `<p class="home-empty">Nao foi possivel carregar os destaques.</p>`;
        }
    }
}

if (document.getElementById("destaquesGrid")) {
    carregarInicio();
}
