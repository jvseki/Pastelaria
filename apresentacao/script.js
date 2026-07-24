const CAPTIONS = [
    "Toque nos itens para montar o carrinho. No projeto real isso é o cardápio com produtos do banco e o carrinho no navegador.",
    "Login com Google identifica o cliente sem criar senha. Pedidos ficam ligados à conta — como no login.html do sistema.",
    "Escolha entrega (taxa) ou retirada no trailer. No cadastro real o endereço é salvo após o login.",
    "Aba “Pagar agora”: CPF + confirmação geram o Pix no Mercado Pago. O pedido só entra na fila depois de pago.",
    "Painel admin: aceitar → preparo → enviar ao motoboy. Os mesmos status do admin do projeto.",
    "WhatsApp com texto pronto (cliente, itens, total, Pix pago, endereço) — igual ao botão do painel real.",
];

const TAXA_ENTREGA = 5;
let step = 0;
const totalSteps = 6;
let cart = {};
let tipoEntrega = "entrega";

const topbar = document.querySelector(".topbar");
const captionText = document.getElementById("demoCaptionText");
const panels = document.querySelectorAll(".demo-panel");
const stepBtns = document.querySelectorAll(".demo-step");
const btnPrev = document.getElementById("demoPrev");
const btnNext = document.getElementById("demoNext");
const btnRestart = document.getElementById("demoRestart");
const progressBar = document.getElementById("demoProgressBar");

function formatarPreco(v) {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function subtotal() {
    return Object.values(cart).reduce((s, i) => s + i.preco * i.qtd, 0);
}

function total() {
    return subtotal() + (tipoEntrega === "entrega" ? TAXA_ENTREGA : 0);
}

function itensLista() {
    return Object.values(cart).map((i) => `${i.qtd}× ${i.nome}`).join(" · ") || "—";
}

function renderCart() {
    const list = document.getElementById("cartList");
    const count = document.getElementById("cartCount");
    const sub = document.getElementById("cartSubtotal");
    const btn = document.getElementById("btnIrLogin");
    const items = Object.values(cart);

    if (count) count.textContent = items.reduce((s, i) => s + i.qtd, 0);
    if (sub) sub.textContent = formatarPreco(subtotal());
    if (btn) btn.disabled = items.length === 0;

    if (!list) return;
    if (!items.length) {
        list.innerHTML = `<li class="cart-empty">Nenhum item ainda — toque no cardápio.</li>`;
        return;
    }
    list.innerHTML = items
        .map(
            (i) =>
                `<li><span>${i.qtd}× ${i.nome}</span><span>${formatarPreco(i.preco * i.qtd)}</span></li>`,
        )
        .join("");
}

function syncTotals() {
    const t = formatarPreco(total());
    const elEntrega = document.getElementById("totalEntrega");
    const elPix = document.getElementById("totalPix");
    const mini = document.getElementById("cartMiniLogin");
    const adminItens = document.getElementById("adminItens");
    const temItens = Object.values(cart).length > 0;
    if (elEntrega) elEntrega.textContent = t;
    if (elPix) elPix.textContent = t;
    if (mini) {
        mini.textContent = temItens
            ? `Pedido: ${itensLista()} · ${formatarPreco(subtotal())}`
            : "Carrinho vazio — volte ao cardápio.";
    }
    if (adminItens) {
        const taxa = tipoEntrega === "entrega" ? ` · taxa R$ ${TAXA_ENTREGA},00` : " · retirada";
        adminItens.innerHTML = `${itensLista()}${taxa} · <strong>${t}</strong>`;
    }
    const end = document.getElementById("adminEndereco");
    if (end) {
        end.textContent =
            tipoEntrega === "retirada"
                ? "Retirada no trailer · onde o trailer estiver"
                : "Rua das Flores, 120 — Centro · Ref.: portão azul";
    }
}

function buildWaMessage() {
    const num = "014";
    const taxa = tipoEntrega === "entrega" ? TAXA_ENTREGA : 0;
    let msg = `*${tipoEntrega === "retirada" ? "RETIRADA" : "ENTREGA"} - Pedido #${num}*\n`;
    msg += `------------------------\n\n`;
    msg += `*Cliente:* Maria Nakachi\n`;
    msg += `*Telefone:* (18) 99700-0000\n\n`;
    msg += `*Itens do pedido:*\n`;
    Object.values(cart).forEach((i) => {
        msg += `- ${i.qtd}x ${i.nome}\n`;
    });
    if (taxa) msg += `\n*Taxa de entrega:* ${formatarPreco(taxa)}\n`;
    msg += `\n*Total:* ${formatarPreco(total())}\n`;
    msg += `*Pagamento:* Pix online (já pago)\n`;
    if (tipoEntrega === "retirada") {
        msg += `\n*Cliente vai retirar no trailer*\n`;
    } else {
        msg += `\n*Entregar em:*\nRua das Flores, 120\nCentro\nReferencia: Portão azul\n`;
    }
    msg += `\n------------------------\nPastéis Nakachi`;
    return msg;
}

function goToStep(n) {
    step = Math.max(0, Math.min(totalSteps - 1, n));

    panels.forEach((panel) => {
        panel.classList.toggle("active", Number(panel.dataset.panel) === step);
    });
    stepBtns.forEach((btn) => {
        const active = Number(btn.dataset.step) === step;
        btn.classList.toggle("active", active);
        if (active) {
            btn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
        }
    });

    if (captionText) captionText.textContent = CAPTIONS[step];
    if (progressBar) progressBar.style.width = `${((step + 1) / totalSteps) * 100}%`;

    if (btnPrev) btnPrev.disabled = step === 0;
    if (btnRestart) btnRestart.hidden = step !== totalSteps - 1;
    if (btnNext) {
        btnNext.hidden = step === totalSteps - 1;
        btnNext.textContent = "Próximo passo";
    }

    syncTotals();
    if (step === 5) {
        const wa = document.getElementById("waMessage");
        if (wa) wa.textContent = buildWaMessage();
    }

    const shell = document.getElementById("demoShell");
    if (shell && window.matchMedia("(max-width: 759px)").matches) {
        const top = shell.getBoundingClientRect().top + window.scrollY - 72;
        window.scrollTo({ top, behavior: "smooth" });
    }
}

/* Cardápio */
document.querySelectorAll(".menu-item").forEach((btn) => {
    btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const nome = btn.dataset.nome;
        const preco = Number(btn.dataset.preco);
        if (!cart[id]) cart[id] = { nome, preco, qtd: 0 };
        cart[id].qtd += 1;
        btn.classList.add("added");
        setTimeout(() => btn.classList.remove("added"), 350);
        renderCart();
        syncTotals();
    });
});

