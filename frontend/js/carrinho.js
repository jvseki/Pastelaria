let carrinho = JSON.parse(localStorage.getItem("carrinho") || "[]");

let bebidasCatalogo = [];

let modoModalBebidas = "carrinho";

let bebidaModalAtual = null;

let indexRemoverPendente = null;

let quantidadeRemoverPendente = 1;

let indexAumentarPendente = null;

const ICONE_LIXEIRA = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;

function salvarCarrinhoLocal() {
    localStorage.setItem("carrinho", JSON.stringify(carrinho));
    atualizarBadgeCarrinho();
}

function carrinhoTemBebida() {
    return carrinho.some((item) => {
        const nome = (item.nome || "").toLowerCase();
        if (nome.includes("coca") || nome.includes("agua") || nome.includes("água")) return true;
        if (item.comboEscolhas?.bebidas?.length) return true;
        if (item.detalhes && item.detalhes.includes("Bebidas:")) return true;
        return false;
    });
}

function renderizarCarrinho() {
    const lista = document.getElementById("listaPedido");
    const totalElemento = document.getElementById("total");
    const totalBox = document.getElementById("totalBox");
    const btnContinuar = document.getElementById("btnContinuar");
    const btnVoltar = document.getElementById("btnVoltarCardapio");
    const toolbar = document.getElementById("carrinhoToolbar");

    lista.innerHTML = "";
    let total = 0;

    if (carrinho.length === 0) {
        lista.innerHTML = `
            <div class="carrinho-vazio">
                <div class="empty-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                </div>
                <h2>Seu carrinho está vazio</h2>
                <p>Adicione itens do cardápio para continuar</p>
            </div>`;
        totalBox.style.display = "none";
        btnContinuar.style.display = "none";
        btnVoltar.style.display = "block";
        if (toolbar) toolbar.style.display = "none";
        return;
    }

    btnVoltar.style.display = "none";
    totalBox.style.display = "block";
    btnContinuar.style.display = "block";
    if (toolbar) toolbar.style.display = "flex";

    carrinho.forEach((produto, index) => {
        const subtotal = produto.preco * produto.quantidade;
        total += subtotal;

        lista.innerHTML += `
            <div class="carrinho-item">
                <div class="carrinho-item-top">
                    <div class="carrinho-item-info">
                        <h3>${produto.nome}</h3>
                        ${produto.detalhes ? `<p class="carrinho-item-detalhes">${produto.detalhes}</p>` : ""}
                        <p class="preco-unit">${formatarPreco(produto.preco)} cada</p>
                    </div>
                    <button type="button" class="btn-lixeira" onclick="solicitarRemover(${index})" aria-label="Remover ${produto.nome}" title="Remover item">
                        ${ICONE_LIXEIRA}
                    </button>
                </div>
                <div class="carrinho-item-bottom">
                    <div class="carrinho-controles">
                        <button type="button" class="qty-btn" onclick="diminuir(${index})">−</button>
                        <span class="qty-valor">${produto.quantidade}</span>
                        <button type="button" class="qty-btn" onclick="solicitarAumentar(${index})">+</button>
                    </div>
                    <strong class="carrinho-subtotal-valor">${formatarPreco(subtotal)}</strong>
                </div>
            </div>`;
    });

    totalElemento.textContent = formatarPreco(total);
}

function aumentar(index) {
    carrinho[index].quantidade++;
    salvarCarrinhoLocal();
    renderizarCarrinho();
    mostrarToast(`Mais um ${carrinho[index].nome}!`);
}

function solicitarAumentar(index) {
    const item = carrinho[index];
    if (!item) return;

    indexAumentarPendente = index;
    const texto = document.getElementById("modalAdicionarTexto");
    if (texto) {
        texto.textContent = `Deseja adicionar mais um "${item.nome}" ao carrinho?`;
    }
    document.getElementById("modalAdicionar")?.classList.add("open");
    document.body.style.overflow = "hidden";
}

function fecharModalAdicionar() {
    document.getElementById("modalAdicionar")?.classList.remove("open");
    document.body.style.overflow = "";
    indexAumentarPendente = null;
}

function confirmarAumentarItem() {
    if (indexAumentarPendente === null) return;
    aumentar(indexAumentarPendente);
    fecharModalAdicionar();
}

function diminuir(index) {
    if (carrinho[index].quantidade > 1) {
        carrinho[index].quantidade--;
        salvarCarrinhoLocal();
        renderizarCarrinho();
    } else {
        solicitarRemover(index);
    }
}

