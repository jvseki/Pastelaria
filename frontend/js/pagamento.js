let abaPagamento = null;
let formaAgora = "pix"; // "pix" | "credito" | "debito"
let formaEntrega = null;
let mercadoPagoHabilitado = false;
let pixProducao = false;
let cartaoHabilitado = false;
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
    atualizarDisponibilidadeCartao();
    atualizarBotaoFinalizar();
}

async function carregarMercadoPago() {
    let avisoCredenciais = null;
    try {
        const cfg = await api.getMercadoPagoConfig();
        mercadoPagoHabilitado = !!cfg.habilitado;
        pixProducao = cfg.modo === "pix_mercadopago";
        cartaoHabilitado = !!cfg.cartao_habilitado;
        avisoCredenciais = cfg.aviso_credenciais || null;
    } catch (_) {
        mercadoPagoHabilitado = false;
        pixProducao = false;
        cartaoHabilitado = false;
    }

    if (avisoCredenciais) {
        mostrarAlerta(avisoCredenciais, {
            titulo: "Credenciais do Mercado Pago",
            tipo: "aviso",
        });
    }

    const tabs = document.getElementById("pagamentoTabs");
    const tabAgora = document.getElementById("tabPagarAgora");

    if (!mercadoPagoHabilitado) {
        tabAgora.style.display = "none";
        tabs.classList.add("pagamento-tabs--unica");
        selecionarAbaPagamento("entrega");
        return;
    }

    if (cartaoHabilitado) {
        const opcoesEl = document.getElementById("opcoesAgora");
        if (opcoesEl) opcoesEl.style.display = "";
        const tabSmall = tabAgora.querySelector("small");
        if (tabSmall) tabSmall.textContent = "Pix ou cartão";
    }

    selecionarAbaPagamento("agora");
}

function cartaoDisponivel() {
    return cartaoHabilitado && calcularTotal() >= 1;
}

function atualizarDisponibilidadeCartao() {
    const total = calcularTotal();
    const opcoes = ["credito", "debito"];
    opcoes.forEach((modo) => {
        const el = document.getElementById(`opcaoAgora-${modo}`);
        if (!el) return;
        const bloqueado = total < 1;
        el.classList.toggle("pagamento-opcao--disabled", bloqueado);
        el.style.opacity = bloqueado ? "0.45" : "";
        el.style.pointerEvents = bloqueado ? "none" : "";
    });

    if ((formaAgora === "credito" || formaAgora === "debito") && total < 1) {
        selecionarFormaAgora("pix");
        mostrarToast("Cartão exige pedido mínimo de R$ 1,00. Use Pix para valores menores.");
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
    if (pagamentoFinal === "mercadopago" && pixProducao) {
        payload.cpf = normalizarCpf(document.getElementById("cpfPix")?.value);
    }
    return payload;
}

function pagamentoEstaCompleto() {
    if (abaPagamento === "agora") {
        if (!mercadoPagoHabilitado) return false;
        const ehCartao = formaAgora === "credito" || formaAgora === "debito";
        if (ehCartao) return cartaoDisponivel() && (!pixProducao || normalizarCpf(document.getElementById("cpfPix")?.value).length === 11);
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
        if (formaAgora === "credito") {
            if (titulo) titulo.textContent = "Confirmo e irei pagar com cartão de crédito";
            if (desc) desc.textContent = "Você será redirecionado ao Mercado Pago para inserir o cartão (Nubank, Inter, etc.).";
            if (btn) btn.textContent = "Pagar com crédito";
        } else if (formaAgora === "debito") {
            if (titulo) titulo.textContent = "Confirmo e irei pagar com cartão de débito";
            if (desc) desc.textContent = "Você será redirecionado ao Mercado Pago para inserir o cartão de débito.";
            if (btn) btn.textContent = "Pagar com débito";
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
}

function atualizarBotaoFinalizar() {
    const confirmado = document.getElementById("confirmarPagamento")?.checked;
    const btn = document.getElementById("btnFinalizar");
    if (!btn) return;
    btn.disabled = !(confirmado && pagamentoEstaCompleto());
}

function selecionarFormaAgora(forma) {
    formaAgora = forma || "pix";

    document.querySelectorAll('input[name="formaAgora"]').forEach((r) => {
        r.checked = r.value === formaAgora;
        r.closest(".pagamento-opcao")?.classList.toggle("selected", r.checked);
    });

    const ehCartao = formaAgora === "credito" || formaAgora === "debito";

    const pixInfoBox = document.getElementById("pixInfoBox");
    const cpfSection = document.getElementById("cpfPixSection");
    const cpfHint = document.getElementById("cpfHint");
    const cartaoInfoBox = document.getElementById("cartaoInfoBox");
    const cartaoInfoDesc = document.getElementById("cartaoInfoDesc");

    if (pixInfoBox) pixInfoBox.classList.toggle("visible", !ehCartao);
    if (cpfSection) cpfSection.classList.toggle("visible", pixProducao);
    if (cpfHint) {
        cpfHint.textContent = ehCartao
            ? "Obrigatório para pagamento com cartão no Mercado Pago."
            : "Obrigatório para gerar o Pix no Mercado Pago.";
    }
    if (cartaoInfoBox) cartaoInfoBox.style.display = ehCartao ? "" : "none";
    if (cartaoInfoDesc) {
        const minimo = calcularTotal() < 1
            ? "Valor mínimo para cartão: R$ 1,00. Para pedidos menores, use Pix."
            : formaAgora === "debito"
                ? "No Mercado Pago, insira o cartão de débito do seu banco (Nubank, Inter, Itaú, etc.). Pagamento à vista."
                : "No Mercado Pago, insira o cartão de crédito do seu banco (Nubank, Inter, Itaú, etc.). Pode parcelar.";
        cartaoInfoDesc.textContent = minimo;
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

    if (!document.getElementById("confirmarPagamento").checked) {
        mostrarToast(abaPagamento === "agora" ? "Confirme o pagamento antes de continuar" : "Confirme o pagamento ao receber");
        return;
    }

    const btn = document.getElementById("btnFinalizar");
    btn.disabled = true;

    if (abaPagamento === "agora") {
        if (formaAgora === "credito" || formaAgora === "debito") {
            btn.textContent = "Aguarde...";
            await finalizarComCartao(btn, formaAgora);
        } else {
            btn.textContent = "Gerando Pix...";
            await finalizarComPix(btn);
        }
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

async function finalizarComCartao(btn, modo) {
    try {
        const payload = montarPayloadPedido("mercadopago");
        payload.modo = modo;
        const resultado = await api.iniciarCheckoutPro(payload);

        if (!resultado.checkout_url) {
            throw new Error("Não foi possível gerar o link de pagamento");
        }

        localStorage.setItem("ultimoPedido", JSON.stringify(resultado));
        localStorage.removeItem("carrinho");
        sessionStorage.removeItem("bebidasOferecidas");

        window.location.href = resultado.checkout_url;
    } catch (error) {
        mostrarAlerta(error.message, { titulo: "Erro no pagamento com cartão", tipo: "erro" });
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
