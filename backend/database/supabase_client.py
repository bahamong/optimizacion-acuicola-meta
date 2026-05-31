"""
Cliente Supabase centralizado para el proyecto Acuícola Real del Meta.
Reemplaza la capa SQLite/SQLAlchemy por operaciones en Supabase.
"""

from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_KEY
from utils.logger import get_logger

logger = get_logger(__name__)

_client: Client | None = None


def get_supabase() -> Client:
    global _client
    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client


def guardar_solucion(resultado: dict) -> None:
    try:
        sb = get_supabase()
        sb.table("soluciones").insert({
            "tipo_escenario": "base",
            "ganancia_total": resultado.get("ganancia", 0.0),
            "costo_total": resultado.get("gradiente", {}).get("costo_minimo", 0.0),
            "num_rutas_activas": resultado.get("ag", {}).get("num_rutas_activas", 0),
            "porcentaje_demanda_cumplida": resultado.get("metricas", {}).get("porcentaje_demanda_cumplida", 0.0),
            "flujos_json": resultado.get("gradiente", {}).get("flujos", {}),
            "stocks_json": resultado.get("gradiente", {}).get("stocks", {}),
            "metricas_json": resultado.get("metricas", {}),
        }).execute()
    except Exception as e:
        logger.warning(f"No se pudo guardar solución en Supabase: {e}")


def guardar_escenario(tipo: str, params: dict, resultado: dict) -> None:
    try:
        sb = get_supabase()
        sb.table("escenarios_historial").insert({
            "tipo": tipo,
            "parametros_json": params,
            "ganancia_base": resultado.get("ganancia_base", 0.0),
            "ganancia_escenario": resultado.get("ganancia_escenario", 0.0),
            "impacto_absoluto": resultado.get("impacto_absoluto", 0.0),
            "impacto_porcentual": resultado.get("impacto_porcentual", 0.0),
            "resultado_json": resultado,
        }).execute()
    except Exception as e:
        logger.warning(f"No se pudo guardar escenario en Supabase: {e}")


def obtener_rutas_cache() -> dict:
    try:
        sb = get_supabase()
        res = sb.table("rutas_osrm_cache").select("ruta_key, path_json").execute()
        return {row["ruta_key"]: row["path_json"] for row in (res.data or [])}
    except Exception as e:
        logger.warning(f"Caché de rutas no disponible: {e}")
        return {}


def guardar_rutas_cache(rutas: dict) -> None:
    if not rutas:
        return
    try:
        sb = get_supabase()
        rows = [{"ruta_key": k, "path_json": v} for k, v in rutas.items()]
        sb.table("rutas_osrm_cache").upsert(rows, on_conflict="ruta_key").execute()
    except Exception as e:
        logger.warning(f"Error al guardar caché de rutas: {e}")
