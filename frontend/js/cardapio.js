let categoriaAtiva = "Todos";
let produtos = [];
let produtoModalAtual = null;
let modalModo = "preview";
let comboEscolhasAtual = null;
let modalQuantidade = 1;
let focoAntesModal = null;

function getCarrinho() {
    return JSON.parse(localStorage.getItem("carrinho") || "[]");
}

function salvarCarrinho(carrinho) {
    localStorage.setItem("carrinho", JSON.stringify(carrinho));
    atualizarBadgeCarrinho();
}

function quantidadeNoCarrinho(produtoId) {
    return getCarrinho().filter((i) => i.id === produtoId).reduce((s, i) => s + i.quantidade, 0);
}

function adicionarAoCarrinho(produtoId, mostrarToastMsg = true, extras = {}) {
    const produto = produtos.find((p) => p.id === produtoId);
    if (!produto) return;

    const carrinho = getCarrinho();
    const img = imagemProduto(produto);
    const temDetalhes = !!extras.detalhes;
    const qtd = extras.quantidade || 1;

    if (!temDetalhes) {
        const existente = carrinho.find((item) => item.id === produto.id && !item.detalhes);
        if (existente) {
            existente.quantidade += qtd;
        } else {
            carrinho.push({
                id: produto.id,
                nome: produto.nome,
                preco: produto.preco,
                imagem: img,
                quantidade: qtd,
            });
        }
    } else {
        for (let i = 0; i < qtd; i++) {
            carrinho.push({
                id: produto.id,
                nome: produto.nome,
                preco: produto.preco,
                imagem: img,
                quantidade: 1,
                detalhes: extras.detalhes,
                comboEscolhas: extras.comboEscolhas || null,
            });
        }
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
    comboEscolhasAtual = null;
    modalQuantidade = 1;
    abrirModalItem(produto, "preview");
}

function alterarModalQuantidade(delta) {
    modalQuantidade = Math.max(1, Math.min(20, modalQuantidade + delta));
    const el = document.getElementById("modalItemQuantidade");
    if (el) el.textContent = modalQuantidade;
    atualizarFooterModal();
}

function atualizarFooterModal() {
    if (!produtoModalAtual) return;

    const totalEl = document.getElementById("modalItemTotalBtn");
    const labelEl = document.getElementById("modalItemBtnLabel");
    const isCombo = isProdutoCombo(produtoModalAtual);
    const total = produtoModalAtual.preco * modalQuantidade;

    if (totalEl) totalEl.textContent = formatarPreco(total);
    if (labelEl) labelEl.textContent = isCombo ? "Adicionar combo" : "Adicionar";
}

function preencherDadosModal(produto) {
    const img = imagemProduto(produto);
    const qty = quantidadeNoCarrinho(produto.id);
    const combo = isProdutoCombo(produto);

    document.getElementById("modalItemImg").src = img;
    document.getElementById("modalItemImg").alt = produto.nome;
    document.getElementById("modalItemNome").textContent = produto.nome;
    document.getElementById("modalItemCategoria").textContent = produto.categoria || "Cardápio";
    document.getElementById("modalItemDescricao").textContent =
        produto.descricao || "Preparado na hora com ingredientes selecionados.";
    document.getElementById("modalItemPreco").textContent = formatarPreco(produto.preco);

    const badge = document.getElementById("modalItemQty");
    if (badge) {
        if (qty > 0) {
            badge.textContent = `${qty} no carrinho`;
            badge.style.display = "inline-flex";
        } else if (combo) {
            badge.textContent = "Personalize abaixo";
            badge.style.display = "inline-flex";
        } else {
            badge.style.display = "none";
        }
    }

    const qtyEl = document.getElementById("modalItemQuantidade");
    if (qtyEl) qtyEl.textContent = modalQuantidade;

    const comboArea = document.getElementById("modalComboArea");
    const simpleArea = document.getElementById("modalSimpleArea");

    if (combo && comboArea) {
        comboArea.innerHTML = renderizarFormularioCombo();
        comboArea.style.display = "block";
        if (simpleArea) simpleArea.style.display = "none";
    } else {
        if (comboArea) comboArea.style.display = "none";
        if (simpleArea) simpleArea.style.display = "flex";
    }

    atualizarFooterModal();

    if (modalModo === "posAdd") {
        const textoSucesso = document.getElementById("modalItemSucessoTexto");
        if (textoSucesso) {
            textoSucesso.textContent = `${produto.nome} · ${qty} ${qty === 1 ? "unidade" : "unidades"} no carrinho`;
        }
    }
}

function atualizarModoModal(modo) {
    modalModo = modo;
    const preview = document.getElementById("modalItemPreview");
    const posAdd = document.getElementById("modalItemPosAdd");
    const footerPreview = document.getElementById("modalItemFooterPreview");
    const footerPosAdd = document.getElementById("modalItemFooterPosAdd");
    const headerKanji = document.getElementById("modalItemKanji");
    const tituloSucesso = document.getElementById("modalItemTituloSucesso");
    const textoSucesso = document.getElementById("modalItemSucessoTexto");
    const modalBox = document.querySelector("#modalItem .modal-produto-sheet");
    const isCombo = produtoModalAtual && isProdutoCombo(produtoModalAtual);

    if (modalBox) modalBox.classList.toggle("modal-produto-sheet--combo", !!isCombo);

    if (modo === "preview") {
        preview.style.display = "block";
        posAdd.style.display = "none";
        if (footerPreview) footerPreview.style.display = "block";
        if (footerPosAdd) footerPosAdd.style.display = "none";
        if (headerKanji) headerKanji.textContent = isCombo ? "セット" : "商品";
    } else {
        preview.style.display = "none";
        posAdd.style.display = "flex";
        if (footerPreview) footerPreview.style.display = "none";
        if (footerPosAdd) footerPosAdd.style.display = "flex";

        const qty = quantidadeNoCarrinho(produtoModalAtual?.id);
        if (headerKanji) headerKanji.textContent = "追加";
        if (tituloSucesso) {
            tituloSucesso.textContent = isCombo ? "Combo no carrinho!" : "Adicionado ao carrinho!";
        }
        if (textoSucesso && produtoModalAtual) {
            textoSucesso.textContent = `${produtoModalAtual.nome} · ${qty} ${qty === 1 ? "unidade" : "unidades"} no carrinho`;
        }
    }

    atualizarFooterModal();
}

function abrirModalItem(produto, modo = "preview") {
    focoAntesModal = document.activeElement;
    produtoModalAtual = produto;
    if (modo === "preview") modalQuantidade = 1;
    preencherDadosModal(produto);
    atualizarModoModal(modo);
    document.getElementById("modalItem").classList.add("open");
    document.querySelector("#modalItem .modal-close-btn").focus();
    document.body.style.overflow = "hidden";
}

function fecharModalItem() {
    document.getElementById("modalItem").classList.remove("open");
    document.body.style.overflow = "";
    produtoModalAtual = null;
    focoAntesModal?.focus();
    comboEscolhasAtual = null;
    modalQuantidade = 1;
    modalModo = "preview";
}

function confirmarAdicionarItem() {
    if (!produtoModalAtual) return;

    if (isProdutoCombo(produtoModalAtual)) {
        const escolhas = lerEscolhasCombo();
        const erro = validarEscolhasCombo(escolhas);
        if (erro) {
            mostrarToast(erro);
            return;
        }
        comboEscolhasAtual = escolhas;
        const resumo = resumirEscolhasCombo(escolhas);
        adicionarAoCarrinho(produtoModalAtual.id, true, {
            detalhes: resumo.texto,
            comboEscolhas: { pasteis: resumo.pasteis, bebidas: resumo.bebidas },
        });
    } else {
        adicionarAoCarrinho(produtoModalAtual.id, true, { quantidade: modalQuantidade });
    }

    preencherDadosModal(produtoModalAtual);
    atualizarModoModal("posAdd");
}

function adicionarMaisItem() {
    if (!produtoModalAtual) return;

    if (isProdutoCombo(produtoModalAtual)) {
        if (!comboEscolhasAtual) {
            mostrarToast("Configure o combo novamente");
            atualizarModoModal("preview");
            preencherDadosModal(produtoModalAtual);
            return;
        }
        const resumo = resumirEscolhasCombo(comboEscolhasAtual);
        adicionarAoCarrinho(produtoModalAtual.id, false, {
            detalhes: resumo.texto,
            comboEscolhas: { pasteis: resumo.pasteis, bebidas: resumo.bebidas },
        });
    } else {
        adicionarAoCarrinho(produtoModalAtual.id, false, { quantidade: 1 });
    }

    modalQuantidade = 1;
    const qtyEl = document.getElementById("modalItemQuantidade");
    if (qtyEl) qtyEl.textContent = "1";

    preencherDadosModal(produtoModalAtual);
    mostrarToast(`Mais um ${produtoModalAtual.nome}!`);
}

function finalizarPedidoDoModal() {
    fecharModalItem();
    sessionStorage.setItem("verificarBebidas", "1");
    window.location.href = "carrinho.html";
}


function renderizarCategorias(lista) {
    const container = document.getElementById('categorias');
    container.replaceChildren();
    for (const cat of ['Todos', ...new Set(lista.map(p => p.categoria))]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'categoria-btn' + (cat === categoriaAtiva ? ' active' : '');
        button.textContent = cat;
        button.setAttribute('aria-pressed', String(cat === categoriaAtiva));
        button.addEventListener('click', () => filtrarCategoria(cat));
        container.appendChild(button);
    }
}
function filtrarCategoria(categoria) {
    categoriaAtiva = categoria;
    document.querySelectorAll('#categorias button').forEach(button => {
        const active = button.textContent === categoria;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
    });
    renderizarProdutos();
}
function normalizarBusca(texto) {
    return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
function renderizarProdutos() {
    const busca = normalizarBusca(document.getElementById('buscaProduto').value);
    const filtrados = produtos.filter(p => (categoriaAtiva === 'Todos' || p.categoria === categoriaAtiva) && normalizarBusca(p.nome + ' ' + (p.descricao || '')).includes(busca));
    document.getElementById('resultadoBusca').textContent = filtrados.length + ' produto(s) encontrado(s)';
    document.getElementById('produtosGrid').innerHTML = filtrados.length ? renderizarCardsNakachi(filtrados) : '<div class="nk-state"><h2>Nenhum produto por aqui</h2><p>Tente outra busca ou categoria. Novos sabores podem chegar em breve.</p></div>';
}
async function carregarCardapio() {
    const grid = document.getElementById('produtosGrid');
    grid.innerHTML = '<div class="nk-state" role="status">Carregando cardápio…</div>';
    try {
        produtos = aplicarImagensLocais((await api.getProdutos()).filter(p => p.ativo !== false));
        const categoriaUrl = new URLSearchParams(location.search).get('categoria');
        if (categoriaUrl && produtos.some(p => p.categoria === categoriaUrl)) categoriaAtiva = categoriaUrl;
        renderizarCategorias(produtos);
        renderizarProdutos();
    } catch {
        grid.innerHTML = '<div class="nk-state" role="alert"><h2>Não conseguimos carregar o cardápio</h2><p>Verifique sua conexão e tente novamente.</p><button class="btn btn-primary" id="recarregarCardapio">Tentar novamente</button></div>';
        document.getElementById('recarregarCardapio').addEventListener('click', carregarCardapio);
    }
}
document.getElementById('buscaProduto')?.addEventListener('input', renderizarProdutos);

document.getElementById("modalItem")?.addEventListener("click", (e) => {
    if (e.target.id === "modalItem") fecharModalItem();
});

if (document.getElementById("produtosGrid")) {
    carregarCardapio();
}

document.addEventListener('keydown', event => {
    const modal = document.getElementById('modalItem');
    if (!modal?.classList.contains('open')) return;
    if (event.key === 'Escape') fecharModalItem();
    if (event.key !== 'Tab') return;
    const elements = [...modal.querySelectorAll('button, select, input, a[href], [tabindex="0"]')].filter(el => !el.disabled && el.getClientRects().length);
    const first = elements[0], last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
});
