const ADMIN_ICON_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;

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
    removePersistedItem("endereco");
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
            removePersistedItem("endereco");
        }
        return;
    }

    try {
        await api.getEndereco();
    } catch (_) {
        /* endereco nao pode derrubar a sessao do Google */
    }
}

function aplicarPerfilUsuario() {
    const admin = isAdmin();
    document.body.classList.toggle("is-admin", admin);
    document.body.classList.toggle("is-cliente", !!getUsuario() && !admin);
}

function atualizarBannerAdmin() {
    const pagina = document.body.dataset.page || "";
    const esconder = !isAdmin() || pagina === "admin" || pagina === "login" || document.body.classList.contains("no-bottom-nav");

    let banner = document.getElementById("adminModeBanner");
    if (esconder) {
        banner?.remove();
        return;
    }

    if (!banner) {
        banner = document.createElement("div");
        banner.id = "adminModeBanner";
        banner.className = "admin-mode-banner";
        banner.innerHTML = `
            <div class="admin-mode-banner-inner">
                <span class="admin-mode-banner-dot" aria-hidden="true"></span>
                <span class="admin-mode-banner-text">Modo funcionário · visão da equipe</span>
                <a href="admin.html" class="admin-mode-banner-link">Abrir painel</a>
            </div>`;
        document.querySelector(".site-header")?.insertAdjacentElement("afterend", banner);
    }
}

function atualizarHeader() {
    const container = document.getElementById("headerActions");
    if (!container) return;

    const usuario = getUsuario();
    const paginaAtual = window.location.pathname.split("/").pop();
    let html = "";

    if (isAdmin()) {
        html += `<a href="admin.html" class="header-btn header-btn-admin header-btn-admin-desktop">Painel Admin</a>`;
    }

    if (usuario) {
        const nome = usuario.nome.split(" ")[0];

        html += `<a href="meus-pedidos.html" class="header-btn header-btn-login header-btn-pedidos">Meus pedidos</a>`;

        if (isAdmin()) {
            html += `<div class="header-user-cluster">`;
            html += `<a href="admin.html" class="header-btn header-btn-admin-compact" aria-label="Painel Admin">${ADMIN_ICON_SVG}<span>Admin</span></a>`;
            html += `<a href="conta.html" class="header-btn header-btn-user header-btn-conta">${nome}</a>`;
            html += `</div>`;
        } else {
            html += `<a href="conta.html" class="header-btn header-btn-user header-btn-conta">${nome}</a>`;
        }
    } else if (paginaAtual !== "login.html") {
        html += `<a href="login.html" class="header-btn header-btn-login">Entrar</a>`;
    }

    container.innerHTML = html;
}

function atualizarNavAdmin() {
    const pagina = document.body.dataset.page || "";

    document.querySelectorAll(".bottom-nav").forEach((nav) => {
        const contaLink = nav.querySelector(".nav-conta");
        if (!contaLink) return;

        let group = nav.querySelector(".nav-conta-group");
        let adminLink = nav.querySelector(".nav-admin");

        if (!isAdmin()) {
            adminLink?.remove();
            if (group && group.parentNode === nav) {
                nav.insertBefore(contaLink, group);
                group.remove();
            }
            return;
        }

        if (!group) {
            group = document.createElement("div");
            group.className = "nav-conta-group";
            nav.insertBefore(group, contaLink);
            group.appendChild(contaLink);
        }

        if (!adminLink) {
            adminLink = document.createElement("a");
            adminLink.href = "admin.html";
            adminLink.className = "nav-item nav-admin";
            adminLink.dataset.nav = "admin";
            adminLink.setAttribute("aria-label", "Painel administrativo");
            adminLink.innerHTML = `
                <span class="nav-icon nav-icon-admin">${ADMIN_ICON_SVG}</span>
                <span class="nav-label">Admin</span>`;
            group.appendChild(adminLink);
        }

        adminLink.classList.toggle("active", pagina === "admin");
        if (pagina === "admin") {
            contaLink.classList.remove("active");
        }
    });
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
            if (isAdmin()) link.classList.add("nav-conta-admin");
            else link.classList.remove("nav-conta-admin");
        } else {
            link.href = "login.html";
            const label = link.querySelector(".nav-label");
            if (label) label.textContent = "Conta";
            link.classList.remove("logado", "nav-conta-admin");
        }
    });

    atualizarNavAdmin();
}

document.addEventListener("DOMContentLoaded", async () => {
    await restaurarSessao();
    aplicarPerfilUsuario();
    atualizarHeader();
    atualizarNavUsuario();
    atualizarBannerAdmin();
    atualizarBadgeCarrinho();
});
