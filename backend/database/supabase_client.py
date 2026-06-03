# Archivo: backend/database/supabase_client.py
"""
Cliente Supabase centralizado para el proyecto Acuícola Real del Meta.
Reemplaza la capa SQLite/SQLAlchemy por operaciones en Supabase.
"""

import re

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


def _ejecutar_tolerante(operacion, fila: dict):
    """
    Ejecuta una operación (insert/update) reintentando sin las columnas que el
    esquema de Supabase no reconozca (p.ej. `umbral_calidad` si la tabla aún no
    tiene la migración aplicada). Devuelve la respuesta de Supabase.
    """
    intento = dict(fila)
    for _ in range(len(fila) + 1):
        try:
            return operacion(intento)
        except Exception as e:  # noqa: BLE001 — necesitamos inspeccionar el mensaje
            mensaje = str(getattr(e, "message", "") or e)
            faltante = re.search(r"Could not find the '([^']+)' column", mensaje)
            if faltante and faltante.group(1) in intento:
                col = faltante.group(1)
                logger.warning(
                    f"La columna '{col}' no existe en el esquema; se omite y se reintenta. "
                    "Aplica la migración para persistirla."
                )
                intento.pop(col)
                continue
            raise
    raise RuntimeError("No se pudo ejecutar la operación en Supabase.")


# ── CRUD de nodos ─────────────────────────────────────────────────────────────

def listar_nodos() -> list[dict]:
    sb = get_supabase()
    res = sb.table("nodos").select("*").order("id").execute()
    return res.data or []


def crear_nodo(nodo: dict) -> dict:
    sb = get_supabase()
    res = _ejecutar_tolerante(lambda f: sb.table("nodos").insert(f).execute(), nodo)
    return res.data[0] if res.data else nodo


def actualizar_nodo(nodo_id: str, cambios: dict) -> dict:
    sb = get_supabase()
    res = _ejecutar_tolerante(
        lambda f: sb.table("nodos").update(f).eq("id", nodo_id).execute(), cambios
    )
    return res.data[0] if res.data else {}


def eliminar_nodo(nodo_id: str) -> None:
    sb = get_supabase()
    # Eliminar primero las aristas asociadas (entrantes y salientes)
    sb.table("aristas").delete().eq("id_origen", nodo_id).execute()
    sb.table("aristas").delete().eq("id_destino", nodo_id).execute()
    sb.table("nodos").delete().eq("id", nodo_id).execute()


# ── CRUD de aristas ───────────────────────────────────────────────────────────

def listar_aristas() -> list[dict]:
    sb = get_supabase()
    res = sb.table("aristas").select("*").order("id").execute()
    return res.data or []


def crear_arista(arista: dict) -> dict:
    sb = get_supabase()
    res = _ejecutar_tolerante(lambda f: sb.table("aristas").insert(f).execute(), arista)
    return res.data[0] if res.data else arista


def actualizar_arista(arista_id: int, cambios: dict) -> dict:
    sb = get_supabase()
    res = _ejecutar_tolerante(
        lambda f: sb.table("aristas").update(f).eq("id", arista_id).execute(), cambios
    )
    return res.data[0] if res.data else {}


def eliminar_arista(arista_id: int) -> None:
    sb = get_supabase()
    sb.table("aristas").delete().eq("id", arista_id).execute()


def guardar_solucion(resultado: dict) -> None:
    try:
        sb = get_supabase()
        sb.table("soluciones").insert({
            "tipo_escenario": "base",
            "ganancia_total": resultado.get("ganancia", 0.0),
            "costo_total": resultado.get("grafo", {}).get("costo_minimo", 0.0),
            "num_rutas_activas": resultado.get("grafo", {}).get("num_rutas_activas", 0),
            "porcentaje_demanda_cumplida": resultado.get("metricas", {}).get("porcentaje_demanda_cumplida", 0.0),
            "flujos_json": resultado.get("grafo", {}).get("flujos", {}),
            "stocks_json": resultado.get("grafo", {}).get("stocks", {}),
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
