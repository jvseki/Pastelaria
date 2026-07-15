let abaPagamento = null;
let formaEntrega = null;
let mercadoPagoHabilitado = false;
let pixProducao = false;
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

    document.getElementById("totalPedido").textContent = formatarPreco(calcularTotal());
    atualizarDetalhesTotal();
    renderizarResumoEntrega();
    atualizarLabelsEntrega();
    await carregarMercadoPago();
    atualizarBotaoFinalizar();
}

async function carregarMercadoPago() {
    try {
        const cfg = await api.getMercadoPagoConfig();
        mercadoPagoHabilitado = !!cfg.habilitado;
        pixProducao = cfg.modo === "pix_mercadopago";
    } catch (_) {
        mercadoPagoHabilitado = false;
        pixProducao = false;
    }

    const tabs = document.getElementById("pagamentoTabs");
    const tabAgora = document.getElementById("tabPagarAgora");

    if (!mercadoPagoHabilitado) {
        tabAgora.style.display = "none";
        tabs.classList.add("pagamento-tabs--unica");
        selecionarAbaPagamento("entrega");
        return;
    }

    selecionarAbaPagamento("agora");
}

function getTipoEntrega() {
    return getPersistedItem("tipoEntrega") || "entrega";
}

function isRetirada() {
    return getTipoEntrega() === "retirada";
}

