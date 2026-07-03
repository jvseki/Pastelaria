let abaPagamento = null;
let formaAgora = "pix";
let formaEntrega = null;
let mercadoPagoHabilitado = false;
let cartaoOnlineHabilitado = false;
let pixProducao = false;
let mpPublicKey = "";
let cardBrickController = null;
let mpSdkCarregando = null;
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
        mostrarAlerta("O pagamento não foi concluído. Tente novamente ou escolha pagar ao receber.", {
            titulo: "Pagamento cancelado",
            tipo: "aviso",
        });
        window.history.replaceState({}, "", "pagamento.html");
    }

    document.getElementById("totalPedido").textContent = formatarPreco(calcularTotal());
    atualizarDetalhesTotal();
    renderizarResumoEntrega();
    atualizarLabelsEntrega();
    await carregarMercadoPago();
    atualizarBotaoFinalizar();
}

async function carregarMercadoPago() {
    let avisoCredenciais = null;
    try {
        const cfg = await api.getMercadoPagoConfig();
        mercadoPagoHabilitado = !!cfg.habilitado;
        cartaoOnlineHabilitado = !!cfg.cartao_habilitado;
        pixProducao = cfg.modo === "pix_mercadopago";
        mpPublicKey = cfg.public_key || "";
        avisoCredenciais = cfg.aviso_credenciais || null;
    } catch (_) {
        mercadoPagoHabilitado = false;
        cartaoOnlineHabilitado = false;
        pixProducao = false;
        mpPublicKey = "";
    }

    if (avisoCredenciais) {
        mostrarAlerta(avisoCredenciais, {
            titulo: "Credenciais do Mercado Pago",
            tipo: "aviso",
        });
    }

    const tabs = document.getElementById("pagamentoTabs");
    const tabAgora = document.getElementById("tabPagarAgora");
    const subtabCartao = document.getElementById("subtabCartao");
    const agoraSubtabs = document.getElementById("agoraSubtabs");

    if (subtabCartao) {
        subtabCartao.style.display = cartaoOnlineHabilitado ? "" : "none";
    }
    if (agoraSubtabs) {
        agoraSubtabs.style.display = cartaoOnlineHabilitado ? "" : "none";
    }

    if (!mercadoPagoHabilitado) {
        tabAgora.style.display = "none";
        tabs.classList.add("pagamento-tabs--unica");
        selecionarAbaPagamento("entrega");
        return;
    }

    if (cartaoOnlineHabilitado) {
        await carregarSdkMercadoPago();
    }

    selecionarAbaPagamento("agora");
}

function carregarSdkMercadoPago() {
    if (window.MercadoPago) return Promise.resolve(true);
    if (mpSdkCarregando) return mpSdkCarregando;

    mpSdkCarregando = new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = "https://sdk.mercadopago.com/js/v2";
        script.async = true;
        script.onload = () => resolve(!!window.MercadoPago);
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
    });

    return mpSdkCarregando;
}

function waitForMercadoPagoSdk(timeoutMs = 10000) {
    return new Promise((resolve) => {
        if (window.MercadoPago) {
            resolve(true);
            return;
        }
        const started = Date.now();
        const interval = setInterval(() => {
            if (window.MercadoPago) {
                clearInterval(interval);
                resolve(true);
                return;
            }
            if (Date.now() - started >= timeoutMs) {
                clearInterval(interval);
                resolve(false);
            }
        }, 100);
    });
}

async function destruirCardBrick() {
    if (cardBrickController?.unmount) {
        try {
            await cardBrickController.unmount();
        } catch (_) {
            /* brick já removido */
        }
    }
    cardBrickController = null;
    const container = document.getElementById("cardPaymentBrick_container");
    if (container) container.innerHTML = "";
}

async function montarCardBrick() {
    const hint = document.getElementById("cardBrickHint");
    if (!cartaoOnlineHabilitado || !mpPublicKey) {
        if (hint) {
            hint.textContent = "Cartão online não configurado. Use Pix ou pague na entrega.";
        }
        return;
    }

    await carregarSdkMercadoPago();
    const sdkOk = await waitForMercadoPagoSdk();
    if (!sdkOk) {
        if (hint) hint.textContent = "Não foi possível carregar o formulário de cartão. Recarregue a página.";
        return;
    }

    await destruirCardBrick();

    const mp = new MercadoPago(mpPublicKey, { locale: "pt-BR" });
    const bricksBuilder = mp.bricks();
    const amount = calcularTotal();

    cardBrickController = await bricksBuilder.create("cardPayment", "cardPaymentBrick_container", {
        initialization: { amount },
        customization: {
            visual: { style: { theme: "default" } },
        },
        callbacks: {
            onReady: () => {},
            onSubmit: (cardFormData) => new Promise((resolve, reject) => {
                processarPagamentoCartao(cardFormData).then(resolve).catch(reject);
            }),
            onError: (error) => {
                console.error("Card Brick:", error);
            },
        },
    });
}

function extrairCpfDoBrick(cardFormData) {
    const payer = cardFormData?.payer || {};
    const id = payer.identification || cardFormData?.identification || {};
    return normalizarCpf(id.number || id.identificationNumber || "");
}

