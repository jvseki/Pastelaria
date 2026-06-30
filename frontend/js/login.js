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

function renderizarEstadoLogin({ clientId, scriptOk }) {
    const container = document.getElementById("googleLoginBtn");

    if (isGoogleClientIdValid(clientId) && scriptOk) {
        google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleLogin,
            auto_select: false,
            cancel_on_tap_outside: true,
            use_fedcm_for_prompt: false,
        });

        google.accounts.id.renderButton(container, {
            theme: "filled_blue",
            size: "large",
            width: Math.min(container.offsetWidth || 360, 400),
            text: "continue_with",
            locale: "pt-BR",
            shape: "pill",
        });

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
        mostrarToast("Login realizado!");
        setTimeout(redirecionarAposLogin, 400);
    } catch (error) {
        alert("Erro ao fazer login: " + error.message);
        content.style.opacity = "1";
        content.style.pointerEvents = "auto";
    }
}

const params = new URLSearchParams(window.location.search);
const redirect = params.get("redirect") || "index.html";

function redirecionarAposLogin() {
    window.location.href = redirect;
}

if (estaLogado()) {
    redirecionarAposLogin();
} else {
    document.addEventListener("DOMContentLoaded", initGoogleLogin);
}
