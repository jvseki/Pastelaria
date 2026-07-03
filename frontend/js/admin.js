const STATUS_LABELS = {
    pendente: "Aguardando aceite",
    aguardando_pagamento: "Aguardando pagamento MP",
    preparando: "Em preparo",
    entrega: "Saiu para entrega",
    finalizado: "Finalizado",
    cancelado: "Cancelado",
};

const STATUS_CLASSES = {
    pendente: "status-pendente",
    preparando: "status-preparando",
    entrega: "status-entrega",
    finalizado: "status-finalizado",
};

const STAT_CONFIG = {
    pendente: { label: "Aguardando", icon: "⏳", tone: "pendente" },
    preparando: { label: "Em preparo", icon: "👨‍🍳", tone: "preparando" },
    entrega: { label: "Em entrega", icon: "🛵", tone: "entrega" },
    finalizado: { label: "Finalizados", icon: "✅", tone: "finalizado" },
};

const PAGAMENTO_LABELS = {
    pix: "Pix ao receber",
    dinheiro: "Dinheiro ao receber",
    cartao: "Cartao ao receber",
    mercadopago: "Pix online",
};

const MOTOBOY_WHATSAPP = window.MOTOBOY_WHATSAPP || "5518997640335";
const TZ_BR = "America/Sao_Paulo";

if (!protegerPaginaAdmin()) {
    throw new Error("Acesso negado");
}

let pedidos = [];
let gavetas = [];
let refreshInterval = null;

function formatarDataBR(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", {
        timeZone: TZ_BR,
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

function formatarDataCurta(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { timeZone: TZ_BR });
}

