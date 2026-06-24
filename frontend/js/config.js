(function () {
    const isLocal =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";

    // Local: API no seu PC | Producao: API no Render (nome do servico no render.yaml)
    window.API_URL = isLocal
        ? "http://localhost:8000"
        : "https://pastelaria-delivery-api.onrender.com";

    window.GOOGLE_CLIENT_ID =
        "19682040972-bqnoppb492er7rm8kdtlj3b6ie7ug5e3.apps.googleusercontent.com";
    window.MOTOBOY_WHATSAPP = "5518997640335";
    // Deve ser IGUAL ao ADMIN_TOKEN configurado no Render
    window.ADMIN_TOKEN = "nt2YupsBtxuRhgnqSe6ybwH-XEsCOWDH03MEuT2CBpE";
    window.ADMIN_EMAIL = "joaovictorsekimantovani@gmail.com";
    window.PIX_CHAVE = "jv.s.m2006@hotmail.com";
})();
