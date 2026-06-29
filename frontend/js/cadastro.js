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

function getTipoEntrega() {
    return localStorage.getItem("tipoEntrega") || "entrega";
}

function preencherInfoRetirada() {
    document.getElementById("lojaNomeRetirada").textContent = window.LOJA_NOME || "Pastelaria Delivery";
    document.getElementById("lojaEnderecoRetirada").textContent =
        window.LOJA_ENDERECO || "Endereço da pastelaria";
    document.getElementById("lojaMapsRetirada").href = window.LOJA_MAPS_URL || "#";
}

function selecionarTipoEntrega(tipo) {
    localStorage.setItem("tipoEntrega", tipo);

    document.querySelectorAll('input[name="tipoEntrega"]').forEach((radio) => {
        radio.checked = radio.value === tipo;
        radio.closest(".pagamento-opcao")?.classList.toggle("selected", radio.checked);
    });

    const retirada = tipo === "retirada";
    document.getElementById("retiradaInfo").classList.toggle("visible", retirada);
    document.getElementById("enderecoEntregaFields").style.display = retirada ? "none" : "block";
    ["rua", "numero", "bairro"].forEach((id) => {
        document.getElementById(id).required = !retirada;
    });
}

async function salvarCadastro(event) {
    event.preventDefault();

    const btn = document.getElementById("btnSalvar");
    const erroEl = document.getElementById("formErro");
    erroEl.style.display = "none";

    const tipoEntrega = getTipoEntrega();
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
        localStorage.setItem("tipoEntrega", tipoEntrega);

        if (tipoEntrega === "retirada") {
            await api.salvarPerfil({ nome: dados.nome, telefone: dados.telefone });
            localStorage.setItem("localRetirada", JSON.stringify({
                nome: window.LOJA_NOME || "Pastelaria Delivery",
                endereco: window.LOJA_ENDERECO || "Endereço da pastelaria",
                mapsUrl: window.LOJA_MAPS_URL || "",
            }));
            mostrarToast("Retirada selecionada!");
        } else {
            await api.salvarEndereco(dados);
            mostrarToast("Endereço salvo!");
        }

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
    preencherInfoRetirada();
    preencherFormulario();
    selecionarTipoEntrega(getTipoEntrega());
}

document.addEventListener("DOMContentLoaded", initCadastro);
