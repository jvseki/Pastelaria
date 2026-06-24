def gerar_link_maps(latitude: float, longitude: float) -> str:
    return f"https://www.google.com/maps/dir/?api=1&destination={latitude},{longitude}"


def gerar_link_maps_endereco(rua: str, numero: str, bairro: str) -> str:
    from urllib.parse import quote
    endereco = f"{rua}, {numero}, {bairro}, Brasil"
    return f"https://www.google.com/maps/search/?api=1&query={quote(endereco)}"


def geocodificar_endereco(rua: str, numero: str, bairro: str, api_key: str = "") -> tuple[float | None, float | None]:
    """Retorna latitude/longitude. Usa Geocoding API se disponível."""
    if not api_key:
        return None, None

    import httpx

    endereco = f"{rua}, {numero}, {bairro}, Brasil"
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {"address": endereco, "key": api_key}

    try:
        response = httpx.get(url, params=params, timeout=10)
        data = response.json()
        if data.get("results"):
            location = data["results"][0]["geometry"]["location"]
            return location["lat"], location["lng"]
    except Exception:
        pass

    return None, None
