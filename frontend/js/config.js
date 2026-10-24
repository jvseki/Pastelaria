(function () {
    const host = window.location.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1";

    if (isLocal) {
        window.API_URL = "http://localhost:8000";
    } else {
        // Em hospedagem separada, configure a URL pública da SUA API aqui.
        window.API_URL = window.NAKACHI_API_URL || window.location.origin;
    }

    // Dados públicos da loja vêm de GET /loja. Nunca coloque segredos aqui.
    window.GOOGLE_CLIENT_ID = "";
    window.MOTOBOY_WHATSAPP = "";
    window.TAXA_ENTREGA = 5; // Atualizada por GET /loja; o backend valida a taxa.
    window.LOJA_NOME = "Pastéis Nakachi";
    window.LOJA_ENDERECO = "";
    window.LOJA_MAPS_URL = "";
})();