document.getElementById("btnIrLogin")?.addEventListener("click", () => goToStep(1));

/* Login */
const btnGoogle = document.getElementById("btnGoogleMock");
const loginView = document.getElementById("mockLogin");
const loginOk = document.getElementById("mockLoginOk");

btnGoogle?.addEventListener("click", () => {
    btnGoogle.disabled = true;
    btnGoogle.innerHTML = `<span class="google-g" aria-hidden="true">G</span> Conectando…`;
    setTimeout(() => {
        if (loginView) loginView.hidden = true;
        if (loginOk) loginOk.hidden = false;
        syncTotals();
    }, 650);
});

/* Entrega */
document.querySelectorAll("#tipoEntrega .choice-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        document.querySelectorAll("#tipoEntrega .choice-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        tipoEntrega = btn.dataset.tipo;
        const box = document.getElementById("enderecoBox");
        const hint = document.getElementById("entregaHint");
        if (box) box.style.display = tipoEntrega === "entrega" ? "" : "none";
        if (hint) {
            hint.textContent =
                tipoEntrega === "entrega"
                    ? "No projeto real o cliente salva o endereço após o login."
                    : "Retirada: sem taxa. O cliente busca onde o trailer estiver.";
        }
        syncTotals();
    });
});

/* Pix */
const confirmarPix = document.getElementById("confirmarPix");
const btnGerarPix = document.getElementById("btnGerarPix");
const pixAntes = document.getElementById("pixAntes");
const pixDepois = document.getElementById("pixDepois");

confirmarPix?.addEventListener("change", () => {
    if (btnGerarPix) btnGerarPix.disabled = !confirmarPix.checked;
});

btnGerarPix?.addEventListener("click", () => {
    if (pixAntes) pixAntes.hidden = true;
    if (pixDepois) pixDepois.hidden = false;
});

