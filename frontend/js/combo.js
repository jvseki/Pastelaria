/** Configuração e helpers do Combo Família */

const COMBO_SABORES = [
    "Pastel de Queijo",
    "Pastel de Carne",
    "Pastel de Frango",
    "Pastel de Palmito",
];

const COMBO_BEBIDAS = [
    "Coca-Cola Lata",
    "Agua Mineral",
    "Suco Natural",
    "Caldo de Cana",
];

const COMBO_QTD_PASTEIS = 5;
const COMBO_QTD_BEBIDAS = 2;

function isProdutoCombo(produto) {
    if (!produto) return false;
    const nome = (produto.nome || "").toLowerCase();
    return produto.categoria === "Combos" || nome.includes("combo");
}

function deduplicarCombos(lista) {
    let comboVisto = false;
    return lista.filter((p) => {
        if (!isProdutoCombo(p)) return true;
        if (comboVisto) return false;
        comboVisto = true;
        return true;
    });
}

function labelCurto(nome) {
    return nome.replace("Pastel de ", "").replace("Agua Mineral", "Água");
}

function criarSelectCombo(id, opcoes, placeholder, valor = "") {
    const opts = opcoes
        .map((o) => `<option value="${o}" ${valor === o ? "selected" : ""}>${labelCurto(o)}</option>`)
        .join("");
    return `
        <select id="${id}" class="combo-select" aria-label="${placeholder}">
            <option value="">${placeholder}</option>
            ${opts}
        </select>`;
}

function renderizarFormularioCombo() {
    let pasteisHtml = "";
    for (let i = 1; i <= COMBO_QTD_PASTEIS; i++) {
        pasteisHtml += `
            <div class="combo-slot">
                <span class="combo-slot-label">Pastel ${i}</span>
                ${criarSelectCombo(`comboPastel${i}`, COMBO_SABORES, "Sabor")}
            </div>`;
    }

    let bebidasHtml = "";
    for (let i = 1; i <= COMBO_QTD_BEBIDAS; i++) {
        bebidasHtml += `
            <div class="combo-slot">
                <span class="combo-slot-label">Bebida ${i}</span>
                ${criarSelectCombo(`comboBebida${i}`, COMBO_BEBIDAS, "Bebida")}
            </div>`;
    }

    return `
        <div class="combo-form">
            <p class="combo-form-intro">Monte seu pedido — escolha os sabores e bebidas:</p>
            <div class="combo-form-section">
                <h4>Sabores</h4>
                <div class="combo-slots">${pasteisHtml}</div>
            </div>
            <div class="combo-form-section">
                <h4>Bebidas</h4>
                <div class="combo-slots combo-slots--bebidas">${bebidasHtml}</div>
            </div>
        </div>`;
}

function lerEscolhasCombo() {
    const pasteis = [];
    for (let i = 1; i <= COMBO_QTD_PASTEIS; i++) {
        pasteis.push(document.getElementById(`comboPastel${i}`)?.value || "");
    }
    const bebidas = [];
    for (let i = 1; i <= COMBO_QTD_BEBIDAS; i++) {
        bebidas.push(document.getElementById(`comboBebida${i}`)?.value || "");
    }
    return { pasteis, bebidas };
}

function validarEscolhasCombo(escolhas) {
    if (!escolhas.pasteis.every((p) => p)) return "Escolha os 5 sabores de pastel.";
    if (!escolhas.bebidas.every((b) => b)) return "Escolha as 2 bebidas.";
    return null;
}

function resumirEscolhasCombo(escolhas) {
    const contar = (lista) => {
        const map = {};
        lista.forEach((item) => {
            const curto = labelCurto(item);
            map[curto] = (map[curto] || 0) + 1;
        });
        return Object.entries(map)
            .map(([k, v]) => (v > 1 ? `${k} x${v}` : k))
            .join(", ");
    };

    return {
        texto: `Pasteis: ${contar(escolhas.pasteis)} | Bebidas: ${contar(escolhas.bebidas)}`,
        pasteis: escolhas.pasteis,
        bebidas: escolhas.bebidas,
    };
}

function formatarDetalhesCombo(escolhas) {
    return resumirEscolhasCombo(escolhas).texto;
}
