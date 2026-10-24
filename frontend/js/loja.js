/* Dados públicos e identidade compartilhada. Não contém credenciais. */

function urlImagemSegura(valor) {
    if (!valor || typeof valor !== 'string') return '';
    try {
        const url = new URL(valor, window.location.href);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
}

function renderizarCardsNakachi(lista) {
    return lista.map(p => `<article class="nk-product">
        <div class="nk-product-media"><img src="${escaparHtml(imagemProduto(p))}" alt="${escaparHtml(p.nome)}" loading="lazy" decoding="async"></div>
        <div class="nk-product-body"><span class="nk-product-category">${escaparHtml(p.categoria)}</span>
            <h3>${escaparHtml(p.nome)}</h3><p>${escaparHtml(p.descricao || '')}</p>
            <div class="nk-product-bottom"><span class="nk-product-price">${formatarPreco(p.preco)}</span>
                <button type="button" class="nk-product-add" data-produto-id="${Number(p.id)}" aria-label="Adicionar ${escaparHtml(p.nome)}">${isProdutoCombo(p) ? 'Montar combo' : '+ Adicionar'}</button>
            </div>
        </div></article>`).join('');
}

document.addEventListener('click', event => {
    const button = event.target.closest('[data-produto-id]');
    if (button && typeof clicarProduto === 'function') clicarProduto(Number(button.dataset.produtoId));
});
document.addEventListener('error', event => {
    const img = event.target;
    if (img.tagName === 'IMG' && img.closest('.nk-product, .modal-produto-hero') && !img.dataset.fallback) {
        img.dataset.fallback = 'true';
        img.src = 'images/produtos/padrao.svg';
    }
}, true);

async function carregarLoja() {
    const footer = document.createElement('footer');
    footer.className = 'nk-footer';
    footer.innerHTML = `<div class="nk-container nk-footer-grid">
        <div><a href="index.html" class="brand"><div class="brand-text"><span>PASTÉIS</span>Nakachi</div></a>
            <nav aria-label="Links do rodapé"><a href="cardapio.html">Cardápio</a><a href="meus-pedidos.html">Meus pedidos</a></nav></div>
        <div><h2>Encontre a gente</h2><p id="lojaEndereco">Endereço a confirmar.</p><p id="lojaContato">Contato a confirmar.</p></div>
        <div><h2>Horários</h2><p id="lojaHorarios">Horários a confirmar.</p></div>
    </div>`;
    document.body.appendChild(footer);
    try {
        const loja = await apiRequest('/loja');
        window.TAXA_ENTREGA = Number(loja.taxa_entrega);
        window.LOJA_NOME = loja.nome;
        window.LOJA_ENDERECO = loja.endereco || '';
        window.LOJA_MAPS_URL = loja.endereco ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(loja.endereco) : '';
        for (const [id, value] of [['lojaEndereco', loja.endereco], ['lojaContato', loja.contato], ['lojaHorarios', loja.horarios]]) {
            if (value) document.getElementById(id).textContent = value;
        }
        if (loja.demonstracao) {
            const notice = document.createElement('div');
            notice.className = 'nk-demo';
            notice.textContent = 'Ambiente de demonstração · Produtos, imagens e preços de exemplo. Não é o cardápio oficial.';
            document.querySelector('.site-header')?.insertAdjacentElement('afterend', notice);
        }
        const logo = urlImagemSegura(loja.logo);
        if (logo) document.querySelectorAll('.brand').forEach(brand => {
            const img = document.createElement('img');
            img.src = logo;
            img.alt = loja.nome;
            img.className = 'brand-logo';
            img.addEventListener('error', () => img.remove(), {once: true});
            brand.prepend(img);
        });
        const hero = document.getElementById('nakachiHeroImage');
        if (hero && urlImagemSegura(loja.banner)) {
            hero.dataset.originalSrc = hero.src;
            hero.addEventListener('error', () => { hero.src = hero.dataset.originalSrc; }, {once: true});
            hero.src = urlImagemSegura(loja.banner);
            hero.alt = 'Pastéis Nakachi';
        }
        const tropical = document.getElementById('raspadinhasBanner');
        if (tropical && urlImagemSegura(loja.banner_raspadinhas)) {
            tropical.src = urlImagemSegura(loja.banner_raspadinhas);
            tropical.hidden = false;
            tropical.addEventListener('error', () => { tropical.hidden = true; }, {once: true});
        }
        return loja;
    } catch {
        document.getElementById('lojaHorarios').textContent = 'Informações da loja indisponíveis no momento.';
        return null;
    }
}
window.lojaPronta = carregarLoja();
