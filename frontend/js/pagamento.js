let pagamentoSelecionado = null;
let formaPresencial = null;
let mercadoPagoHabilitado = false;
const carrinho = JSON.parse(localStorage.getItem("carrinho") || "[]");
const TAXA_ENTREGA = Number(window.TAXA_ENTREGA || 0);

async function initPagamento() {
    if (!estaLogado()) {
        window.location.href = "login.html?redirect=pagamento.html";
        return;
    }

    if (carrinho.length === 0) {
        window.location.href = "index.html";
        return;
    }

    await restaurarSessao();

    if (getTipoEntrega() !== "retirada" && !temEndereco()) {
        window.location.href = "cadastro.html";
        return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("mp") === "failure") {
        mostrarAlerta("O pagamento não foi concluído. Tente novamente ou escolha pagar na entrega.", {
            titulo: "Pagamento cancelado",
            tipo: "aviso",
        });
        window.history.replaceState({}, "", "pagamento.html");
    }

    document.getElementById("totalPedido").textContent = formatarPreco(calcularTotal());
    atualizarDetalhesTotal();
    renderizarResumoEntrega();
    await carregarMercadoPago();
    atualizarBotaoFinalizar();
}

async function carregarMercadoPago() {
    try {
        const cfg = await api.getMercadoPagoConfig();
        mercadoPagoHabilitado = !!cfg.habilitado;
        const opcao = document.getElementById("opcaoMercadoPago");
        if (opcao && mercadoPagoHabilitado) {
            opcao.style.display = "";
        }
    } catch (_) {
        mercadoPagoHabilitado = false;
    }
}

function getTipoEntrega() {
    return getPersistedItem("tipoEntrega") || "entrega";
}

function calcularSubtotal() {
    return carrinho.reduce((sum, item) => sum + item.preco * item.quantidade, 0);
}

function calcularTaxaEntrega() {
    return getTipoEntrega() === "entrega" ? TAXA_ENTREGA : 0;
}

function calcularTotal() {
    return calcularSubtotal() + calcularTaxaEntrega();
}

function atualizarDetalhesTotal() {
    const detalhes = document.getElementById("totalDetalhes");
    const taxa = calcularTaxaEntrega();
    detalhes.innerHTML = `
        <span>Produtos: ${formatarPreco(calcularSubtotal())}</span>
        <span>${taxa > 0 ? `Taxa de entrega: ${formatarPreco(taxa)}` : "Retirada: sem taxa"}</span>
    `;
}

function renderizarResumoEntrega() {
    const texto = document.getElementById("entregaResumoTexto");
    const tipo = getTipoEntrega();

    if (tipo === "retirada") {
        const local = parsePersistedJson("localRetirada") || {
            nome: window.LOJA_NOME || "Pastelaria Delivery",
            endereco: window.LOJA_ENDERECO || "Endereço da pastelaria",
            mapsUrl: window.LOJA_MAPS_URL || "",
        };
        texto.innerHTML = `
            <strong>Retirar no local</strong><br>
            ${local.nome} - ${local.endereco}
            ${local.mapsUrl ? `<br><a href="${local.mapsUrl}" target="_blank" rel="noopener">Ver localização</a>` : ""}
        `;
        return;
    }

    const endereco = parsePersistedJson("endereco", {}) || {};
    texto.innerHTML = `
        <strong>Entrega com motoboy</strong><br>
        ${endereco.rua || ""}, ${endereco.numero || ""} - ${endereco.bairro || ""}
    `;
}

function montarObservacao() {
    const combos = carrinho.filter((item) => item.detalhes && item.comboEscolhas);
    if (!combos.length) return null;

    return combos
        .map((item, index) => {
            const rotulo = combos.length > 1 ? `Combo ${index + 1}` : "Combo";
            return `${rotulo}: ${item.detalhes}`;
        })
        .join("\n");
}

function montarPayloadPedido(pagamentoFinal, troco = null) {
    return {
        pagamento: pagamentoFinal,
        troco,
        tipo_entrega: getTipoEntrega(),
        taxa_entrega: calcularTaxaEntrega(),
        local_retirada: window.LOJA_ENDERECO || null,
        observacao: montarObservacao(),
        itens: carrinho.map((item) => ({
            produto_id: item.id,
            quantidade: item.quantidade,
        })),
    };
}

function pagamentoEstaCompleto() {
    if (!pagamentoSelecionado) return false;
    if (pagamentoSelecionado === "presencial") return !!formaPresencial;
    return true;
}

function atualizarTextoConfirmacao() {
    const titulo = document.getElementById("confirmarPagamentoTitulo");
    const desc = document.getElementById("confirmarPagamentoDesc");
    const btn = document.getElementById("btnFinalizar");

    if (pagamentoSelecionado === "mercadopago") {
        if (titulo) titulo.textContent = "Confirmo e irei pagar no Mercado Pago";
        if (desc) desc.textContent = "Voce sera redirecionado para concluir o pagamento online (Pix ou cartão).";
        if (btn) btn.textContent = "Ir para o Mercado Pago";
    } else {
        if (titulo) titulo.textContent = "Confirmo o pagamento na entrega";
        if (desc) desc.textContent = "Estou ciente de que pagarei ao receber o pedido conforme a forma selecionada acima.";
        if (btn) btn.textContent = "Confirmar pagamento e finalizar pedido";
    }
}

