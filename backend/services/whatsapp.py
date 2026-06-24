from urllib.parse import quote

from config import settings
from services.maps import gerar_link_maps, gerar_link_maps_endereco


PAGAMENTO_LABELS = {
    "pix": "Pix na entrega",
    "dinheiro": "Dinheiro na entrega",
    "cartao": "Cartao na entrega",
}


def _calcular_total(itens: list) -> float:
    return sum(item.get("preco", 0) * item.get("quantidade", 0) for item in itens)


def formatar_mensagem_motoboy(pedido: dict) -> str:
    num = str(pedido["id"]).zfill(3)
    usuario = pedido.get("usuario", {})
    endereco = pedido.get("endereco", {})
    itens = pedido.get("itens", [])
    total = _calcular_total(itens)
    pagamento = PAGAMENTO_LABELS.get(pedido.get("pagamento"), pedido.get("pagamento", ""))

    msg = f"*ENTREGA - Pedido #{num}*\n"
    msg += "------------------------\n\n"
    msg += f"*Cliente:* {usuario.get('nome', 'N/A')}\n"
    msg += f"*Telefone:* {usuario.get('telefone', 'N/A')}\n\n"
    msg += "*Itens do pedido:*\n"
    for item in itens:
        msg += f"- {item['quantidade']}x {item.get('nome', 'Produto')}\n"
    msg += f"\n*Total:* R$ {total:.2f}\n"
    msg += f"*Pagamento:* {pagamento}\n"
    if pedido.get("troco"):
        msg += f"*Troco para:* R$ {pedido['troco']:.2f}\n"
    msg += "\n*Entregar em:*\n"
    msg += f"{endereco.get('rua', '')}, {endereco.get('numero', '')}\n"
    msg += f"{endereco.get('bairro', '')}\n"
    if endereco.get("referencia"):
        msg += f"Referencia: {endereco['referencia']}\n"

    lat = endereco.get("latitude")
    lng = endereco.get("longitude")
    maps_link = gerar_link_maps(lat, lng) if lat and lng else gerar_link_maps_endereco(
        endereco.get("rua", ""),
        endereco.get("numero", ""),
        endereco.get("bairro", ""),
    )
    if maps_link:
        msg += f"\n*Google Maps:*\n{maps_link}\n"

    msg += "\n------------------------\n"
    msg += "Pastelaria Delivery"

    return msg


def gerar_link_whatsapp(mensagem: str, telefone: str = None) -> str:
    numero = telefone or settings.MOTOBOY_WHATSAPP
    return f"https://wa.me/{numero}?text={quote(mensagem)}"
