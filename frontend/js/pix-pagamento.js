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
        : `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(copiaCola)}`;

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
                <img src="${qrSrc}" alt="QR Code Pix" class="pix-qr" width="280" height="280" loading="eager">
            </div>

            <p class="pix-instrucao">Escaneie o QR Code ou toque em <strong>Copiar código Pix</strong> e cole no app do banco.</p>

            <button type="button" class="btn btn-primary btn-lg btn-block btn-copiar-pix" id="btnCopiarPix">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copiar código Pix
            </button>

            <details class="pix-codigo-detalhes">
                <summary>Ver código completo</summary>
                <div class="pix-copia-cola" id="pixCopiaColaBox" role="button" tabindex="0" title="Toque para copiar">
                    <code id="pixCodigo">${escapeHtml(copiaCola)}</code>
                </div>
            </details>

            ${simulado ? `
            <button type="button" class="btn btn-secondary btn-lg btn-block" id="btnSimularPix" style="margin-top:12px">
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

    const btnCopiar = document.getElementById("btnCopiarPix");
    const boxCodigo = document.getElementById("pixCopiaColaBox");

    btnCopiar?.addEventListener("click", () => copiarCodigoPix(copiaCola, btnCopiar));
    boxCodigo?.addEventListener("click", () => copiarCodigoPix(copiaCola, btnCopiar));
    boxCodigo?.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            copiarCodigoPix(copiaCola, btnCopiar);
        }
    });

    document.getElementById("btnSimularPix")?.addEventListener("click", () => simularPagamento(pedido.id));
    if (!simulado) {
        iniciarPollingConfirmacao(pedido.id);
    }
}

function escapeHtml(texto) {
    return String(texto)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

async function copiarCodigoPix(copiaCola, btn) {
    const ok = await copiarTexto(copiaCola);
    if (ok) {
        mostrarToast("Código Pix copiado!", "sucesso");
        if (btn) {
            const labelOriginal = btn.dataset.labelOriginal || btn.innerHTML;
            btn.dataset.labelOriginal = labelOriginal;
            btn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
                Copiado!`;
            setTimeout(() => {
                btn.innerHTML = labelOriginal;
            }, 2000);
        }
        return;
    }
    mostrarAlerta("Selecione o código em \"Ver código completo\" e copie manualmente.", {
        titulo: "Não foi possível copiar",
        tipo: "aviso",
    });
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
    const maxTentativas = 72;

    const interval = setInterval(async () => {
        tentativas += 1;
        if (tentativas > maxTentativas) {
            clearInterval(interval);
            const aguardando = document.getElementById("pixAguardando");
            if (aguardando) {
                aguardando.innerHTML = `<p>Pagamento ainda não confirmado. Se você já pagou, aguarde alguns minutos ou entre em contato.</p>`;
            }
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