function atualizarBotaoFinalizar() {
    const confirmado = document.getElementById("confirmarPagamento")?.checked;
    const btn = document.getElementById("btnFinalizar");
    if (!btn) return;
    btn.disabled = !(confirmado && pagamentoEstaCompleto());
}

function selecionarPagamento(tipo) {
    pagamentoSelecionado = tipo;
    formaPresencial = null;

    document.querySelectorAll(".pagamento-opcao").forEach((el) => {
        el.classList.remove("selected");
        if (el.querySelector(`input[value="${tipo}"]`)) {
            el.classList.add("selected");
        }
    });

    const presencialSection = document.getElementById("presencialSection");
    document.querySelectorAll('input[name="formaPresencial"]').forEach((r) => (r.checked = false));
    document.getElementById("trocoSection")?.classList.remove("visible");

    if (tipo === "presencial") {
        presencialSection.classList.add("visible");
    } else {
        presencialSection.classList.remove("visible");
    }

    atualizarTextoConfirmacao();
    atualizarBotaoFinalizar();
}

function selecionarFormaPresencial(forma) {
    formaPresencial = forma;

    const trocoSection = document.getElementById("trocoSection");

    if (forma === "pix") {
        trocoSection.classList.remove("visible");
    } else {
        trocoSection.classList.add("visible");
    }

    atualizarBotaoFinalizar();
}

function toggleTroco() {
    const precisa = document.querySelector('input[name="precisaTroco"]:checked').value;
    document.getElementById("trocoValorGroup").style.display = precisa === "sim" ? "block" : "none";
}

async function finalizarPedido() {
    if (!pagamentoSelecionado) {
        mostrarToast("Selecione uma forma de pagamento");
        return;
    }

    if (!document.getElementById("confirmarPagamento").checked) {
        mostrarToast(pagamentoSelecionado === "mercadopago" ? "Confirme para ir ao Mercado Pago" : "Confirme o pagamento ao receber");
        return;
    }

    const btn = document.getElementById("btnFinalizar");
    btn.disabled = true;
    btn.textContent = pagamentoSelecionado === "mercadopago" ? "Abrindo Mercado Pago..." : "Enviando pedido...";

    if (pagamentoSelecionado === "mercadopago") {
        await finalizarComMercadoPago(btn);
        return;
    }

    let pagamentoFinal = pagamentoSelecionado;
    let troco = null;

    if (pagamentoSelecionado === "presencial") {
        if (!formaPresencial) {
            mostrarToast("Escolha Pix ou Dinheiro ao receber");
            btn.disabled = false;
            atualizarTextoConfirmacao();
            atualizarBotaoFinalizar();
            return;
        }
        pagamentoFinal = formaPresencial;

        if (formaPresencial === "dinheiro") {
            const precisaTroco = document.querySelector('input[name="precisaTroco"]:checked').value;
            if (precisaTroco === "sim") {
                troco = parseFloat(document.getElementById("trocoPara").value);
                if (!troco || troco <= calcularTotal()) {
                    mostrarAlerta("Informe um valor valido para o troco, maior que o total do pedido.", {
                        titulo: "Troco inválido",
                        tipo: "erro",
                    });
                    btn.disabled = false;
                    atualizarTextoConfirmacao();
                    atualizarBotaoFinalizar();
                    return;
                }
            }
        }
    }

    try {
        const resultado = await api.criarPedido(montarPayloadPedido(pagamentoFinal, troco));
        localStorage.setItem("ultimoPedido", JSON.stringify(resultado));
        localStorage.removeItem("carrinho");
        sessionStorage.removeItem("bebidasOferecidas");
        window.location.href = "pedido.html";
    } catch (error) {
        mostrarAlerta(error.message, { titulo: "Erro ao finalizar pedido", tipo: "erro" });
        btn.disabled = false;
        atualizarTextoConfirmacao();
        atualizarBotaoFinalizar();
    }
}

async function finalizarComMercadoPago(btn) {
    try {
        const resultado = await api.iniciarCheckoutMercadoPago(montarPayloadPedido("mercadopago"));
        localStorage.setItem("ultimoPedido", JSON.stringify(resultado));
        localStorage.removeItem("carrinho");
        sessionStorage.removeItem("bebidasOferecidas");

        if (!resultado.checkout_url) {
            throw new Error("Mercado Pago não retornou link de pagamento");
        }

        window.location.href = resultado.checkout_url;
    } catch (error) {
        mostrarAlerta(error.message, { titulo: "Erro no Mercado Pago", tipo: "erro" });
        btn.disabled = false;
        atualizarTextoConfirmacao();
        atualizarBotaoFinalizar();
    }
}

document.addEventListener("DOMContentLoaded", initPagamento);
