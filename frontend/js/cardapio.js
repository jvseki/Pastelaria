let categoriaAtiva = "Todos";
let produtos = [];
let produtoModalAtual = null;
let modalModo = "preview";

function getCarrinho() {
    return JSON.parse(localStorage.getItem("carrinho") || "[]");
}

function salvarCarrinho(carrinho) {
    localStorage.setItem("carrinho", JSON.stringify(carrinho));
    atualizarBadgeCarrinho();
}

function quantidadeNoCarrinho(produtoId) {
    const item = getCarrinho().find((i) => i.id === produtoId);
    return item ? item.quantidade : 0;
}

function adicionarAoCarrinho(produtoId, mostrarToastMsg = true) {
    const produto = produtos.find((p) => p.id === produtoId);
    if (!produto) return;

    const carrinho = getCarrinho();
    const existente = carrinho.find((item) => item.id === produto.id);
    const img = imagemProduto(produto);

    if (existente) {
        existente.quantidade++;
    } else {
        carrinho.push({
            id: produto.id,
            nome: produto.nome,
            preco: produto.preco,
            imagem: img,
            quantidade: 1,
        });
    }

    salvarCarrinho(carrinho);

    if (mostrarToastMsg) {
        mostrarToast(`${produto.nome} adicionado!`);
    }

    return produto;
}

function clicarProduto(produtoId) {
    const produto = produtos.find((p) => p.id === produtoId);
    if (!produto) return;
    abrirModalItem(produto, "preview");
}

function preencherDadosModal(produto) {
    const img = imagemProduto(produto);
    const qty = quantidadeNoCarrinho(produto.id);

    document.getElementById("modalItemImg").src = img;
    document.getElementById("modalItemImg").alt = produto.nome;
    document.getElementById("modalItemNome").textContent = produto.nome;
    document.getElementById("modalItemPreco").textContent = formatarPreco(produto.preco);
    document.getElementById("modalItemQty").textContent =
        qty > 0 ? `${qty} no carrinho` : "Ainda nao esta no carrinho";
}

function atualizarModoModal(modo) {
    modalModo = modo;
    const preview = document.getElementById("modalItemPreview");
    const posAdd = document.getElementById("modalItemPosAdd");
    const headerKanji = document.getElementById("modalItemKanji");
    const headerTitulo = document.getElementById("modalItemTitulo");

    if (modo === "preview") {
        preview.style.display = "block";
        posAdd.style.display = "none";
        headerKanji.textContent = "商品";
        headerTitulo.textContent = "Adicionar ao carrinho?";
    } else {
        preview.style.display = "none";
        posAdd.style.display = "block";
        headerKanji.textContent = "追加しました";
        headerTitulo.textContent = "Adicionado ao carrinho!";
    }
}

function abrirModalItem(produto, modo = "preview") {
    produtoModalAtual = produto;
    preencherDadosModal(produto);
    atualizarModoModal(modo);

    document.getElementById("modalItem").classList.add("open");
    document.body.style.overflow = "hidden";
}

function fecharModalItem() {
    document.getElementById("modalItem").classList.remove("open");
    document.body.style.overflow = "";
    produtoModalAtual = null;
    modalModo = "preview";
}

function confirmarAdicionarItem() {
    if (!produtoModalAtual) return;
    adicionarAoCarrinho(produtoModalAtual.id, true);
    preencherDadosModal(produtoModalAtual);
    atualizarModoModal("posAdd");
}

function adicionarMaisItem() {
    if (!produtoModalAtual) return;
    adicionarAoCarrinho(produtoModalAtual.id, false);
    preencherDadosModal(produtoModalAtual);
    mostrarToast(`Mais um ${produtoModalAtual.nome}!`);
}

function finalizarPedidoDoModal() {
    fecharModalItem();
    sessionStorage.setItem("verificarBebidas", "1");
    window.location.href = "carrinho.html";
}

function renderizarCategorias(produtosLista) {
    const categorias = ["Todos", ...new Set(produtosLista.map((p) => p.categoria))];
    const container = document.getElementById("categorias");

    container.innerHTML = categorias
        .map(
            (cat) =>
                `<button class="categoria-btn ${cat === categoriaAtiva ? "active" : ""}" 
                    onclick="filtrarCategoria('${cat}')">${cat}</button>`
        )
        .join("");
}

function filtrarCategoria(categoria) {
    categoriaAtiva = categoria;
    renderizarCategorias(produtos);
    renderizarProdutos();
}

function renderizarProdutos() {
    const grid = document.getElementById("produtosGrid");
    const filtrados =
        categoriaAtiva === "Todos"
            ? produtos
            : produtos.filter((p) => p.categoria === categoriaAtiva);

    if (filtrados.length === 0) {
        grid.innerHTML = `<div class="carrinho-vazio"><div class="empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div><h2>Nenhum produto encontrado</h2></div>`;
        return;
    }

    grid.innerHTML = filtrados
        .map((p) => {
            const img = imagemProduto(p);
            return `
        <article class="produto-card" onclick="clicarProduto(${p.id})" role="button" tabindex="0">
            <div class="produto-img-wrap produto-img-cartoon">
                <img class="produto-img" src="${img}" alt="${p.nome}" loading="lazy">
            </div>
            <div class="produto-info">
                <span class="produto-categoria">${p.categoria}</span>
                <h2 class="produto-nome">${p.nome}</h2>
                <p class="produto-desc">${p.descricao}</p>
                <div class="produto-footer">
                    <span class="produto-preco">${formatarPreco(p.preco)}</span>
                    <button class="btn btn-primary btn-add" onclick="event.stopPropagation(); clicarProduto(${p.id})">
                        Ver produto
                    </button>
                </div>
            </div>
        </article>`;
        })
        .join("");
}

async function carregarCardapio() {
    try {
        produtos = await api.getProdutos();
        produtos = produtos.filter((p) => p.ativo !== false);
        produtos = aplicarImagensLocais(produtos);
        renderizarCategorias(produtos);
        renderizarProdutos();
    } catch (error) {
        document.getElementById("produtosGrid").innerHTML =
            `<div class="carrinho-vazio"><h2>Erro ao carregar cardápio</h2><p>${error.message}</p></div>`;
    }
}

document.getElementById("modalItem")?.addEventListener("click", (e) => {
    if (e.target.id === "modalItem") fecharModalItem();
});

if (document.getElementById("produtosGrid")) {
    carregarCardapio();
}
