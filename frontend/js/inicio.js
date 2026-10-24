async function carregarInicio() {
    const destaques = document.getElementById('destaquesGrid');
    const raspadinhas = document.getElementById('raspadinhasGrid');
    for (const grid of [destaques, raspadinhas]) grid.innerHTML = '<div class="nk-state" role="status">Carregando produtos…</div>';
    try {
        produtos = aplicarImagensLocais((await api.getProdutos()).filter(p => p.ativo !== false));
        const tropical = produtos.filter(p => p.categoria === 'Raspadinhas de cana');
        const principais = produtos.filter(p => p.categoria !== 'Raspadinhas de cana').slice(0, 4);
        destaques.innerHTML = principais.length ? renderizarCardsNakachi(principais) : '<div class="nk-state">Estamos preparando nosso cardápio. Volte em breve.</div>';
        raspadinhas.innerHTML = tropical.length ? renderizarCardsNakachi(tropical) : '<div class="nk-state">Os sabores de raspadinha serão publicados aqui quando estiverem disponíveis.</div>';
    } catch {
        for (const grid of [destaques, raspadinhas]) {
            grid.innerHTML = '<div class="nk-state" role="alert"><p>Não conseguimos carregar os produtos.</p><button class="btn btn-primary">Tentar novamente</button></div>';
            grid.querySelector('button').addEventListener('click', carregarInicio);
        }
    }
}
carregarInicio();