function formatarDataHoraBR(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
        timeZone: TZ_BR,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatarNumeroPedido(pedido) {
    const n = pedido.numero_dia ?? pedido.id;
    return String(n).padStart(3, "0");
}

function calcularTotal(itens) {
    return itens.reduce((s, i) => s + i.preco * i.quantidade, 0);
}

function calcularTotalPedido(pedido) {
    return calcularTotal(pedido.itens || []) + (pedido.taxa_entrega || 0);
}

function gerarLinkMaps(endereco) {
    if (endereco.latitude && endereco.longitude) {
        return `https://www.google.com/maps/dir/?api=1&destination=${endereco.latitude},${endereco.longitude}`;
    }
    const query = encodeURIComponent(
        `${endereco.rua || ""}, ${endereco.numero || ""}, ${endereco.bairro || ""}, Brasil`
    );
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function gerarMensagemMotoboy(pedido) {
    const num = formatarNumeroPedido(pedido);
    const usuario = pedido.usuario || {};
    const endereco = pedido.endereco || {};
    const itens = pedido.itens || [];
    const taxaEntrega = pedido.taxa_entrega || 0;
    const total = calcularTotal(itens) + taxaEntrega;
    const pagamento = PAGAMENTO_LABELS[pedido.pagamento] || pedido.pagamento;
    const tipoEntrega = pedido.tipo_entrega || "entrega";

    let msg = `*${tipoEntrega === "retirada" ? "RETIRADA" : "ENTREGA"} - Pedido #${num}*\n`;
    msg += `------------------------\n\n`;
    msg += `*Cliente:* ${usuario.nome || "N/A"}\n`;
    msg += `*Telefone:* ${usuario.telefone || "N/A"}\n\n`;
    msg += `*Itens do pedido:*\n`;
    itens.forEach((item) => {
        msg += `- ${item.quantidade}x ${item.nome || "Produto"}\n`;
    });
    if (pedido.observacao) {
        msg += `\n*Detalhes do combo:*\n${pedido.observacao}\n`;
    }
    if (taxaEntrega) {
        msg += `\n*Taxa de entrega:* ${formatarPreco(taxaEntrega)}\n`;
    }
    msg += `\n*Total:* ${formatarPreco(total)}\n`;
    msg += `*Pagamento:* ${pagamento}\n`;
    if (pedido.troco) {
        msg += `*Troco para:* ${formatarPreco(pedido.troco)}\n`;
    }
    if (tipoEntrega === "retirada") {
        msg += `\n*Cliente vai retirar no local:*\n`;
        msg += `${pedido.local_retirada || window.LOJA_ENDERECO || "Pastelaria"}\n`;
        msg += `\n------------------------\n`;
        msg += `Pastelaria Delivery`;
        return encodeURIComponent(msg);
    }
    msg += `\n*Entregar em:*\n`;
    msg += `${endereco.rua || ""}, ${endereco.numero || ""}\n`;
    msg += `${endereco.bairro || ""}\n`;
    if (endereco.referencia) {
        msg += `Referencia: ${endereco.referencia}\n`;
    }
    msg += `\n*Google Maps:*\n${gerarLinkMaps(endereco)}\n`;
    msg += `\n------------------------\n`;
    msg += `Pastelaria Delivery`;

    return encodeURIComponent(msg);
}

function trocarAba(tabId) {
    document.querySelectorAll(".admin-tab").forEach((btn) => {
        const ativo = btn.dataset.tab === tabId;
        btn.classList.toggle("active", ativo);
        btn.setAttribute("aria-selected", ativo ? "true" : "false");
    });

    document.querySelectorAll(".admin-tab-panel").forEach((panel) => {
        const ativo = panel.id === `tab${tabId.charAt(0).toUpperCase()}${tabId.slice(1)}`;
        panel.classList.toggle("active", ativo);
        panel.hidden = !ativo;
    });

    if (tabId === "gaveta") {
        carregarGavetas();
    }
}

function initAbas() {
    document.querySelectorAll(".admin-tab").forEach((btn) => {
        btn.addEventListener("click", () => trocarAba(btn.dataset.tab));
    });

    const hoje = new Date();
    const dataHoje = hoje.toLocaleDateString("pt-BR", {
        timeZone: TZ_BR,
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
    });
    const el = document.getElementById("dataHojeAdmin");
    if (el) el.textContent = `${dataHoje} · numeração reinicia ao fechar a gaveta`;
}

async function confirmarPagamento(pedidoId) {
    try {
        await api.confirmarPagamentoPedido(pedidoId);
        mostrarToast("Pagamento confirmado!", "sucesso");
        carregarPedidos();
    } catch (error) {
        mostrarAlerta(error.message, {
            titulo: "Erro ao confirmar pagamento",
            tipo: "erro",
        });
    }
}

async function aceitarPedido(pedidoId) {
    await atualizarStatus(pedidoId, "preparando");
}

async function recusarPedido(pedidoId) {
    const pedido = pedidos.find((p) => p.id === pedidoId);
    const pagoOnline = pedido?.pagamento === "mercadopago" && pedido?.pagamento_confirmado;
    const msg = pagoOnline
        ? "Recusar este pedido? O valor pago via Pix será estornado automaticamente no Mercado Pago."
        : "Recusar este pedido? O cliente será notificado pelo status cancelado.";

    const confirmar = await confirmarAcao(msg, {
        titulo: "Recusar pedido",
        confirmar: "Recusar",
        cancelar: "Voltar",
        tipo: "erro",
    });
    if (!confirmar) return;

    try {
        const resultado = await api.cancelarPedidoAdmin(pedidoId);
        if (resultado.estornado) {
            mostrarToast("Pedido recusado e Pix estornado.", "sucesso");
        } else {
            mostrarToast("Pedido recusado.", "sucesso");
        }
        carregarPedidos();
    } catch (error) {
        mostrarAlerta(error.message, { titulo: "Erro ao recusar pedido", tipo: "erro" });
    }
}

async function enviarParaMotoboy(pedidoId) {
    const pedido = pedidos.find((p) => p.id === pedidoId);
    if (!pedido) return;

    const mensagem = gerarMensagemMotoboy(pedido);
    const url = `https://wa.me/${MOTOBOY_WHATSAPP}?text=${mensagem}`;

    if (pedido.status === "preparando") {
        await atualizarStatus(pedidoId, "entrega");
    }

    abrirWhatsApp(url);
}

async function atualizarStatus(pedidoId, status) {
    try {
        await api.atualizarStatusPedido(pedidoId, status);
        mostrarToast(`Status: ${STATUS_LABELS[status] || status}`, "sucesso");
        carregarPedidos();
    } catch (error) {
        mostrarAlerta(error.message, {
            titulo: "Erro ao atualizar status",
            tipo: "erro",
        });
    }
}

function renderizarAcoes(pedido) {
    if (pedido.status === "finalizado") {
        const pago = pedido.pagamento_confirmado
            ? `<p class="admin-concluido">Pedido entregue · Pagamento confirmado</p>`
            : `<p class="admin-concluido">Pedido entregue</p>
               <button class="btn btn-warning" style="margin-top:10px" onclick="confirmarPagamento(${pedido.id})">Confirmar pagamento</button>`;
        return pago;
    }
    if (pedido.status === "pendente") {
        return `
            <button class="btn btn-success" onclick="aceitarPedido(${pedido.id})">Aceitar pedido</button>
            <button class="btn btn-danger" style="margin-top:8px" onclick="recusarPedido(${pedido.id})">Recusar pedido</button>`;
    }
    if (pedido.status === "aguardando_pagamento") {
        return `<p class="admin-aguardando-pix">Cliente ainda não finalizou o Pix online.</p>`;
    }
    if (pedido.status === "preparando") {
        if ((pedido.tipo_entrega || "entrega") === "retirada") {
            return `<button class="btn btn-primary" onclick="atualizarStatus(${pedido.id}, 'finalizado')">Finalizar retirada</button>`;
        }
        return `<button class="btn btn-whatsapp" onclick="enviarParaMotoboy(${pedido.id})">Enviar para motoboy</button>`;
    }
    if (pedido.status === "entrega") {
        if (!pedido.pagamento_confirmado) {
            return `
                <button class="btn btn-warning" onclick="confirmarPagamento(${pedido.id})">Confirmar pagamento</button>
                <button class="btn btn-secondary" style="margin-top:10px" onclick="atualizarStatus(${pedido.id}, 'finalizado')">Finalizar sem confirmar</button>`;
        }
        return `<button class="btn btn-primary" onclick="atualizarStatus(${pedido.id}, 'finalizado')">Finalizar pedido</button>`;
    }
    return "";
}

function renderizarStats() {
    const stats = {
        pendente: 0,
        preparando: 0,
        entrega: 0,
        finalizado: 0,
    };

    pedidos.forEach((p) => {
        const key = p.status === "aceito" ? "preparando" : p.status;
        if (key === "aguardando_pagamento") {
            stats.pendente += 1;
            return;
        }
        if (stats[key] !== undefined) stats[key]++;
    });

    const container = document.getElementById("adminStats");
    container.innerHTML = Object.entries(stats)
        .map(([key, val]) => {
            const cfg = STAT_CONFIG[key] || { label: key, icon: "•", tone: key };
            return `
        <div class="stat-card stat-card--${cfg.tone}">
            <span class="stat-card-icon" aria-hidden="true">${cfg.icon}</span>
            <div class="stat-num">${val}</div>
            <div class="stat-label">${cfg.label}</div>
        </div>`;
        })
        .join("");
}

function renderizarPedidos() {
    const container = document.getElementById("listaPedidos");

    if (pedidos.length === 0) {
        container.innerHTML = `
            <div class="admin-empty">
                <div class="empty-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
                </div>
                <h3>Nenhum pedido ativo</h3>
                <p>Novos pedidos comecam em #001. Ao fechar o dia, vao para a aba Gaveta.</p>
            </div>`;
        return;
    }

    container.innerHTML = pedidos
        .map((pedido) => {
            const num = formatarNumeroPedido(pedido);
            const usuario = pedido.usuario || {};
            const endereco = pedido.endereco || {};
            const itens = pedido.itens || [];
            const statusKey = pedido.status === "aceito" ? "preparando" : pedido.status;
            const statusClass = STATUS_CLASSES[statusKey] || "status-pendente";
            const total = calcularTotalPedido(pedido);
            const mapsLink = gerarLinkMaps(endereco);
            const tipoEntrega = pedido.tipo_entrega || "entrega";

            return `
            <article class="pedido-admin-card pedido-admin-card--${statusKey}">
                <div class="pedido-admin-header">
                    <div class="pedido-admin-ident">
                        <span class="pedido-admin-num">#${num}</span>
                        <h2>${usuario.nome || "Cliente"}</h2>
                        <p class="pedido-admin-meta">${formatarDataHoraBR(pedido.data_pedido)} · ${tipoEntrega === "retirada" ? "Retirada" : "Entrega"}</p>
                    </div>
                    <span class="status-badge ${statusClass}">${STATUS_LABELS[statusKey] || pedido.status}</span>
                </div>

                <div class="pedido-admin-body">
                    <div class="pedido-admin-section pedido-admin-section--cliente">
                        <h4>Cliente</h4>
                        <p>${usuario.nome || "N/A"}</p>
                        <p>${usuario.telefone || "Sem telefone"}</p>
                    </div>

                    <div class="pedido-admin-section pedido-admin-section--produtos">
                        <h4>Produtos</h4>
                        <ul>${itens.map((i) => `<li>${i.quantidade}x ${i.nome || "Produto"}</li>`).join("")}</ul>
                        ${pedido.observacao ? `<p class="pedido-observacao"><strong>Combo:</strong> ${pedido.observacao.replace(/\n/g, "<br>")}</p>` : ""}
                        ${pedido.taxa_entrega ? `<p>Taxa de entrega: ${formatarPreco(pedido.taxa_entrega)}</p>` : ""}
                        <p class="pedido-admin-total">Total: ${formatarPreco(total)}</p>
                    </div>

                    <div class="pedido-admin-section pedido-admin-section--pagamento">
                        <h4>Pagamento</h4>
                        <p>${PAGAMENTO_LABELS[pedido.pagamento] || pedido.pagamento}</p>
                        ${pedido.troco ? `<p>Troco para: ${formatarPreco(pedido.troco)}</p>` : ""}
                        <p class="pagamento-status ${pedido.pagamento_confirmado ? "pago" : "pendente-pagamento"}">
                            ${pedido.pagamento_confirmado ? "Pagamento confirmado" : "Aguardando confirmacao do pagamento"}
                        </p>
                    </div>

                    <div class="pedido-admin-section pedido-admin-section--endereco">
                        <h4>${tipoEntrega === "retirada" ? "Retirada" : "Endereço"}</h4>
                        ${
                            tipoEntrega === "retirada"
                                ? `<p>Cliente retira no local</p><p>${pedido.local_retirada || window.LOJA_ENDERECO || "Pastelaria"}</p>`
                                : `<p>${endereco.rua || ""}, ${endereco.numero || ""}</p>
                                   <p>${endereco.bairro || ""}</p>
                                   ${endereco.referencia ? `<p>Ref: ${endereco.referencia}</p>` : ""}
                                   <a href="${mapsLink}" target="_blank" class="maps-link">Ver no Google Maps</a>`
                        }
                    </div>
                </div>

                <div class="pedido-admin-acoes">
                    ${renderizarAcoes(pedido)}
                </div>
            </article>`;
        })
        .join("");
}

async function carregarPedidos() {
    try {
        pedidos = await api.getPedidosAdmin();
        renderizarStats();
        renderizarPedidos();
    } catch (error) {
        document.getElementById("listaPedidos").innerHTML =
            `<div class="admin-empty"><h3>Erro ao carregar pedidos</h3><p>${error.message}</p></div>`;
    }
}

function renderizarGavetas() {
    const container = document.getElementById("listaGavetas");
    if (!gavetas.length) {
        container.innerHTML = `
            <div class="admin-empty gaveta-empty">
                <h3>Gaveta vazia</h3>
                <p>Quando voce clicar em "Fechar dia", os pedidos ficam guardados aqui com a data correta.</p>
            </div>`;
        return;
    }

    container.innerHTML = gavetas
        .map(
            (g) => `
        <article class="gaveta-card">
            <button type="button" class="gaveta-card-header" onclick="toggleGaveta(${g.id})">
                <div>
                    <strong>${formatarDataBR(g.data_referencia)}</strong>
                    <span class="gaveta-data">Fechado em ${formatarDataHoraBR(g.fechado_em)}</span>
                </div>
                <div class="gaveta-resumo">
                    <span>${g.qtd_pedidos} pedido(s)</span>
                    <span class="gaveta-total">${formatarPreco(g.total_vendas)}</span>
                </div>
            </button>
            <div class="gaveta-detalhe" id="gavetaDetalhe${g.id}" style="display:none"></div>
        </article>`
        )
        .join("");
}

async function toggleGaveta(id) {
    const el = document.getElementById(`gavetaDetalhe${id}`);
    if (!el) return;

    if (el.style.display === "block") {
        el.style.display = "none";
        return;
    }

    el.style.display = "block";
    el.innerHTML = `<div class="loading"><div class="spinner"></div> Abrindo gaveta...</div>`;

    try {
        const dados = await api.getGaveta(id);
        const pedidosGaveta = dados.pedidos || [];
        el.innerHTML =
            pedidosGaveta.length === 0
                ? `<p class="gaveta-sem-itens">Nenhum pedido nesta gaveta.</p>`
                : pedidosGaveta
                      .map((p) => {
                          const total = calcularTotalPedido(p);
                          const statusKey = p.status === "aceito" ? "preparando" : p.status;
                          return `
                <div class="gaveta-pedido-detalhe">
                    <div class="gaveta-pedido-topo">
                        <strong>Pedido #${formatarNumeroPedido(p)} — ${p.usuario?.nome || "Cliente"}</strong>
                        <span>${formatarPreco(total)}</span>
                    </div>
                    <p class="gaveta-pedido-data">${formatarDataHoraBR(p.data_pedido)} · ${STATUS_LABELS[statusKey] || p.status}</p>
                    <p class="gaveta-pedido-data">${(p.itens || []).map((i) => `${i.quantidade}x ${i.nome}`).join(" · ")}</p>
                </div>`;
                      })
                      .join("");
    } catch (error) {
        el.innerHTML = `<p class="gaveta-erro">${error.message}</p>`;
    }
}

async function carregarGavetas() {
    try {
        gavetas = await api.getGavetas();
        renderizarGavetas();
    } catch (error) {
        document.getElementById("listaGavetas").innerHTML =
            `<div class="admin-empty"><p>${error.message}</p></div>`;
    }
}

async function fecharDia(forcar = false) {
    if (!forcar) {
        const msg =
            pedidos.length === 0
                ? "Nao ha pedidos ativos para arquivar."
                : `Arquivar ${pedidos.length} pedido(s) na gaveta de hoje e reiniciar a numeracao (#001)?`;
        if (pedidos.length === 0) {
            await mostrarAlerta(msg, {
                titulo: "Gaveta vazia",
                tipo: "aviso",
            });
            return;
        }
        const confirmou = await confirmarAcao(msg, {
            titulo: "Fechar dia",
            tipo: "aviso",
            confirmar: "Arquivar pedidos",
        });
        if (!confirmou) return;
    }

    try {
        const resultado = await api.fecharDia(forcar);
        mostrarToast(resultado.mensagem || "Dia fechado! Proximo pedido sera #001.", "sucesso");
        await carregarPedidos();
        await carregarGavetas();
        trocarAba("gaveta");
    } catch (error) {
        if (error.message.includes("em aberto") || error.message.includes("aberto")) {
            const confirmou = await confirmarAcao(`${error.message}\n\nDeseja arquivar mesmo assim?`, {
                titulo: "Pedidos em aberto",
                tipo: "aviso",
                confirmar: "Arquivar mesmo assim",
            });
            if (confirmou) {
                await fecharDia(true);
            }
            return;
        }
        mostrarAlerta(error.message, {
            titulo: "Erro ao fechar dia",
            tipo: "erro",
        });
    }
}

function iniciarAutoRefresh() {
    refreshInterval = setInterval(() => {
        const painel = document.getElementById("tabPedidos");
        if (painel && painel.classList.contains("active")) {
            carregarPedidos();
        }
    }, 15000);
}

initAbas();
carregarPedidos();
carregarGavetas();
iniciarAutoRefresh();
