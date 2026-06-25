const DESTAQUES_NOMES = [
    "Pastel de Queijo",
    "Pastel de Frango",
    "Pastel de Nutella",
    "Combo Familia",
];

const DESTAQUE_RANKS = ["#1 Favorito", "#2 Clássico", "Doce da casa", "Combo família"];

function renderizarDestaques(lista) {
    const container = document.getElementById("destaquesGrid");
    if (!container) return;

    const destaques = DESTAQUES_NOMES.map((nome) => lista.find((p) => p.nome === nome)).filter(Boolean);

    if (!destaques.length) {
        container.innerHTML = `<p class="home-empty home-empty--light">Cardápio em breve.</p>`;
        return;
    }

    const [principal, ...outros] = destaques;
    const imgPrincipal = imagemProduto(principal);

    const featureHtml = `
        <article class="destaque-feature" onclick="clicarProduto(${principal.id})" role="button" tabindex="0">
            <div class="destaque-feature-frame">
                <div class="destaque-feature-img produto-img-cartoon">
                    <img src="${imgPrincipal}" alt="${principal.nome}" loading="lazy">
                </div>
                <div class="destaque-feature-body">
                    <span class="destaque-rank">${DESTAQUE_RANKS[0]}</span>
                    <span class="produto-categoria produto-categoria--light">${principal.categoria}</span>
                    <h3>${principal.nome}</h3>
                    <p>${principal.descricao}</p>
                    <div class="destaque-feature-footer">
                        <span class="destaque-preco">${formatarPreco(principal.preco)}</span>
                        <span class="destaque-btn-add">+ Adicionar</span>
                    </div>
                </div>
            </div>
        </article>`;

    const gridHtml = outros
        .map((p, i) => {
            const img = imagemProduto(p);
            const rank = DESTAQUE_RANKS[i + 1] || "Destaque";
            const isCombo = p.categoria === "Combos";
            return `
        <article class="destaque-mini ${isCombo ? "destaque-mini--combo" : ""}" onclick="clicarProduto(${p.id})" role="button" tabindex="0">
            <div class="destaque-mini-glow"></div>
            <span class="destaque-mini-rank">${rank}</span>
            <div class="destaque-mini-img produto-img-cartoon">
                <img src="${img}" alt="${p.nome}" loading="lazy">
            </div>
            <div class="destaque-mini-body">
                <h4>${p.nome}</h4>
                <div class="destaque-mini-footer">
                    <span class="destaque-preco">${formatarPreco(p.preco)}</span>
                    <span class="destaque-mini-add">+</span>
                </div>
            </div>
        </article>`;
        })
        .join("");

    container.innerHTML = featureHtml + `<div class="destaques-minis">${gridHtml}</div>`;
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
            grid.innerHTML = `<p class="home-empty home-empty--light">Não foi possível carregar os destaques.</p>`;
        }
    }
}

if (document.getElementById("destaquesGrid")) {
    carregarInicio();
}
