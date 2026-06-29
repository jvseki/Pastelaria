(function () {
    const isLocal =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";

    // Producao: API no Render | Local: localhost
    window.API_URL = isLocal
        ? "http://localhost:8000"
        : "https://pastelaria-geu7.onrender.com";

    window.GOOGLE_CLIENT_ID =
        "19682040972-bqnoppb492er7rm8kdtlj3b6ie7ug5e3.apps.googleusercontent.com";
    window.MOTOBOY_WHATSAPP = "5518997640335";
    // Deve ser IGUAL ao ADMIN_TOKEN configurado no Render
    window.ADMIN_TOKEN = "nt2YupsBtxuRhgnqSe6ybwH-XEsCOWDH03MEuT2CBpE";
    window.ADMIN_EMAIL = "joaovictorsekimantovani@gmail.com";
    window.PIX_CHAVE = "";
    window.TAXA_ENTREGA = 5;
    window.LOJA_NOME = "Pastelaria Delivery";
    window.LOJA_ENDERECO = "Rua da Pastelaria, 123 - Centro, Presidente Prudente";
    window.LOJA_MAPS_URL = "https://www.google.com/maps/search/?api=1&query=Pastelaria%20Delivery%20Presidente%20Prudente";
})();
