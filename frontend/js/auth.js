function getUsuario() {
    try {
        return JSON.parse(getPersistedItem("usuario") || "null");
    } catch (_) {
        removePersistedItem("usuario");
        return null;
    }
}

function isAdmin() {
    const usuario = getUsuario();
    const adminEmail = (window.ADMIN_EMAIL || "").toLowerCase();
    return !!usuario?.email_google && usuario.email_google.toLowerCase() === adminEmail;
}

function logout() {
    removePersistedItem("token");
    removePersistedItem("usuario");
    localStorage.removeItem("endereco");
    window.location.href = "login.html";
}

function protegerPaginaAdmin() {
    if (!isAdmin()) {
        window.location.href = "index.html";
        return false;
    }
    return true;
}

async function restaurarSessao() {
    if (!getPersistedItem("token")) return;

    try {
        const usuario = await api.getMe();
        setPersistedItem("usuario", JSON.stringify(usuario));
    } catch (error) {
        if ([401, 403, 404].includes(error.status)) {
            removePersistedItem("token");
            removePersistedItem("usuario");
            localStorage.removeItem("endereco");
        }
        return;
    }

    try {
        await api.getEndereco();
    } catch (_) {
        /* endereco nao pode derrubar a sessao do Google */
    }
}

function atualizarHeader() {
    const container = document.getElementById("headerActions");
    if (!container) return;

    const usuario = getUsuario();
    const paginaAtual = window.location.pathname.split("/").pop();
    let html = "";

    if (isAdmin()) {
        html += `<a href="admin.html" class="header-btn header-btn-admin">Admin</a>`;
    }

    if (usuario) {
        const nome = usuario.nome.split(" ")[0];
        html += `<a href="meus-pedidos.html" class="header-btn header-btn-login">Meus pedidos</a>`;
        html += `<a href="conta.html" class="header-btn header-btn-user">${nome}</a>`;
    } else if (paginaAtual !== "login.html") {
        html += `<a href="login.html" class="header-btn header-btn-login">Entrar</a>`;
    }

    container.innerHTML = html;
}

function atualizarNavUsuario() {
    const usuario = getUsuario();
    document.querySelectorAll(".nav-conta").forEach((link) => {
        if (usuario) {
            const primeiroNome = usuario.nome.split(" ")[0];
            link.href = "conta.html";
            const label = link.querySelector(".nav-label");
            if (label) label.textContent = primeiroNome;
            link.classList.add("logado");
        } else {
            link.href = "login.html";
            const label = link.querySelector(".nav-label");
            if (label) label.textContent = "Conta";
            link.classList.remove("logado");
        }
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    await restaurarSessao();
    atualizarHeader();
    atualizarNavUsuario();
    atualizarBadgeCarrinho();
});
