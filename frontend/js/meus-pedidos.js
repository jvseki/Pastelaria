/**
 * Meus pedidos — histórico e retomada de Pix pendente.
 */

let pixProducao = false;

const STATUS_LABELS = {
    pendente: "Aguardando confirmação",
    aguardando_pagamento: "Pagamento pendente",
    preparando: "Em preparo",
    entrega: "Saiu para entrega",
    finalizado: "Finalizado",
    cancelado: "Cancelado",
};

const STATUS_CLASS = {
    pendente: "status-pendente",
    aguardando_pagamento: "status-pagamento-pendente",
    preparando: "status-preparando",
    entrega: "status-entrega",
    finalizado: "status-finalizado",
    cancelado: "status-cancelado",
};

const PAGAMENTO_LABELS = {
    pix: "Pix ao receber",
    dinheiro: "Dinheiro ao receber",
    cartao: "Cartão ao receber",
    mercadopago: "Pix online",
};

function formatarDataPedido(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function totalPedido(pedido) {
    const itens = pedido.itens || [];
    return itens.reduce((sum, item) => sum + item.preco * item.quantidade, 0) + (pedido.taxa_entrega || 0);
}

function pedidoAguardandoPix(pedido) {
    return pedido.pagamento === "mercadopago"
        && pedido.status === "aguardando_pagamento"
        && !pedido.pagamento_confirmado;
}

function pedidoClientePodeCancelar(pedido) {
    if (pedido.status === "cancelado") return false;
    if (pedidoAguardandoPix(pedido)) return true;
    if (pedido.status === "pendente") return true;
    return false;
}

function mensagemCancelarPedido(pedido) {
    if (pedido.pagamento === "mercadopago" && pedido.pagamento_confirmado) {
        return "O pedido será cancelado e o valor pago via Pix será estornado. Pode levar alguns minutos para aparecer no banco.";
    }
    if (pedidoAguardandoPix(pedido)) {
        return "Este pedido será removido da sua lista. Como o pagamento não foi feito, não há cobrança.";
    }
    return "O pedido ainda não entrou em preparo. A pastelaria será avisada do cancelamento.";
}

function pedidoVisivel(pedido) {
    if (pedido.status !== "cancelado") return true;
    if (pedido.pagamento_confirmado) return true;
    if (pedido.mp_payment_id) return true;
    if (pedido.pagamento !== "mercadopago") return true;
    return false;
}

function renderBannerPendentes(pendentes) {
    if (!pendentes.length) return "";

    const total = pendentes.reduce((s, p) => s + totalPedido(p), 0);
    const limparTodos = pendentes.length > 1 ? `
        <button type="button" class="pedidos-pendentes-limpar" onclick="desistirTodosNaoPagos()">
            Remover todos não pagos
        </button>` : "";

    return `
        <section class="pedidos-pendentes-banner" id="pedidosPendentesBanner">
            <div class="pedidos-pendentes-banner-icon" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
            </div>
            <div class="pedidos-pendentes-banner-texto">
                <strong>${pendentes.length === 1 ? "1 pagamento pendente" : `${pendentes.length} pagamentos pendentes`}</strong>
                <span>Total em aberto: ${formatarPreco(total)} · finalize o Pix para confirmar o pedido</span>
                ${limparTodos}
            </div>
        </section>`;
}

function renderCardPagamentoPendente(pedido) {
    const numero = String(pedido.numero_dia ?? pedido.id).padStart(3, "0");
    const cpfField = pixProducao ? `
        <div class="form-group pedido-pix-cpf">
            <label for="cpfPix-${pedido.id}">CPF do pagador</label>
            <input type="text" id="cpfPix-${pedido.id}" inputmode="numeric" maxlength="14"
                placeholder="000.000.000-00" oninput="mascararCpfPix(this)">
        </div>` : "";

    return `
        <article class="pedido-pix-pendente-card" id="pedido-pendente-${pedido.id}">
            <div class="pedido-pix-pendente-header">
                <span class="pedido-pix-pendente-badge">Pix não finalizado</span>
                <span class="pedido-pix-pendente-valor">${formatarPreco(totalPedido(pedido))}</span>
            </div>
            <h2>Pedido #${numero}</h2>
            <p class="pedido-pix-pendente-desc">
                Você iniciou este pedido mas não concluiu o pagamento. Gere o QR Code novamente para finalizar.
            </p>
            ${cpfField}
            <button type="button" class="btn btn-primary btn-lg btn-block"
                onclick="finalizarPagamentoPendente(${pedido.id})">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                    <rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3z"/><path d="M20 17h1v4h-4v-1"/>
                </svg>
                Finalizar pagamento Pix
            </button>
            <button type="button" class="btn btn-ghost btn-block pedido-desistir-btn"
                onclick="cancelarPedido(${pedido.id})">
                Desistir deste pedido
            </button>
        </article>`;
}

function renderCardPedido(pedido) {
    const numero = String(pedido.numero_dia ?? pedido.id).padStart(3, "0");
    const status = pedido.status || "pendente";
    const tipoEntrega = pedido.tipo_entrega === "retirada" ? "Retirada no local" : "Entrega com motoboy";
    const itensHtml = (pedido.itens || [])
        .map((item) => `<li>${item.quantidade}x ${item.nome} — ${formatarPreco(item.preco * item.quantidade)}</li>`)
        .join("");

    const cancelarBtn = pedidoClientePodeCancelar(pedido) ? `
            <button type="button" class="btn btn-ghost btn-sm pedido-cancelar-historico"
                onclick="cancelarPedido(${pedido.id})">
                Cancelar pedido
            </button>` : "";

    return `
        <article class="form-card pedido-historico-card">
            <div class="pedido-historico-topo">
                <div>
                    <h2>Pedido #${numero}</h2>
                    <p>${formatarDataPedido(pedido.data_pedido)}</p>
                </div>
                <span class="status-badge ${STATUS_CLASS[status] || "status-pendente"}">${STATUS_LABELS[status] || status}</span>
            </div>
            <ul class="pedido-historico-itens">${itensHtml}</ul>
            ${pedido.taxa_entrega ? `<p>Taxa de entrega: ${formatarPreco(pedido.taxa_entrega)}</p>` : ""}
            <p><strong>Total:</strong> ${formatarPreco(totalPedido(pedido))}</p>
            <p><strong>Recebimento:</strong> ${tipoEntrega}</p>
            <p><strong>Pagamento:</strong> ${PAGAMENTO_LABELS[pedido.pagamento] || pedido.pagamento}</p>
            ${pedido.pagamento_confirmado && pedido.pagamento === "mercadopago"
                ? `<p class="pedido-pago-online">Pagamento Pix confirmado</p>` : ""}
            ${cancelarBtn}
        </article>`;
}

function renderizarPedidos(pedidos) {
    const container = document.getElementById("meusPedidosConteudo");
    const visiveis = pedidos.filter(pedidoVisivel);

    if (!visiveis.length) {
        container.innerHTML = `
            <div class="carrinho-vazio">
                <div class="empty-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h12v20l-6-3-6 3z"/></svg>
                </div>
                <h2>Você ainda não fez pedidos</h2>
                <p>Quando finalizar um pedido, ele aparece aqui.</p>
                <a href="cardapio.html" class="btn btn-primary" style="margin-top:20px">Ver cardápio</a>
            </div>`;
        return;
    }

    const pendentes = visiveis.filter(pedidoAguardandoPix);
    const demais = visiveis.filter((p) => !pedidoAguardandoPix(p));

    container.innerHTML = `
        ${renderBannerPendentes(pendentes)}
        ${pendentes.map(renderCardPagamentoPendente).join("")}
        ${demais.length ? `<h2 class="pedidos-historico-titulo">${pendentes.length ? "Histórico" : ""}</h2>` : ""}
        ${demais.map(renderCardPedido).join("")}
    `;

    if (pendentes.length) {
        document.getElementById("pedidosPendentesBanner")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
}

async function finalizarPagamentoPendente(pedidoId) {
    const btn = document.querySelector(`#pedido-pendente-${pedidoId} .btn-primary`);
    const cpfInput = document.getElementById(`cpfPix-${pedidoId}`);
    const cpf = cpfInput ? normalizarCpf(cpfInput.value) : null;

    if (pixProducao && (!cpf || cpf.length !== 11)) {
        mostrarAlerta("Informe um CPF válido para gerar o Pix.", { titulo: "CPF obrigatório", tipo: "aviso" });
        cpfInput?.focus();
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.textContent = "Gerando Pix...";
    }

    try {
        const resultado = await api.retomarPagamentoPix(pedidoId, cpf);
        localStorage.setItem("ultimoPedido", JSON.stringify(resultado));
        window.location.href = "pix-pagamento.html";
    } catch (error) {
        mostrarAlerta(error.message, { titulo: "Erro ao retomar pagamento", tipo: "erro" });
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                    <rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3z"/><path d="M20 17h1v4h-4v-1"/>
                </svg>
                Finalizar pagamento Pix`;
        }
    }
}

async function cancelarPedido(pedidoId) {
    const pedidos = JSON.parse(sessionStorage.getItem("_pedidosCache") || "[]");
    const pedido = pedidos.find((p) => p.id === pedidoId);
    const msg = pedido ? mensagemCancelarPedido(pedido) : "Deseja cancelar este pedido?";

    const confirmar = await confirmarAcao(msg, {
        titulo: "Cancelar pedido?",
        confirmar: "Cancelar pedido",
        cancelar: "Manter",
        tipo: "aviso",
    });
    if (!confirmar) return;

    try {
        const resultado = await api.desistirPedido(pedidoId);
        if (resultado.estornado) {
            mostrarToast("Pedido cancelado e Pix estornado.", "sucesso");
        } else {
            mostrarToast("Pedido cancelado.", "sucesso");
        }
        await carregarMeusPedidos();
    } catch (error) {
        mostrarAlerta(error.message, { titulo: "Não foi possível cancelar", tipo: "erro" });
    }
}

async function desistirTodosNaoPagos() {
    const confirmar = await confirmarAcao(
        "Todos os pedidos com Pix não finalizado serão removidos da sua lista.",
        { titulo: "Remover todos não pagos?", confirmar: "Remover todos", cancelar: "Cancelar", tipo: "aviso" },
    );
    if (!confirmar) return;

    try {
        const resultado = await api.desistirPedidosNaoPagos();
        mostrarToast(`${resultado.quantidade} pedido(s) removido(s).`, "sucesso");
        await carregarMeusPedidos();
    } catch (error) {
        mostrarAlerta(error.message, { titulo: "Não foi possível remover", tipo: "erro" });
    }
}

async function carregarMeusPedidos() {
    const container = document.getElementById("meusPedidosConteudo");
    try {
        const cfg = await api.getMercadoPagoConfig();
        pixProducao = cfg.modo === "pix_mercadopago";
        const pedidos = await api.getMeusPedidos();
        sessionStorage.setItem("_pedidosCache", JSON.stringify(pedidos));
        renderizarPedidos(pedidos);
        await atualizarBadgePedidosPendentes();
    } catch (error) {
        container.innerHTML = `
            <div class="form-card">
                <h2>Não foi possível carregar seus pedidos</h2>
                <p>${error.message}</p>
            </div>`;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    if (!estaLogado()) {
        window.location.href = "login.html?redirect=meus-pedidos.html";
        return;
    }
    carregarMeusPedidos();
});
