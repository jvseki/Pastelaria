function preencherFormulario() {
    const usuario = getUsuario() || {};
    const endereco = JSON.parse(localStorage.getItem("endereco") || "null") || {};

    if (usuario.nome) document.getElementById("nome").value = usuario.nome;
    if (usuario.telefone) document.getElementById("telefone").value = usuario.telefone;
    if (endereco.rua) document.getElementById("rua").value = endereco.rua;
    if (endereco.numero) document.getElementById("numero").value = endereco.numero;
    if (endereco.bairro) document.getElementById("bairro").value = endereco.bairro;
    if (endereco.referencia) document.getElementById("referencia").value = endereco.referencia;
}

async function salvarCadastro(event) {
    event.preventDefault();

    const btn = document.getElementById("btnSalvar");
    const erroEl = document.getElementById("formErro");
    erroEl.style.display = "none";

    const dados = {
        nome: document.getElementById("nome").value.trim(),
        telefone: document.getElementById("telefone").value.trim(),
        rua: document.getElementById("rua").value.trim(),
        numero: document.getElementById("numero").value.trim(),
        bairro: document.getElementById("bairro").value.trim(),
        referencia: document.getElementById("referencia").value.trim() || null,
    };

    btn.disabled = true;
    btn.textContent = "Salvando...";

    try {
        await api.salvarEndereco(dados);
        mostrarToast("Endereço salvo!");
        window.location.href = "pagamento.html";
    } catch (error) {
        erroEl.textContent = error.message;
        erroEl.style.display = "block";
        btn.disabled = false;
        btn.textContent = "Salvar e continuar →";
    }
}

async function initCadastro() {
    if (!estaLogado()) {
        window.location.href = "login.html?redirect=cadastro.html";
        return;
    }

    await restaurarSessao();
    preencherFormulario();
}

document.addEventListener("DOMContentLoaded", initCadastro);
