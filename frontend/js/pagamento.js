let pagamentoSelecionado = null;
let formaPresencial = null;
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
    configurarPix();
    atualizarBotaoFinalizar();
}

function getTipoEntrega() {
    return localStorage.getItem("tipoEntrega") || "entrega";
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
        const local = JSON.parse(localStorage.getItem("localRetirada") || "null") || {
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

    const endereco = JSON.parse(localStorage.getItem("endereco") || "null") || {};
    texto.innerHTML = `
        <strong>Entrega com motoboy</strong><br>
        ${endereco.rua || ""}, ${endereco.numero || ""} - ${endereco.bairro || ""}
    `;
}

function configurarPix() {
    const chave = window.PIX_CHAVE || "";
    const chaveTexto = document.getElementById("pixChaveTexto");
    const pixLabel = document.querySelector(".pix-label");
    const copiarBtn = document.querySelector(".pix-chave-box button");

    if (chave) {
        chaveTexto.textContent = chave;
        return;
    }

    chaveTexto.textContent = "Chave Pix não configurada";
    if (pixLabel) pixLabel.textContent = "Combine o Pix diretamente na retirada/entrega";
    if (copiarBtn) copiarBtn.style.display = "none";
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

function pagamentoEstaCompleto() {
    if (!pagamentoSelecionado) return false;
    if (pagamentoSelecionado === "presencial") return !!formaPresencial;
    return true;
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
    document.getElementById("pixInfoBox")?.classList.remove("visible");
    document.getElementById("trocoSection")?.classList.remove("visible");

    if (tipo === "presencial") {
        presencialSection.classList.add("visible");
    } else {
        presencialSection.classList.remove("visible");
    }

    atualizarBotaoFinalizar();
}

function selecionarFormaPresencial(forma) {
    formaPresencial = forma;

    const pixInfo = document.getElementById("pixInfoBox");
    const trocoSection = document.getElementById("trocoSection");

    if (forma === "pix") {
        pixInfo.classList.add("visible");
        trocoSection.classList.remove("visible");
    } else {
        pixInfo.classList.remove("visible");
        trocoSection.classList.add("visible");
    }

    atualizarBotaoFinalizar();
}

function copiarPix() {
    const chave = window.PIX_CHAVE || "";
    if (!chave) {
        mostrarToast("Chave Pix ainda não configurada");
        return;
    }
    navigator.clipboard.writeText(chave).then(() => mostrarToast("Chave Pix copiada!"));
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
        mostrarToast("Confirme o pagamento ao receber para continuar");
        return;
    }

    let pagamentoFinal = pagamentoSelecionado;
    let troco = null;

    if (pagamentoSelecionado === "presencial") {
        if (!formaPresencial) {
            mostrarToast("Escolha Pix ou Dinheiro ao receber");
            return;
        }
        pagamentoFinal = formaPresencial;

        if (formaPresencial === "dinheiro") {
            const precisaTroco = document.querySelector('input[name="precisaTroco"]:checked').value;
            if (precisaTroco === "sim") {
                troco = parseFloat(document.getElementById("trocoPara").value);
                if (!troco || troco <= calcularTotal()) {
                    alert("Informe um valor valido para o troco (maior que o total)");
                    return;
                }
            }
        }
    }

    const btn = document.getElementById("btnFinalizar");
    btn.disabled = true;
    btn.textContent = "Enviando pedido...";

    const pedido = {
        pagamento: pagamentoFinal,
        troco: troco,
        tipo_entrega: getTipoEntrega(),
        taxa_entrega: calcularTaxaEntrega(),
        local_retirada: window.LOJA_ENDERECO || null,
        observacao: montarObservacao(),
        itens: carrinho.map((item) => ({
            produto_id: item.id,
            quantidade: item.quantidade,
        })),
    };

    try {
        const resultado = await api.criarPedido(pedido);
        localStorage.setItem("ultimoPedido", JSON.stringify(resultado));
        localStorage.removeItem("carrinho");
        sessionStorage.removeItem("bebidasOferecidas");
        window.location.href = "pedido.html";
    } catch (error) {
        alert("Erro ao finalizar pedido: " + error.message);
        btn.disabled = false;
        btn.textContent = "Confirmar pagamento e finalizar pedido";
        atualizarBotaoFinalizar();
    }
}

document.addEventListener("DOMContentLoaded", initPagamento);