function atualizarLabelsEntrega() {
    const retirada = isRetirada();
    const tituloTab = document.getElementById("tabPagarEntregaTitulo");
    const presencialLabel = document.getElementById("presencialLabel");

    if (tituloTab) {
        tituloTab.textContent = retirada ? "Pagar na retirada" : "Pagar na entrega";
    }
    if (presencialLabel) {
        presencialLabel.textContent = retirada
            ? "Como você vai pagar ao retirar?"
            : "Como você vai pagar ao receber?";
    }
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
    const payload = {
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
    if (pagamentoFinal === "mercadopago" && pixProducao) {
        payload.cpf = normalizarCpf(document.getElementById("cpfPix")?.value);
    }
    return payload;
}

function pagamentoEstaCompleto() {
    if (abaPagamento === "agora") {
        if (!mercadoPagoHabilitado) return false;
        if (pixProducao) {
            return normalizarCpf(document.getElementById("cpfPix")?.value).length === 11;
        }
        return true;
    }
    if (abaPagamento === "entrega") return !!formaEntrega;
    return false;
}

function atualizarTextoConfirmacao() {
    const titulo = document.getElementById("confirmarPagamentoTitulo");
    const desc = document.getElementById("confirmarPagamentoDesc");
    const btn = document.getElementById("btnFinalizar");
    const aoReceber = isRetirada() ? "na retirada" : "na entrega";

    if (abaPagamento === "agora") {
        if (titulo) titulo.textContent = "Confirmo e irei pagar com Pix agora";
        if (desc) desc.textContent = "Você verá o QR Code Pix na próxima tela para concluir o pagamento.";
        if (btn) btn.textContent = "Gerar Pix e pagar";
    } else {
        if (titulo) titulo.textContent = `Confirmo o pagamento ${aoReceber}`;
        if (desc) desc.textContent = `Estou ciente de que pagarei ao receber o pedido ${aoReceber}, conforme a forma selecionada.`;
        if (btn) btn.textContent = "Confirmar e finalizar pedido";
    }
}

function atualizarBotaoFinalizar() {
    const confirmado = document.getElementById("confirmarPagamento")?.checked;
    const btn = document.getElementById("btnFinalizar");
    if (!btn) return;
    btn.disabled = !(confirmado && pagamentoEstaCompleto());
}

function selecionarAbaPagamento(aba) {
    abaPagamento = aba;
    formaEntrega = null;

    document.querySelectorAll(".pagamento-tab").forEach((tab) => {
        const ativo = tab.id === (aba === "agora" ? "tabPagarAgora" : "tabPagarEntrega");
        tab.classList.toggle("active", ativo);
        tab.setAttribute("aria-selected", ativo ? "true" : "false");
    });

    document.getElementById("panelPagarAgora")?.classList.toggle("visible", aba === "agora");
    document.getElementById("panelPagarEntrega")?.classList.toggle("visible", aba === "entrega");

    document.querySelectorAll('input[name="formaEntrega"]').forEach((r) => (r.checked = false));
    document.querySelectorAll(".pagamento-opcoes--entrega .pagamento-opcao").forEach((el) => {
        el.classList.remove("selected");
    });
    document.getElementById("trocoSection")?.classList.remove("visible");

    const checkbox = document.getElementById("confirmarPagamento");
    if (checkbox) checkbox.checked = false;

    if (aba === "agora") {
        const cpfSection = document.getElementById("cpfPixSection");
        if (cpfSection) cpfSection.classList.toggle("visible", pixProducao);
    }

    atualizarTextoConfirmacao();
    atualizarBotaoFinalizar();
}

function selecionarFormaEntrega(forma) {
    formaEntrega = forma;

    document.querySelectorAll('input[name="formaEntrega"]').forEach((radio) => {
        radio.checked = radio.value === forma;
        radio.closest(".pagamento-opcao")?.classList.toggle("selected", radio.checked);
    });

    const trocoSection = document.getElementById("trocoSection");
    if (forma === "dinheiro") {
        trocoSection?.classList.add("visible");
    } else {
        trocoSection?.classList.remove("visible");
    }

    atualizarBotaoFinalizar();
}

function toggleTroco() {
    const precisa = document.querySelector('input[name="precisaTroco"]:checked').value;
    document.getElementById("trocoValorGroup").style.display = precisa === "sim" ? "block" : "none";
}

async function finalizarPedido() {
    if (!abaPagamento) {
        mostrarToast("Selecione uma forma de pagamento");
        return;
    }

    if (!document.getElementById("confirmarPagamento").checked) {
        mostrarToast(abaPagamento === "agora" ? "Confirme o pagamento antes de continuar" : "Confirme o pagamento ao receber");
        return;
    }

    const btn = document.getElementById("btnFinalizar");
    btn.disabled = true;

    if (abaPagamento === "agora") {
        btn.textContent = "Gerando Pix...";
        await finalizarComPix(btn);
        return;
    }

    btn.textContent = "Enviando pedido...";

    if (!formaEntrega) {
        mostrarToast("Escolha como vai pagar ao receber");
        btn.disabled = false;
        atualizarTextoConfirmacao();
        atualizarBotaoFinalizar();
        return;
    }

    let troco = null;
    if (formaEntrega === "dinheiro") {
        const precisaTroco = document.querySelector('input[name="precisaTroco"]:checked').value;
        if (precisaTroco === "sim") {
            troco = parseFloat(document.getElementById("trocoPara").value);
            if (!troco || troco <= calcularTotal()) {
                mostrarAlerta("Informe um valor válido para o troco, maior que o total do pedido.", {
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

    try {
        const resultado = await api.criarPedido(montarPayloadPedido(formaEntrega, troco));
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

async function finalizarComPix(btn) {
    try {
        const resultado = await api.iniciarCheckoutMercadoPago(montarPayloadPedido("mercadopago"));
        localStorage.setItem("ultimoPedido", JSON.stringify(resultado));
        localStorage.removeItem("carrinho");
        sessionStorage.removeItem("bebidasOferecidas");

        if (!resultado.pix?.copia_cola) {
            throw new Error("Não foi possível gerar o Pix");
        }

        window.location.href = "pix-pagamento.html";
    } catch (error) {
        mostrarAlerta(error.message, { titulo: "Erro no Pix", tipo: "erro" });
        btn.disabled = false;
        atualizarTextoConfirmacao();
        atualizarBotaoFinalizar();
    }
}

document.addEventListener("DOMContentLoaded", initPagamento);
