const STATUS_LABELS = {
    pendente: "Aguardando aceite",
    preparando: "Em preparo",
    entrega: "Saiu para entrega",
    finalizado: "Finalizado",
};

const STATUS_CLASSES = {
    pendente: "status-pendente",
    preparando: "status-preparando",
    entrega: "status-entrega",
    finalizado: "status-finalizado",
};

const PAGAMENTO_LABELS = {
    pix: "Pix na entrega",
    dinheiro: "Dinheiro na entrega",
    cartao: "Cartao na entrega",
};

const MOTOBOY_WHATSAPP = window.MOTOBOY_WHATSAPP || "5518997640335";

if (!protegerPaginaAdmin()) {
    throw new Error("Acesso negado");
}

let pedidos = [];
let gavetas = [];

function formatarDataBR(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR");
}

function formatarDataHoraBR(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function calcularTotal(itens) {
    return itens.reduce((s, i) => s + i.preco * i.quantidade, 0);
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
    const num = String(pedido.id).padStart(3, "0");
    const usuario = pedido.usuario || {};
    const endereco = pedido.endereco || {};
    const itens = pedido.itens || [];
    const total = calcularTotal(itens);
    const pagamento = PAGAMENTO_LABELS[pedido.pagamento] || pedido.pagamento;

    let msg = `*ENTREGA - Pedido #${num}*\n`;
    msg += `------------------------\n\n`;
    msg += `*Cliente:* ${usuario.nome || "N/A"}\n`;
    msg += `*Telefone:* ${usuario.telefone || "N/A"}\n\n`;
    msg += `*Itens do pedido:*\n`;
    itens.forEach((item) => {
        msg += `- ${item.quantidade}x ${item.nome || "Produto"}\n`;
    });
    msg += `\n*Total:* ${formatarPreco(total)}\n`;
    msg += `*Pagamento:* ${pagamento}\n`;
    if (pedido.troco) {
        msg += `*Troco para:* ${formatarPreco(pedido.troco)}\n`;
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

async function confirmarPagamento(pedidoId) {
    try {
        await api.confirmarPagamentoPedido(pedidoId);
        mostrarToast("Pagamento confirmado!");
        carregarPedidos();
    } catch (error) {
        alert("Erro ao confirmar pagamento: " + error.message);
    }
}

async function aceitarPedido(pedidoId) {
    await atualizarStatus(pedidoId, "preparando");
}

async function enviarParaMotoboy(pedidoId) {
    const pedido = pedidos.find((p) => p.id === pedidoId);
    if (!pedido) return;

    const mensagem = gerarMensagemMotoboy(pedido);
    const url = `https://wa.me/${MOTOBOY_WHATSAPP}?text=${mensagem}`;
    window.open(url, "_blank");

    if (pedido.status === "preparando") {
        await atualizarStatus(pedidoId, "entrega");
    }
}

async function atualizarStatus(pedidoId, status) {
    try {
        await api.atualizarStatusPedido(pedidoId, status);
        mostrarToast(`Status: ${STATUS_LABELS[status] || status}`);
        carregarPedidos();
    } catch (error) {
        alert("Erro ao atualizar status: " + error.message);
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
        return `<button class="btn btn-success" onclick="aceitarPedido(${pedido.id})">Aceitar pedido</button>`;
    }
    if (pedido.status === "preparando") {
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
        if (stats[key] !== undefined) stats[key]++;
    });

    const container = document.getElementById("adminStats");
    container.innerHTML = Object.entries(stats)
        .map(
            ([key, val]) => `
        <div class="stat-card">
            <div class="stat-num">${val}</div>
            <div class="stat-label">${STATUS_LABELS[key]}</div>
        </div>`
        )
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
                <p>Novos pedidos aparecem aqui. Ao fechar o dia, eles vao para a gaveta abaixo.</p>
            </div>`;
        return;
    }

    container.innerHTML = pedidos
        .map((pedido) => {
            const num = String(pedido.id).padStart(3, "0");
            const usuario = pedido.usuario || {};
            const endereco = pedido.endereco || {};
            const itens = pedido.itens || [];
            const statusKey = pedido.status === "aceito" ? "preparando" : pedido.status;
            const statusClass = STATUS_CLASSES[statusKey] || "status-pendente";
            const total = calcularTotal(itens);
            const mapsLink = gerarLinkMaps(endereco);

            return `
            <article class="pedido-admin-card">
                <div class="pedido-admin-header">
                    <h2>Pedido #${num}</h2>
                    <span class="status-badge ${statusClass}">${STATUS_LABELS[statusKey] || pedido.status}</span>
                </div>

                <div class="pedido-admin-body">
                    <div class="pedido-admin-section">
                        <h4>Cliente</h4>
                        <p>${usuario.nome || "N/A"}</p>
                        <p>${usuario.telefone || ""}</p>
                    </div>

                    <div class="pedido-admin-section">
                        <h4>Produtos</h4>
                        <ul>${itens.map((i) => `<li>${i.quantidade}x ${i.nome || "Produto"}</li>`).join("")}</ul>
                        <p><strong>Total:</strong> ${formatarPreco(total)}</p>
                    </div>

                    <div class="pedido-admin-section">
                        <h4>Pagamento</h4>
                        <p>${PAGAMENTO_LABELS[pedido.pagamento] || pedido.pagamento}</p>
                        ${pedido.troco ? `<p>Troco para: ${formatarPreco(pedido.troco)}</p>` : ""}
                        <p class="pagamento-status ${pedido.pagamento_confirmado ? "pago" : "pendente-pagamento"}">
                            ${pedido.pagamento_confirmado ? "Pagamento confirmado" : "Aguardando confirmacao do pagamento"}
                        </p>
                    </div>

                    <div class="pedido-admin-section">
                        <h4>Endereço</h4>
                        <p>${endereco.rua || ""}, ${endereco.numero || ""}</p>
                        <p>${endereco.bairro || ""}</p>
                        ${endereco.referencia ? `<p>Ref: ${endereco.referencia}</p>` : ""}
                        <a href="${mapsLink}" target="_blank" class="maps-link">Ver no Google Maps</a>
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
                <p>Quando voce clicar em "Fechar dia", os pedidos do dia ficam guardados aqui.</p>
            </div>`;
        return;
    }

    container.innerHTML = gavetas
        .map(
            (g) => `
        <article class="gaveta-card">
            <button type="button" class="gaveta-card-header" onclick="toggleGaveta(${g.id})">
                <div>
                    <strong>Gaveta #${g.id}</strong>
                    <span class="gaveta-data">${formatarDataBR(g.data_referencia)} · fechado ${formatarDataHoraBR(g.fechado_em)}</span>
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
                          const total = calcularTotal(p.itens || []);
                          return `
                <div class="gaveta-pedido-item">
                    <strong>#${String(p.id).padStart(3, "0")} — ${p.usuario?.nome || "Cliente"}</strong>
                    <span>${STATUS_LABELS[p.status] || p.status} · ${formatarPreco(total)}</span>
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
                : `Arquivar ${pedidos.length} pedido(s) na gaveta e limpar a lista de hoje?`;
        if (pedidos.length === 0) {
            alert(msg);
            return;
        }
        if (!confirm(msg)) return;
    }

    try {
        const resultado = await api.fecharDia(forcar);
        mostrarToast(resultado.mensagem || "Dia fechado!");
        await carregarPedidos();
        await carregarGavetas();
    } catch (error) {
        if (error.message.includes("em aberto") || error.message.includes("aberto")) {
            if (confirm(`${error.message}\n\nDeseja arquivar mesmo assim?`)) {
                await fecharDia(true);
            }
            return;
        }
        alert("Erro ao fechar dia: " + error.message);
    }
}

carregarPedidos();
carregarGavetas();
setInterval(carregarPedidos, 15000);
