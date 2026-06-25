/**
 * Layout compartilhado: FAB do carrinho e navegacao ativa.
 */
function initLayout() {
    const page = document.body.dataset.page || "";

    document.querySelectorAll("[data-nav]").forEach((link) => {
        link.classList.toggle("active", link.dataset.nav === page);
    });

    if (document.body.dataset.fab === "false") return;
    if (document.getElementById("cartFab")) return;

    const fab = document.createElement("a");
    fab.href = "carrinho.html";
    fab.className = "cart-fab";
    fab.id = "cartFab";
    fab.setAttribute("aria-label", "Abrir carrinho");
    fab.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="9" cy="21" r="1.5"/>
            <circle cx="19" cy="21" r="1.5"/>
            <path d="M2 2h3l2.2 11.2a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6L22 6H6"/>
        </svg>
        <span class="cart-fab-badge nav-badge" style="display:none">0</span>`;
    document.body.appendChild(fab);
}

document.addEventListener("DOMContentLoaded", initLayout);
