let carrinho = JSON.parse(localStorage.getItem("carrinho") || "[]");

let bebidasCatalogo = [];

let modoModalBebidas = "carrinho";

let bebidaModalAtual = null;



function salvarCarrinhoLocal() {

    localStorage.setItem("carrinho", JSON.stringify(carrinho));

    atualizarBadgeCarrinho();

}



function carrinhoTemBebida() {

    return carrinho.some((item) => {

        const nome = (item.nome || "").toLowerCase();

        return nome.includes("coca") || nome.includes("agua") || nome.includes("água");

    });

}



function renderizarCarrinho() {

    const lista = document.getElementById("listaPedido");

    const totalElemento = document.getElementById("total");

    const totalBox = document.getElementById("totalBox");

    const btnContinuar = document.getElementById("btnContinuar");

    const btnVoltar = document.getElementById("btnVoltarCardapio");



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

        return;

    }



    btnVoltar.style.display = "none";

    totalBox.style.display = "block";

    btnContinuar.style.display = "block";



    carrinho.forEach((produto, index) => {

        const subtotal = produto.preco * produto.quantidade;

        total += subtotal;



        lista.innerHTML += `

            <div class="carrinho-item">

                <div class="carrinho-item-info">

                    <h3>${produto.nome}</h3>

                    <p class="preco-unit">${formatarPreco(produto.preco)} cada</p>

                </div>

                <div class="carrinho-controles">

                    <button class="qty-btn" onclick="diminuir(${index})">−</button>

                    <span class="qty-valor">${produto.quantidade}</span>

                    <button class="qty-btn" onclick="aumentar(${index})">+</button>

                </div>

                <div class="carrinho-subtotal">

                    <button class="btn-remover" onclick="remover(${index})">Remover</button>

                    <strong>${formatarPreco(subtotal)}</strong>

                </div>

            </div>`;

    });



    totalElemento.textContent = formatarPreco(total);

}



function aumentar(index) {

    carrinho[index].quantidade++;

    salvarCarrinhoLocal();

    renderizarCarrinho();

}



function diminuir(index) {

    if (carrinho[index].quantidade > 1) {

        carrinho[index].quantidade--;

    } else {

        carrinho.splice(index, 1);

    }

    salvarCarrinhoLocal();

    renderizarCarrinho();

}



function remover(index) {

    carrinho.splice(index, 1);

    salvarCarrinhoLocal();

    renderizarCarrinho();

    mostrarToast("Item removido");

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



    if (!temEndereco()) {

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



initCarrinho();

