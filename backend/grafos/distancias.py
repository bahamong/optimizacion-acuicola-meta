from __future__ import annotations

import json
import math
from dataclasses import dataclass
from typing import Dict, Optional
from urllib.parse import urlencode
from urllib.request import urlopen

import config
from models.nodo import Nodo
from utils.logger import get_logger


logger = get_logger(__name__)


@dataclass
class ResultadoDistancia:
    distancia_km: float
    fuente: str


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distancia en km entre dos coordenadas."""
    radio_tierra_km = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    return radio_tierra_km * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def distancia_haversine_vial(origen: Nodo, destino: Nodo) -> ResultadoDistancia:
    distancia = haversine_km(
        origen.latitud,
        origen.longitud,
        destino.latitud,
        destino.longitud,
    )
    return ResultadoDistancia(
        distancia_km=round(distancia * config.FACTOR_VIAL, 1),
        fuente="haversine",
    )


class CalculadorDistancias:
    """Calcula distancias entre nodos y cachea resultados OSRM en Supabase."""

    def __init__(self, fuente: Optional[str] = None, usar_cache: Optional[bool] = None):
        self.fuente = (fuente or config.FUENTE_DISTANCIA or "haversine").lower()
        self.usar_cache = (
            config.USAR_CACHE_DISTANCIAS if usar_cache is None else usar_cache
        )
        self._cache: Dict[str, object] = {}
        self._cache_pendiente: Dict[str, object] = {}

        if self.fuente == "osrm" and self.usar_cache:
            try:
                from database.supabase_client import obtener_rutas_cache

                self._cache = obtener_rutas_cache()
            except Exception as exc:  # noqa: BLE001
                logger.warning(f"No se pudo cargar cache de distancias OSRM: {exc}")
                self._cache = {}

    def distancia(self, origen: Nodo, destino: Nodo) -> ResultadoDistancia:
        if self.fuente == "osrm":
            return self._distancia_osrm_con_fallback(origen, destino)
        return distancia_haversine_vial(origen, destino)

    def guardar_cache_pendiente(self) -> None:
        if not self._cache_pendiente or not self.usar_cache:
            return
        try:
            from database.supabase_client import guardar_rutas_cache

            guardar_rutas_cache(self._cache_pendiente)
            self._cache_pendiente = {}
        except Exception as exc:  # noqa: BLE001
            logger.warning(f"No se pudo guardar cache de distancias OSRM: {exc}")

    def _cache_key(self, origen: Nodo, destino: Nodo) -> str:
        return f"distancia:{self.fuente}:{origen.id}->{destino.id}"

    def _distancia_osrm_con_fallback(
        self, origen: Nodo, destino: Nodo
    ) -> ResultadoDistancia:
        key = self._cache_key(origen, destino)
        cached = self._cache.get(key)
        if isinstance(cached, dict) and cached.get("distancia_km"):
            return ResultadoDistancia(
                distancia_km=float(cached["distancia_km"]),
                fuente=str(cached.get("fuente", "osrm_cache")),
            )

        try:
            distancia = self._consultar_osrm(origen, destino)
            resultado = ResultadoDistancia(distancia_km=distancia, fuente="osrm")
            payload = {
                "distancia_km": distancia,
                "fuente": "osrm",
                "origen": origen.id,
                "destino": destino.id,
            }
            self._cache[key] = payload
            self._cache_pendiente[key] = payload
            return resultado
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                f"OSRM fallo para {origen.id}->{destino.id}; usando haversine: {exc}"
            )
            fallback = distancia_haversine_vial(origen, destino)
            fallback.fuente = "osrm_fallback_haversine"
            return fallback

    def _consultar_osrm(self, origen: Nodo, destino: Nodo) -> float:
        query = urlencode({"overview": "false"})
        url = (
            f"{config.OSRM_BASE_URL}/"
            f"{origen.longitud},{origen.latitud};{destino.longitud},{destino.latitud}"
            f"?{query}"
        )
        with urlopen(url, timeout=config.OSRM_TIMEOUT_SEGUNDOS) as response:
            data = json.loads(response.read().decode("utf-8"))

        if data.get("code") != "Ok" or not data.get("routes"):
            raise RuntimeError(data.get("message") or data.get("code") or "OSRM sin ruta")

        metros = float(data["routes"][0]["distance"])
        return round(metros / 1000.0, 1)
