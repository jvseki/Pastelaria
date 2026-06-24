(function () {
    const isLocal =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";

    // Producao: URL do seu Web Service no Render (Settings → copie a URL)
    // No Vercel: Environment → API_URL = mesma URL (sem barra no final)
    window.API_URL = isLocal
        ? "http://localhost:8000"
        : "https://SUBSTITUA-PELA-SUA-URL.onrender.com";

    window.GOOGLE_CLIENT_ID =
        "19682040972-bqnoppb492er7rm8kdtlj3b6ie7ug5e3.apps.googleusercontent.com";
    window.MOTOBOY_WHATSAPP = "5518997640335";
    // Deve ser IGUAL ao ADMIN_TOKEN configurado no Render
    window.ADMIN_TOKEN = "nt2YupsBtxuRhgnqSe6ybwH-XEsCOWDH03MEuT2CBpE";
    window.ADMIN_EMAIL = "joaovictorsekimantovani@gmail.com";
    window.PIX_CHAVE = "jv.s.m2006@hotmail.com";
})();
