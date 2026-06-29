function getUsuario() {
    return JSON.parse(localStorage.getItem("usuario") || "null");
}

function isAdmin() {
    const usuario = getUsuario();
    const adminEmail = (window.ADMIN_EMAIL || "").toLowerCase();
    return !!usuario?.email_google && usuario.email_google.toLowerCase() === adminEmail;
}

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
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
    if (!localStorage.getItem("token")) return;

    try {
        const usuario = await api.getMe();
        localStorage.setItem("usuario", JSON.stringify(usuario));
        await api.getEndereco();
    } catch (error) {
        if (error.message?.includes("conectar ao servidor")) {
            return;
        }
        localStorage.removeItem("token");
        localStorage.removeItem("usuario");
        localStorage.removeItem("endereco");
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
