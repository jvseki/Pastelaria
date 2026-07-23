async function initPedido() {
    const container = document.getElementById("pedidoConteudo");
    let pedido = JSON.parse(localStorage.getItem("ultimoPedido") || "null");
    const params = new URLSearchParams(window.location.search);
    const mpStatus = params.get("mp");
    const pedidoIdUrl = params.get("pedido_id");

    if (!pedido && pedidoIdUrl) {
        container.innerHTML = `<div class="loading"><div class="spinner"></div>Carregando pedido...</div>`;
        return;
    }

    if (!pedido) {
        renderPedidoVazio(container);
        return;
    }

    if (pedido.pagamento === "mercadopago" && (mpStatus === "success" || mpStatus === "pending")) {
        container.innerHTML = `<div class="loading"><div class="spinner"></div>Confirmando pagamento...</div>`;
        try {
            const sync = await api.confirmarPagamentoMercadoPago(pedido.id);
            if (sync.pagamento_confirmado) {
                pedido.status = "pendente";
                pedido.pagamento_confirmado = true;
            } else if (sync.pedido_status) {
                pedido.status = sync.pedido_status;
            }
            localStorage.setItem("ultimoPedido", JSON.stringify(pedido));
        } catch (_) {
            /* mantém dados locais se sync falhar */
        }
        window.history.replaceState({}, "", "pedido.html");
    }

    renderPedido(pedido, mpStatus, container);
}

function renderPedidoVazio(container) {
    container.innerHTML = `
        <div class="carrinho-vazio">
            <div class="empty-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <h2>Nenhum pedido encontrado</h2>
            <a href="cardapio.html" class="btn btn-primary" style="margin-top:20px">Ver cardápio</a>
        </div>`;
}

function renderPedido(pedido, mpStatus, container) {
    const numPedido = String(pedido.numero_dia ?? pedido.id).padStart(3, "0");
    const pagamentoLabels = {
        pix: "Pix ao receber",
        dinheiro: "Dinheiro ao receber",
        cartao: "Cartao ao receber",
        mercadopago: "Pix online",
    };
    const itens = pedido.itens || [];
    const taxaEntrega = pedido.taxa_entrega || 0;
    const total = itens.reduce((s, i) => s + i.preco * i.quantidade, 0) + taxaEntrega;
    const tipoEntrega = pedido.tipo_entrega || "entrega";

    const statusLabels = {
        pendente: "Aguardando confirmação",
        aguardando_pagamento: "Aguardando pagamento",
        preparando: "Em preparo",
        entrega: "Saiu para entrega",
        finalizado: "Entregue",
        cancelado: "Cancelado",
    };
    const statusClass = {
        pendente: "status-pendente",
        aguardando_pagamento: "status-pendente",
        preparando: "status-preparando",
        entrega: "status-entrega",
        finalizado: "status-finalizado",
        cancelado: "status-pendente",
    };
    const st = pedido.status || "pendente";
    const isMp = pedido.pagamento === "mercadopago";

    let msgExtra = "";
    if (isMp && pedido.pagamento_confirmado) {
        msgExtra = `<p style="margin-top:12px;color:var(--success,#16a34a);font-size:0.9rem">Pagamento aprovado! Seu pedido ja entrou na fila da pastelaria.</p>`;
    } else if (isMp && st === "aguardando_pagamento") {
        msgExtra = `<p style="margin-top:12px;color:var(--text-muted);font-size:0.9rem">Pagamento Pix ainda nao confirmado. <a href="pix-pagamento.html">Voltar ao Pix</a></p>`;
    } else if (isMp && mpStatus === "pending") {
        msgExtra = `<p style="margin-top:12px;color:var(--text-muted);font-size:0.9rem">Pagamento em processamento. Avisaremos quando for confirmado.</p>`;
    } else if (st === "pendente" && !isMp) {
        msgExtra = `<p style="margin-top:12px;color:var(--text-muted);font-size:0.9rem">Aguardando confirmacao da pastelaria. Pagamento na entrega.</p>`;
    }

    container.innerHTML = `
        <div class="pedido-sucesso">
            <div class="success-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h2>Pedido recebido</h2>
            <p class="pedido-numero">Pedido #${numPedido}</p>
            <span class="status-badge ${statusClass[st] || "status-pendente"}">${statusLabels[st] || st}</span>
            ${msgExtra}
        </div>

        <div class="pedido-detalhes">
            <h3>Resumo do pedido</h3>
            ${itens.map((i) => `<p>${i.quantidade}x ${i.nome} — ${formatarPreco(i.preco * i.quantidade)}</p>`).join("")}
            ${taxaEntrega ? `<p>Taxa de entrega — ${formatarPreco(taxaEntrega)}</p>` : ""}
            <p style="margin-top:12px;font-weight:600;color:var(--text)">Total: ${formatarPreco(total)}</p>
            <hr style="margin:12px 0;border:none;border-top:1px solid var(--border)">
            <p><strong>Recebimento:</strong> ${tipoEntrega === "retirada" ? "Retirar no local" : "Entrega com motoboy"}</p>
            ${tipoEntrega === "retirada" ? `<p style="font-size:0.88rem;color:var(--text-secondary)">${pedido.local_retirada || window.LOJA_ENDERECO || "Pastelaria"}</p>` : ""}
            <p><strong>Pagamento:</strong> ${pagamentoLabels[pedido.pagamento] || pedido.pagamento}</p>
            ${isMp
                ? `<p style="font-size:0.88rem;color:var(--text-secondary)">Pagamento via Pix online.</p>`
                : `<p style="font-size:0.88rem;color:var(--text-secondary)">Voce confirmou o pagamento ao receber ao finalizar o pedido.</p>`}
            ${pedido.troco ? `<p><strong>Troco para:</strong> ${formatarPreco(pedido.troco)}</p>` : ""}
        </div>

        <div class="page-actions pedido-acoes">
            <a href="meus-pedidos.html" class="btn btn-primary btn-lg btn-acompanhar-pedido">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Acompanhar seu pedido
            </a>
            <a href="cardapio.html" class="btn btn-secondary">Fazer novo pedido</a>
        </div>`;
}

document.addEventListener("DOMContentLoaded", initPedido);