document.getElementById("btnCopiarPix")?.addEventListener("click", (e) => {
    e.target.textContent = "Código copiado!";
    setTimeout(() => {
        e.target.textContent = "Copiar código Pix";
    }, 1500);
});

document.getElementById("btnSimularPago")?.addEventListener("click", () => {
    goToStep(4);
    const fb = document.getElementById("adminFeedback");
    if (fb) {
        fb.hidden = false;
        fb.textContent = "Pedido chegou na fila — Pix confirmado (simulado).";
    }
});

/* Admin */
const btnAceitar = document.getElementById("btnAceitar");
const btnPreparar = document.getElementById("btnPreparar");
const btnMotoboy = document.getElementById("btnMotoboy");
const adminStatus = document.getElementById("adminStatus");
const adminFeedback = document.getElementById("adminFeedback");

btnAceitar?.addEventListener("click", () => {
    if (adminStatus) {
        adminStatus.textContent = "Em preparo";
        adminStatus.className = "status-pill is-prep";
    }
    btnAceitar.disabled = true;
    if (btnPreparar) btnPreparar.disabled = false;
    if (adminFeedback) {
        adminFeedback.hidden = false;
        adminFeedback.textContent = "Loja aceitou — pastelaria começa a preparar.";
    }
});

btnPreparar?.addEventListener("click", () => {
    if (adminStatus) {
        adminStatus.textContent = "Pronto p/ entrega";
        adminStatus.className = "status-pill is-entrega";
    }
    btnPreparar.disabled = true;
    if (btnMotoboy) btnMotoboy.disabled = false;
    if (adminFeedback) {
        adminFeedback.textContent = "Pedido pronto — pode enviar ao motoboy.";
    }
});

btnMotoboy?.addEventListener("click", () => {
    if (adminStatus) {
        adminStatus.textContent = "Saiu p/ entrega";
        adminStatus.className = "status-pill is-entrega";
    }
    goToStep(5);
});

/* Nav */
stepBtns.forEach((btn) => {
    btn.addEventListener("click", () => goToStep(Number(btn.dataset.step)));
});

btnPrev?.addEventListener("click", () => goToStep(step - 1));
btnNext?.addEventListener("click", () => goToStep(step + 1));

btnRestart?.addEventListener("click", () => {
    cart = {};
    tipoEntrega = "entrega";
    renderCart();
    if (loginView) loginView.hidden = false;
    if (loginOk) loginOk.hidden = true;
    if (btnGoogle) {
        btnGoogle.disabled = false;
        btnGoogle.innerHTML = `<span class="google-g" aria-hidden="true">G</span> Continuar com Google`;
    }
    if (pixAntes) pixAntes.hidden = false;
    if (pixDepois) pixDepois.hidden = true;
    if (confirmarPix) confirmarPix.checked = false;
    if (btnGerarPix) btnGerarPix.disabled = true;
    if (btnAceitar) btnAceitar.disabled = false;
    if (btnPreparar) btnPreparar.disabled = true;
    if (btnMotoboy) btnMotoboy.disabled = true;
    if (adminStatus) {
        adminStatus.textContent = "Aguardando aceite";
        adminStatus.className = "status-pill";
    }
    if (adminFeedback) adminFeedback.hidden = true;
    document.querySelectorAll("#tipoEntrega .choice-btn").forEach((b, i) => {
        b.classList.toggle("active", i === 0);
    });
    const box = document.getElementById("enderecoBox");
    if (box) box.style.display = "";
    goToStep(0);
});

document.querySelectorAll("[data-goto]").forEach((btn) => {
    btn.addEventListener("click", () => goToStep(Number(btn.dataset.goto)));
});

/* Scroll / reveal */
window.addEventListener(
    "scroll",
    () => topbar?.classList.toggle("is-scrolled", window.scrollY > 24),
    { passive: true },
);

const revealItems = document.querySelectorAll(
    ".section h2, .section-lead, .idea-list, .legend-list, .demo-shell, .resp-grid, .server-block, .domain-grid > div, .close-inner > *:not(.eyebrow)",
);
revealItems.forEach((el) => el.classList.add("reveal"));

const observer = new IntersectionObserver(
    (entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("is-in");
                observer.unobserve(entry.target);
            }
        });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
);
revealItems.forEach((el) => observer.observe(el));

renderCart();
syncTotals();
goToStep(0);
