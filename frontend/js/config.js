(function () {
    const host = window.location.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1";
    const isVercel = host.endsWith(".vercel.app");

    if (isLocal) {
        window.API_URL = "http://localhost:8000";
    } else if (isVercel) {
        window.API_URL = "https://pastelaria-geu7.onrender.com";
    } else {
        // VPS Hostinger ou dominio proprio — API no mesmo endereco (Nginx faz proxy)
        window.API_URL = window.location.origin;
    }

    window.GOOGLE_CLIENT_ID =
        "19682040972-bqnoppb492er7rm8kdtlj3b6ie7ug5e3.apps.googleusercontent.com";
    window.MOTOBOY_WHATSAPP = "5518997640335";
    // Deve ser IGUAL ao ADMIN_TOKEN configurado no Render
    window.ADMIN_TOKEN = "nt2YupsBtxuRhgnqSe6ybwH-XEsCOWDH03MEuT2CBpE";
    window.ADMIN_EMAIL = "joaovictorsekimantovani@gmail.com";
    window.TAXA_ENTREGA = 5;
    window.LOJA_NOME = "Pastelaria Delivery";
    window.LOJA_ENDERECO = "Av. Ponta Pora, 2750 - Distrito Industrial, Tres Lagoas - MS";
    window.LOJA_MAPS_URL = "https://www.google.com/maps/search/?api=1&query=AEMS%20Faculdades%20Integradas%20de%20Tres%20Lagoas%20Av.%20Ponta%20Pora%202750";
})();