async function processarPagamentoCartao(cardFormData) {
    if (!document.getElementById("confirmarPagamento")?.checked) {
        mostrarAlerta("Marque a confirmação abaixo antes de pagar com cartão.", {
            titulo: "Confirmação necessária",
            tipo: "aviso",
        });
        throw new Error("Confirmação não marcada");
    }

    const cpf = extrairCpfDoBrick(cardFormData);
    if (cpf.length !== 11) {
        mostrarAlerta("Informe um CPF válido no formulário do cartão.", {
            titulo: "CPF obrigatório",
            tipo: "aviso",
        });
        throw new Error("CPF inválido");
    }

    const payload = {
        ...montarPayloadPedido("mercadopago"),
        cpf,
        token: cardFormData.token,
        payment_method_id: cardFormData.payment_method_id,
        installments: cardFormData.installments || 1,
        issuer_id: cardFormData.issuer_id ? String(cardFormData.issuer_id) : null,
    };

    try {
        const resultado = await api.iniciarCheckoutCartao(payload);
        localStorage.setItem("ultimoPedido", JSON.stringify(resultado));
        localStorage.removeItem("carrinho");
        sessionStorage.removeItem("bebidasOferecidas");

        if (resultado.pagamento_confirmado || resultado.cartao?.status === "approved") {
            mostrarToast("Pagamento aprovado!", "sucesso");
            window.location.href = "pedido.html";
            return;
        }

        mostrarAlerta("Pagamento em análise. Acompanhe em Meus pedidos.", {
            titulo: "Aguardando confirmação",
            tipo: "aviso",
        });
        window.location.href = "meus-pedidos.html";
    } catch (error) {
        mostrarAlerta(error.message, { titulo: "Pagamento recusado", tipo: "erro" });
        throw error;
    }
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
    if (pagamentoFinal === "mercadopago" && pixProducao && formaAgora === "pix") {
        payload.cpf = normalizarCpf(document.getElementById("cpfPix")?.value);
    }
    return payload;
}

function pagamentoEstaCompleto() {
    if (abaPagamento === "agora") {
        if (!mercadoPagoHabilitado) return false;
        if (formaAgora === "cartao") return true;
        if (pixProducao) {
            return normalizarCpf(document.getElementById("cpfPix")?.value).length === 11;
        }
        return true;
    }
    if (abaPagamento === "entrega") return !!formaEntrega;
    return false;
}

function atualizarVisibilidadeFinalizar() {
    const actions = document.querySelector(".page-actions");
    const usarBrick = abaPagamento === "agora" && formaAgora === "cartao" && cartaoOnlineHabilitado;
    if (actions) actions.style.display = usarBrick ? "none" : "";
}

function atualizarTextoConfirmacao() {
    const titulo = document.getElementById("confirmarPagamentoTitulo");
    const desc = document.getElementById("confirmarPagamentoDesc");
    const btn = document.getElementById("btnFinalizar");
    const aoReceber = isRetirada() ? "na retirada" : "na entrega";

    if (abaPagamento === "agora") {
        if (formaAgora === "cartao") {
            if (titulo) titulo.textContent = "Confirmo o pagamento com cartão";
            if (desc) desc.textContent = "Autorizo a cobrança no cartão preenchido acima via Mercado Pago.";
        } else {
            if (titulo) titulo.textContent = "Confirmo e irei pagar com Pix agora";
            if (desc) desc.textContent = "Você verá o QR Code Pix na próxima tela para concluir o pagamento.";
            if (btn) btn.textContent = "Gerar Pix e pagar";
        }
    } else {
        if (titulo) titulo.textContent = `Confirmo o pagamento ${aoReceber}`;
        if (desc) desc.textContent = `Estou ciente de que pagarei ao receber o pedido ${aoReceber}, conforme a forma selecionada.`;
        if (btn) btn.textContent = "Confirmar e finalizar pedido";
    }

    atualizarVisibilidadeFinalizar();
}

function atualizarBotaoFinalizar() {
    const confirmado = document.getElementById("confirmarPagamento")?.checked;
    const btn = document.getElementById("btnFinalizar");
    if (!btn) return;
    const usarBrick = abaPagamento === "agora" && formaAgora === "cartao" && cartaoOnlineHabilitado;
    if (usarBrick) return;
    btn.disabled = !(confirmado && pagamentoEstaCompleto());
}

async function selecionarFormaAgora(forma) {
    formaAgora = forma;

    document.getElementById("subtabPix")?.classList.toggle("active", forma === "pix");
    document.getElementById("subtabCartao")?.classList.toggle("active", forma === "cartao");

    const pixConteudo = document.getElementById("agoraConteudoPix");
    const cartaoConteudo = document.getElementById("agoraConteudoCartao");
    if (pixConteudo) pixConteudo.style.display = forma === "pix" ? "" : "none";
    if (cartaoConteudo) cartaoConteudo.style.display = forma === "cartao" ? "" : "none";

    const cpfSection = document.getElementById("cpfPixSection");
    if (cpfSection) {
        cpfSection.classList.toggle("visible", forma === "pix" && pixProducao);
    }

    if (forma === "cartao") {
        await montarCardBrick();
    } else {
        await destruirCardBrick();
    }

    atualizarTextoConfirmacao();
    atualizarBotaoFinalizar();
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
        selecionarFormaAgora(formaAgora || "pix");
    } else {
        destruirCardBrick();
        atualizarTextoConfirmacao();
        atualizarBotaoFinalizar();
    }
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

    if (abaPagamento === "agora" && formaAgora === "cartao") {
        mostrarToast("Use o botão Pagar no formulário do cartão.");
        return;
    }

    if (!document.getElementById("confirmarPagamento").checked) {
        mostrarToast(abaPagamento === "agora" ? "Confirme para gerar o Pix" : "Confirme o pagamento ao receber");
        return;
    }

    const btn = document.getElementById("btnFinalizar");
    btn.disabled = true;
    btn.textContent = abaPagamento === "agora" ? "Gerando Pix..." : "Enviando pedido...";

    if (abaPagamento === "agora") {
        await finalizarComPix(btn);
        return;
    }

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