function atualizarUiRemoverModal() {
    const item = indexRemoverPendente !== null ? carrinho[indexRemoverPendente] : null;
    if (!item) return;

    const qtyEl = document.getElementById("modalRemoverQty");
    const restanteEl = document.getElementById("modalRemoverRestante");
    const btnConfirm = document.getElementById("btnConfirmarRemover");

    if (qtyEl) qtyEl.textContent = quantidadeRemoverPendente;

    const restante = item.quantidade - quantidadeRemoverPendente;
    if (restanteEl) {
        if (restante > 0) {
            restanteEl.textContent = `Ficara${restante === 1 ? "" : "o"} ${restante} unidade${restante === 1 ? "" : "s"} no carrinho`;
        } else {
            restanteEl.textContent = "O item sera removido por completo";
        }
    }

    if (btnConfirm) {
        btnConfirm.textContent =
            quantidadeRemoverPendente >= item.quantidade
                ? "Remover tudo"
                : `Remover ${quantidadeRemoverPendente} unidade${quantidadeRemoverPendente === 1 ? "" : "s"}`;
    }
}

function alterarQtyRemover(delta) {
    const item = indexRemoverPendente !== null ? carrinho[indexRemoverPendente] : null;
    if (!item) return;

    quantidadeRemoverPendente = Math.max(1, Math.min(item.quantidade, quantidadeRemoverPendente + delta));
    atualizarUiRemoverModal();
}

function setRemoverTodas() {
    const item = indexRemoverPendente !== null ? carrinho[indexRemoverPendente] : null;
    if (!item) return;

    quantidadeRemoverPendente = item.quantidade;
    atualizarUiRemoverModal();
}

function solicitarRemover(index) {
    const item = carrinho[index];
    if (!item) return;

    indexRemoverPendente = index;
    quantidadeRemoverPendente = 1;

    const qtyArea = document.getElementById("modalRemoverQtyArea");
    const texto = document.getElementById("modalRemoverTexto");
    const titulo = document.getElementById("modalRemoverTitulo");

    if (titulo) titulo.textContent = "Remover item?";

    if (item.quantidade > 1) {
        if (qtyArea) qtyArea.style.display = "block";
        if (texto) {
            texto.textContent = `"${item.nome}" — voce tem ${item.quantidade} unidades. Escolha quantas deseja remover:`;
        }
        atualizarUiRemoverModal();
    } else {
        if (qtyArea) qtyArea.style.display = "none";
        if (texto) {
            texto.textContent = `Deseja remover "${item.nome}" do carrinho?`;
        }
        const btnConfirm = document.getElementById("btnConfirmarRemover");
        if (btnConfirm) btnConfirm.textContent = "Sim, remover";
    }

    document.getElementById("modalRemover")?.classList.add("open");
    document.body.style.overflow = "hidden";
}

function solicitarLimparCarrinho() {
    if (carrinho.length === 0) return;

    indexRemoverPendente = "all";
    quantidadeRemoverPendente = 1;

    const qtyArea = document.getElementById("modalRemoverQtyArea");
    const texto = document.getElementById("modalRemoverTexto");
    const titulo = document.getElementById("modalRemoverTitulo");
    const btnConfirm = document.getElementById("btnConfirmarRemover");

    if (qtyArea) qtyArea.style.display = "none";
    if (titulo) titulo.textContent = "Limpar carrinho?";
    if (texto) {
        const totalItens = carrinho.reduce((s, i) => s + i.quantidade, 0);
        texto.textContent = `Deseja remover todos os ${totalItens} itens do carrinho? Esta acao nao pode ser desfeita.`;
    }
    if (btnConfirm) btnConfirm.textContent = "Sim, limpar tudo";

    document.getElementById("modalRemover")?.classList.add("open");
    document.body.style.overflow = "hidden";
}

function fecharModalRemover() {
    document.getElementById("modalRemover")?.classList.remove("open");
    document.body.style.overflow = "";
    indexRemoverPendente = null;
    quantidadeRemoverPendente = 1;
}

function confirmarRemoverItem() {
    if (indexRemoverPendente === null) return;

    if (indexRemoverPendente === "all") {
        carrinho = [];
        salvarCarrinhoLocal();
        renderizarCarrinho();
        mostrarToast("Carrinho limpo");
    } else {
        removerQuantidade(indexRemoverPendente, quantidadeRemoverPendente);
    }

    fecharModalRemover();
}

function removerQuantidade(index, qtd) {
    const item = carrinho[index];
    if (!item) return;

    if (qtd >= item.quantidade) {
        carrinho.splice(index, 1);
        mostrarToast("Item removido");
    } else {
        item.quantidade -= qtd;
        mostrarToast(`${qtd} unidade${qtd === 1 ? "" : "s"} removida${qtd === 1 ? "" : "s"}`);
    }

    salvarCarrinhoLocal();
    renderizarCarrinho();
}

function adicionarBebida(produto) {
    const img = imagemProduto(produto);
    const existente = carrinho.find((item) => item.id === produto.id);

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

    salvarCarrinhoLocal();
    renderizarCarrinho();
}

