let pagamentoSelecionado = null;
let formaPresencial = null;
const carrinho = JSON.parse(localStorage.getItem("carrinho") || "[]");

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

    if (!temEndereco()) {
        window.location.href = "cadastro.html";
        return;
    }

    document.getElementById("totalPedido").textContent = formatarPreco(calcularTotal());
    document.getElementById("pixChaveTexto").textContent = window.PIX_CHAVE || "";
    atualizarBotaoFinalizar();
}

function calcularTotal() {
    return carrinho.reduce((sum, item) => sum + item.preco * item.quantidade, 0);
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
        mostrarToast("Confirme o pagamento na entrega para continuar");
        return;
    }

    let pagamentoFinal = pagamentoSelecionado;
    let troco = null;

    if (pagamentoSelecionado === "presencial") {
        if (!formaPresencial) {
            mostrarToast("Escolha Pix ou Dinheiro na entrega");
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
