const PLACEHOLDER_CLIENT_IDS = new Set([
    "",
    "SEU_GOOGLE_CLIENT_ID",
    "seu-google-client-id.apps.googleusercontent.com",
]);

function isGoogleClientIdValid(clientId) {
    return clientId && !PLACEHOLDER_CLIENT_IDS.has(clientId);
}

function waitForGoogleScript(timeoutMs = 8000) {
    return new Promise((resolve) => {
        if (window.google?.accounts?.id) {
            resolve(true);
            return;
        }

        const started = Date.now();
        const interval = setInterval(() => {
            if (window.google?.accounts?.id) {
                clearInterval(interval);
                resolve(true);
                return;
            }
            if (Date.now() - started >= timeoutMs) {
                clearInterval(interval);
                resolve(false);
            }
        }, 100);
    });
}

async function obterGoogleClientId() {
    if (isGoogleClientIdValid(window.GOOGLE_CLIENT_ID)) {
        return window.GOOGLE_CLIENT_ID;
    }

    try {
        const config = await api.getAuthConfig();
        if (config?.google_client_id) {
            window.GOOGLE_CLIENT_ID = config.google_client_id;
            return config.google_client_id;
        }
    } catch (_) {
        /* tenta config local */
    }

    return null;
}

function renderizarUltimaConta() {
    const card = document.getElementById("ultimaContaCard");
    if (!card) return;

    const conta = getUltimaConta();
    if (!conta?.email_google) {
        card.style.display = "none";
        return;
    }

    const inicial = (conta.nome || conta.email_google)[0].toUpperCase();
    document.getElementById("ultimaContaAvatar").textContent = inicial;
    document.getElementById("ultimaContaNome").textContent = conta.nome || "Sua conta";
    document.getElementById("ultimaContaEmail").textContent = conta.email_google;

    const btn = document.getElementById("btnContinuarUltimaConta");
    if (btn) {
        const primeiroNome = (conta.nome || "sua conta").split(" ")[0];
        btn.textContent = `Continuar como ${primeiroNome}`;
    }

    card.style.display = "block";
}

function entrarComUltimaConta() {
    if (!window.google?.accounts?.id) {
        mostrarToast("Aguarde o Google carregar e tente novamente.");
        return;
    }
    google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            document.getElementById("googleLoginBtn")?.querySelector("div[role=button]")?.click();
        }
    });
}

function renderizarEstadoLogin({ clientId, scriptOk }) {
    const container = document.getElementById("googleLoginBtn");
    renderizarUltimaConta();

    if (isGoogleClientIdValid(clientId) && scriptOk) {
        const ultimaConta = getUltimaConta();
        const temUltimaConta = !!ultimaConta?.email_google;

        google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleLogin,
            auto_select: temUltimaConta,
            cancel_on_tap_outside: false,
            use_fedcm_for_prompt: false,
            itp_support: true,
            context: "signin",
            ...(temUltimaConta ? { login_hint: ultimaConta.email_google } : {}),
        });

        google.accounts.id.renderButton(container, {
            theme: "outline",
            size: "large",
            width: Math.min(container.offsetWidth || 360, 400),
            text: temUltimaConta ? "continue_with" : "signin_with",
            locale: "pt-BR",
            shape: "pill",
        });

        if (temUltimaConta) {
            setTimeout(() => google.accounts.id.prompt(), 400);
        }

        return;
    }

    let mensagem = "Não foi possível carregar o login com Google.";
    if (!scriptOk) {
        mensagem = "Não foi possível carregar o script do Google. Verifique sua conexão.";
    } else if (!isGoogleClientIdValid(clientId)) {
        mensagem = "Google OAuth não configurado. Verifique o GOOGLE_CLIENT_ID no backend/.env e reinicie a API.";
    }

    container.innerHTML = `
        <div class="login-alert">
            <p><strong>Login indisponível</strong></p>
            <p>${mensagem}</p>
        </div>`;
}

async function initGoogleLogin() {
    const loading = document.getElementById("loginLoading");
    const content = document.getElementById("loginContent");

    const [clientId, scriptOk] = await Promise.all([
        obterGoogleClientId(),
        waitForGoogleScript(),
    ]);

    loading.style.display = "none";
    content.style.display = "block";

    renderizarEstadoLogin({ clientId, scriptOk });
}

async function handleGoogleLogin(response) {
    const content = document.getElementById("loginContent");
    content.style.opacity = "0.6";
    content.style.pointerEvents = "none";

    try {
        await api.loginGoogle(response.credential);
        mostrarToast("Login realizado!", "sucesso");
        setTimeout(redirecionarAposLogin, 400);
    } catch (error) {
        mostrarAlerta(error.message, {
            titulo: "Erro ao fazer login",
            tipo: "erro",
        });
        content.style.opacity = "1";
        content.style.pointerEvents = "auto";
    }
}

const params = new URLSearchParams(window.location.search);
const destinosPermitidos = new Set(["index.html", "cardapio.html", "carrinho.html", "cadastro.html", "pagamento.html", "meus-pedidos.html", "conta.html", "admin.html"]);
const destino = params.get("redirect");
const redirect = destinosPermitidos.has(destino) ? destino : "index.html";

function redirecionarAposLogin() {
    window.location.href = redirect;
}

if (estaLogado()) {
    redirecionarAposLogin();
} else {
    document.addEventListener("DOMContentLoaded", initGoogleLogin);
}