function mostrarListaBebidas() {
    bebidaModalAtual = null;
    document.getElementById("bebidasLista").style.display = "block";
    document.getElementById("bebidasMaisUm").style.display = "none";
    document.getElementById("modalBebidasTitulo").textContent = "Quer adicionar uma bebida?";
    document.getElementById("modalBebidasTexto").textContent =
        "Seu pedido ficou ainda melhor com um refri gelado ou uma agua!";

    const container = document.getElementById("bebidasOpcoes");
    container.innerHTML = bebidasCatalogo
        .map(
            (b) => `
        <button type="button" class="bebida-opcao" onclick="escolherBebida(${b.id})">
            <img src="${imagemProduto(b)}" alt="${b.nome}" loading="lazy">
            <div class="bebida-opcao-info">
                <strong>${b.nome}</strong>
                <span>${b.descricao}</span>
            </div>
            <span class="bebida-opcao-preco">${formatarPreco(b.preco)}</span>
        </button>`
        )
        .join("");
}

function mostrarBebidaMaisUm(produto) {
    bebidaModalAtual = produto;
    document.getElementById("bebidasLista").style.display = "none";
    document.getElementById("bebidasMaisUm").style.display = "block";
    document.getElementById("modalBebidasTitulo").textContent = "Bebida adicionada!";
    document.getElementById("modalBebidasTexto").textContent = `Deseja adicionar mais uma ${produto.nome}?`;
    document.getElementById("bebidaMaisUmImg").src = imagemProduto(produto);
    document.getElementById("bebidaMaisUmImg").alt = produto.nome;
    document.getElementById("bebidaMaisUmNome").textContent = produto.nome;
    const qty = carrinho.find((i) => i.id === produto.id)?.quantidade || 1;
    document.getElementById("bebidaMaisUmQty").textContent = `${qty} no carrinho`;
}

function fecharModalBebidas() {
    document.getElementById("modalBebidas").classList.remove("open");
    document.body.style.overflow = "";
    mostrarListaBebidas();
}

function abrirModalBebidas(modo = "carrinho") {
    if (bebidasCatalogo.length === 0) return;
    modoModalBebidas = modo;
    mostrarListaBebidas();
    document.getElementById("modalBebidas").classList.add("open");
    document.body.style.overflow = "hidden";
}

function escolherBebida(produtoId) {
    const produto = bebidasCatalogo.find((b) => b.id === produtoId);
    if (!produto) return;
    adicionarBebida(produto);
    mostrarBebidaMaisUm(produto);
}

function adicionarMaisBebida() {
    if (!bebidaModalAtual) return;
    adicionarBebida(bebidaModalAtual);
    const qty = carrinho.find((i) => i.id === bebidaModalAtual.id)?.quantidade || 1;
    document.getElementById("bebidaMaisUmQty").textContent = `${qty} no carrinho`;
    mostrarToast(`Mais uma ${bebidaModalAtual.nome}!`);
}

function concluirBebidas() {
    sessionStorage.setItem("bebidasOferecidas", "1");
    fecharModalBebidas();
    if (modoModalBebidas === "checkout") {
        avancarCheckout();
    }
}

function pularBebidas() {
    sessionStorage.setItem("bebidasOferecidas", "1");
    fecharModalBebidas();
    if (modoModalBebidas === "checkout") {
        avancarCheckout();
    }
}

async function avancarCheckout() {
    if (!estaLogado()) {
        window.location.href = "login.html?redirect=cadastro.html";
        return;
    }

    await restaurarSessao();

    if (getPersistedItem("tipoEntrega") !== "retirada" && !temEndereco()) {
        window.location.href = "cadastro.html";
        return;
    }

    window.location.href = "pagamento.html";
}

async function continuarPedido() {
    if (carrinho.length === 0) return;

    const jaOfereceu = sessionStorage.getItem("bebidasOferecidas") === "1";

    if (!jaOfereceu && !carrinhoTemBebida() && bebidasCatalogo.length > 0) {
        abrirModalBebidas("checkout");
        return;
    }

    await avancarCheckout();
}

async function carregarBebidas() {
    try {
        const todos = await api.getProdutos();
        bebidasCatalogo = todos.filter((p) => {
            const nome = (p.nome || "").toLowerCase();
            return (
                p.ativo !== false &&
                (nome.includes("coca") || nome.includes("agua") || nome.includes("água"))
            );
        });
        bebidasCatalogo = aplicarImagensLocais(bebidasCatalogo);
    } catch (_) {
        bebidasCatalogo = [];
    }
}

async function initCarrinho() {
    carrinho = JSON.parse(localStorage.getItem("carrinho") || "[]");
    await carregarBebidas();
    renderizarCarrinho();

    if (sessionStorage.getItem("verificarBebidas") === "1") {
        sessionStorage.removeItem("verificarBebidas");
        if (!carrinhoTemBebida() && bebidasCatalogo.length > 0) {
            abrirModalBebidas("carrinho");
        }
    }
}

document.getElementById("modalBebidas")?.addEventListener("click", (e) => {
    if (e.target.id === "modalBebidas") fecharModalBebidas();
});

document.getElementById("modalRemover")?.addEventListener("click", (e) => {
    if (e.target.id === "modalRemover") fecharModalRemover();
});

document.getElementById("modalAdicionar")?.addEventListener("click", (e) => {
    if (e.target.id === "modalAdicionar") fecharModalAdicionar();
});

initCarrinho();
