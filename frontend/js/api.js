const API_BASE = window.API_URL || "http://localhost:8000";

function parseApiError(detail) {
    if (typeof detail === "string") return detail;
    if (detail && typeof detail === "object" && !Array.isArray(detail)) {
        if (detail.mensagem) return detail.mensagem;
        if (detail.msg) return detail.msg;
    }
    if (Array.isArray(detail)) {
        return detail.map((d) => d.msg || JSON.stringify(d)).join(". ");
    }
    return "Erro na requisição";
}

async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const token = localStorage.getItem("token");

    const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
    };

    try {
        const response = await fetch(url, { ...options, headers });
        const text = await response.text();

        if (!response.ok) {
            let detail = "Erro na requisição";
            try {
                const error = JSON.parse(text);
                detail = parseApiError(error.detail);
            } catch (_) {
                detail = text || detail;
            }
            throw new Error(detail);
        }

        if (!text) return null;
        return JSON.parse(text);
    } catch (error) {
        if (error.message === "Failed to fetch") {
            throw new Error("Não foi possível conectar ao servidor. Verifique se a API está rodando.");
        }
        throw error;
    }
}

const api = {
    async getAuthConfig() {
        return await apiRequest("/auth/config");
    },

    async getMe() {
        return await apiRequest("/auth/me");
    },

    async getProdutos() {
        return await apiRequest("/produtos");
    },

    async loginGoogle(credential) {
        const data = await apiRequest("/auth/google", {
            method: "POST",
            body: JSON.stringify({ credential }),
        });

        localStorage.setItem("token", data.access_token);
        localStorage.setItem("usuario", JSON.stringify(data.usuario));

        try {
            await api.getEndereco();
        } catch (_) {
            /* sem endereço ainda */
        }

        return data;
    },

    async salvarPerfil(dados) {
        const data = await apiRequest("/usuarios/perfil", {
            method: "POST",
            body: JSON.stringify(dados),
        });
        localStorage.setItem("usuario", JSON.stringify(data));
        return data;
    },

    async salvarEndereco(dados) {
        const data = await apiRequest("/usuarios/endereco", {
            method: "POST",
            body: JSON.stringify(dados),
        });

        const enderecoCache = {
            id: data.id,
            rua: data.rua,
            numero: data.numero,
            bairro: data.bairro,
            referencia: data.referencia,
            latitude: data.latitude,
            longitude: data.longitude,
        };
        localStorage.setItem("endereco", JSON.stringify(enderecoCache));

        if (data.usuario) {
            localStorage.setItem("usuario", JSON.stringify(data.usuario));
        }

        return data;
    },

    async getEndereco() {
        const data = await apiRequest("/usuarios/endereco");
        if (data?.cadastrado) {
            localStorage.setItem("endereco", JSON.stringify(data));
            return data;
        }
        localStorage.removeItem("endereco");
        return null;
    },

    async criarPedido(pedido) {
        return await apiRequest("/pedidos", {
            method: "POST",
            body: JSON.stringify(pedido),
        });
    },

    async getMeusPedidos() {
        return await apiRequest("/pedidos/me");
    },

    async getPedidosAdmin() {
        const adminToken = window.ADMIN_TOKEN || localStorage.getItem("adminToken");
        return await apiRequest("/admin/pedidos", {
            headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
        });
    },

    async atualizarStatusPedido(id, status) {
        const adminToken = window.ADMIN_TOKEN || localStorage.getItem("adminToken");
        return await apiRequest(`/admin/pedidos/${id}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status }),
            headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
        });
    },

    async confirmarPagamentoPedido(id) {
        const adminToken = window.ADMIN_TOKEN || localStorage.getItem("adminToken");
        return await apiRequest(`/admin/pedidos/${id}/pagamento`, {
            method: "PATCH",
            headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
        });
    },

    async fecharDia(forcar = false) {
        const adminToken = window.ADMIN_TOKEN || localStorage.getItem("adminToken");
        return await apiRequest(`/admin/fechar-dia?forcar=${forcar ? "true" : "false"}`, {
            method: "POST",
            headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
        });
    },

    async getGavetas() {
        const adminToken = window.ADMIN_TOKEN || localStorage.getItem("adminToken");
        return await apiRequest("/admin/gavetas", {
            headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
        });
    },

    async getGaveta(id) {
        const adminToken = window.ADMIN_TOKEN || localStorage.getItem("adminToken");
        return await apiRequest(`/admin/gavetas/${id}`, {
            headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
        });
    },
};

function formatarPreco(valor) {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function mostrarToast(mensagem, tipo = "info") {
    let toast = document.getElementById("toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast";
        toast.className = "toast";
        toast.innerHTML = `
            <span class="toast-icon" aria-hidden="true"></span>
            <span class="toast-message"></span>
        `;
        document.body.appendChild(toast);
    }

    toast.className = `toast toast-${tipo}`;
    toast.querySelector(".toast-icon").textContent = tipo === "erro" ? "!" : tipo === "sucesso" ? "✓" : "i";
    toast.querySelector(".toast-message").textContent = mensagem;
    toast.classList.add("show");
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.remove("show"), 2800);
}

function criarAlertDialog() {
    let overlay = document.getElementById("alertDialog");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "alertDialog";
    overlay.className = "alert-overlay";
    overlay.innerHTML = `
        <div class="alert-card" role="dialog" aria-modal="true" aria-labelledby="alertTitle">
            <div class="alert-icon" aria-hidden="true"></div>
            <div class="alert-content">
                <h2 id="alertTitle"></h2>
                <p id="alertMessage"></p>
            </div>
            <div class="alert-actions">
                <button type="button" class="btn btn-secondary alert-cancel">Cancelar</button>
                <button type="button" class="btn btn-primary alert-confirm">OK</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
}

function mostrarAlerta(mensagem, opcoes = {}) {
    const overlay = criarAlertDialog();
    const tipo = opcoes.tipo || "info";
    const titulo = opcoes.titulo || (tipo === "erro" ? "Atenção" : "Aviso");
    const botao = opcoes.botao || "Entendi";

    overlay.className = `alert-overlay alert-${tipo}`;
    overlay.querySelector("#alertTitle").textContent = titulo;
    overlay.querySelector("#alertMessage").textContent = mensagem;
    overlay.querySelector(".alert-icon").textContent = tipo === "erro" ? "!" : tipo === "sucesso" ? "✓" : "i";
    overlay.querySelector(".alert-cancel").style.display = "none";
    overlay.querySelector(".alert-confirm").textContent = botao;

    return new Promise((resolve) => {
        const confirmar = overlay.querySelector(".alert-confirm");
        const fechar = () => {
            overlay.classList.remove("open");
            confirmar.removeEventListener("click", fechar);
            resolve(true);
        };

        confirmar.addEventListener("click", fechar);
        requestAnimationFrame(() => overlay.classList.add("open"));
        confirmar.focus();
    });
}

function confirmarAcao(mensagem, opcoes = {}) {
    const overlay = criarAlertDialog();
    const tipo = opcoes.tipo || "aviso";

    overlay.className = `alert-overlay alert-${tipo}`;
    overlay.querySelector("#alertTitle").textContent = opcoes.titulo || "Confirmar ação";
    overlay.querySelector("#alertMessage").textContent = mensagem;
    overlay.querySelector(".alert-icon").textContent = "?";
    overlay.querySelector(".alert-cancel").style.display = "";
    overlay.querySelector(".alert-cancel").textContent = opcoes.cancelar || "Cancelar";
    overlay.querySelector(".alert-confirm").textContent = opcoes.confirmar || "Confirmar";

    return new Promise((resolve) => {
        const confirmar = overlay.querySelector(".alert-confirm");
        const cancelar = overlay.querySelector(".alert-cancel");

        const fechar = (resultado) => {
            overlay.classList.remove("open");
            confirmar.removeEventListener("click", onConfirmar);
            cancelar.removeEventListener("click", onCancelar);
            resolve(resultado);
        };
        const onConfirmar = () => fechar(true);
        const onCancelar = () => fechar(false);

        confirmar.addEventListener("click", onConfirmar);
        cancelar.addEventListener("click", onCancelar);
        requestAnimationFrame(() => overlay.classList.add("open"));
        confirmar.focus();
    });
}

function getCarrinhoCount() {
    const carrinho = JSON.parse(localStorage.getItem("carrinho") || "[]");
    return carrinho.reduce((sum, item) => sum + item.quantidade, 0);
}

function atualizarBadgeCarrinho() {
    const count = getCarrinhoCount();
    document.querySelectorAll(".nav-badge, .cart-fab-badge").forEach((badge) => {
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = "flex";
        } else {
            badge.style.display = "none";
        }
    });
}

function estaLogado() {
    return !!localStorage.getItem("token");
}

function temEndereco() {
    const endereco = JSON.parse(localStorage.getItem("endereco") || "null");
    return !!(endereco && endereco.rua);
}

function verificarLogin() {
    if (!estaLogado()) {
        window.location.href = "login.html?redirect=" + encodeURIComponent(window.location.pathname.split("/").pop());
        return false;
    }
    return true;
}
