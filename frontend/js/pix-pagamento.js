async function initPixPagamento() {
    const container = document.getElementById("pixConteudo");
    const pedido = JSON.parse(localStorage.getItem("ultimoPedido") || "null");
    const pix = pedido?.pix;

    if (!pedido || !pix) {
        container.innerHTML = `
            <div class="carrinho-vazio">
                <h2>Pagamento não encontrado</h2>
                <p style="color:var(--text-secondary);margin-top:8px">Faça um novo pedido para gerar o Pix.</p>
                <a href="cardapio.html" class="btn btn-primary" style="margin-top:20px">Ver cardápio</a>
            </div>`;
        return;
    }

    const valor = pix.valor ?? calcularTotalPedido(pedido);
    const simulado = !!pix.simulado;
    const copiaCola = pix.copia_cola || "";
    const qrSrc = pix.qr_code_base64
        ? `data:image/png;base64,${pix.qr_code_base64}`
        : `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(copiaCola)}`;

    container.innerHTML = `
        <div class="page-title" style="padding-top:0">
            <h1>Pagar com Pix</h1>
            <p>Pedido #${String(pedido.numero_dia ?? pedido.id).padStart(3, "0")} · ${formatarPreco(valor)}</p>
        </div>

        ${simulado ? `
        <div class="pix-sandbox-banner">
            <strong>Modo teste</strong> — Pix simulado. Não é cobrança real.
        </div>` : ""}

        <div class="form-card pix-card">
            <div class="pix-qr-wrap">
                <img src="${qrSrc}" alt="QR Code Pix" class="pix-qr" width="240" height="240">
            </div>

            <p class="pix-instrucao">Escaneie o QR Code ou copie o código abaixo no app do seu banco.</p>

            <div class="pix-copia-cola">
                <code id="pixCodigo">${copiaCola}</code>
            </div>

            <button type="button" class="btn btn-secondary btn-block" id="btnCopiarPix">Copiar código Pix</button>

            ${simulado ? `
            <button type="button" class="btn btn-primary btn-lg btn-block" id="btnSimularPix" style="margin-top:12px">
                Simular pagamento aprovado
            </button>
            <p class="pix-ajuda">No modo teste, clique acima para confirmar o pagamento sem usar o Mercado Pago.</p>
            ` : `
            <div class="pix-aguardando" id="pixAguardando">
                <div class="spinner" style="width:22px;height:22px;margin:16px auto"></div>
                <p>Aguardando confirmação do Pix...</p>
            </div>
            `}
        </div>
    `;

    document.getElementById("btnCopiarPix")?.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(copiaCola);
            mostrarToast("Código Pix copiado!");
        } catch {
            mostrarToast("Não foi possível copiar. Selecione o código manualmente.");
        }
    });

    document.getElementById("btnSimularPix")?.addEventListener("click", () => simularPagamento(pedido.id));
    if (!simulado) {
        iniciarPollingConfirmacao(pedido.id);
    }
}

function calcularTotalPedido(pedido) {
    const itens = pedido.itens || [];
    const taxa = pedido.taxa_entrega || 0;
    return itens.reduce((s, i) => s + i.preco * i.quantidade, 0) + taxa;
}

async function simularPagamento(pedidoId) {
    const btn = document.getElementById("btnSimularPix");
    if (btn) {
        btn.disabled = true;
        btn.textContent = "Confirmando...";
    }

    try {
        const sync = await api.simularPagamentoPix(pedidoId);
        const pedido = JSON.parse(localStorage.getItem("ultimoPedido") || "{}");
        pedido.status = sync.pedido_status || "pendente";
        pedido.pagamento_confirmado = true;
        localStorage.setItem("ultimoPedido", JSON.stringify(pedido));
        window.location.href = "pedido.html";
    } catch (error) {
        mostrarAlerta(error.message, { titulo: "Erro ao confirmar", tipo: "erro" });
        if (btn) {
            btn.disabled = false;
            btn.textContent = "Simular pagamento aprovado";
        }
    }
}

function iniciarPollingConfirmacao(pedidoId) {
    let tentativas = 0;
    const maxTentativas = 60;

    const interval = setInterval(async () => {
        tentativas += 1;
        if (tentativas > maxTentativas) {
            clearInterval(interval);
            return;
        }

        try {
            const sync = await api.confirmarPagamentoMercadoPago(pedidoId);
            if (sync.pagamento_confirmado) {
                clearInterval(interval);
                const pedido = JSON.parse(localStorage.getItem("ultimoPedido") || "{}");
                pedido.status = sync.pedido_status || "pendente";
                pedido.pagamento_confirmado = true;
                localStorage.setItem("ultimoPedido", JSON.stringify(pedido));
                window.location.href = "pedido.html";
            }
        } catch {
            /* continua tentando */
        }
    }, 5000);
}

document.addEventListener("DOMContentLoaded", initPixPagamento);
