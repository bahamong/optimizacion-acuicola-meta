# Archivo: backend/api/rutas.py
"""
Endpoints REST de la API de Optimización — Acuícola Real del Meta.

Rutas disponibles:
  GET    /api/nodos                   → lista los nodos desde Supabase
  POST   /api/nodos                   → crea un nodo en Supabase
  PUT    /api/nodos/{id}              → actualiza un nodo en Supabase
  DELETE /api/nodos/{id}             → elimina un nodo (y sus aristas) de Supabase
  GET    /api/aristas                 → lista las aristas desde Supabase
  POST   /api/aristas                 → crea una arista en Supabase
  PUT    /api/aristas/{id}            → actualiza una arista en Supabase
  DELETE /api/aristas/{id}           → elimina una arista de Supabase
  POST /api/optimizar                 → optimización por grafos (Flujo Mínimo Costo)
  GET  /api/resultados                → retorna la última solución
  GET  /api/metricas                  → KPIs de la solución actual
  GET  /api/grafo_json                → datos del grafo para visualizar en mapa
  GET  /api/ruta_optima               → Dijkstra entre dos nodos
  GET  /api/flujo_maximo              → Ford-Fulkerson entre dos nodos
  POST /api/sensibilidad/combustible  → análisis What-If combustible
  POST /api/sensibilidad/via_cerrada  → análisis What-If vía cerrada
  POST /api/sensibilidad/calidad      → análisis What-If calidad
  POST /api/sensibilidad/todos        → ejecuta los 3 escenarios
  GET  /health                        → health check
"""

import json
import math
from typing import Dict, Optional

import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import config
from algoritmos.optimizador_grafo import OptimizadorGrafo
from algoritmos.validador import ValidadorRestricciones
from database.supabase_client import (
    guardar_solucion,
    guardar_escenario,
    obtener_rutas_cache,
    guardar_rutas_cache,
    listar_nodos,
    crear_nodo,
    actualizar_nodo,
    eliminar_nodo,
    listar_aristas,
    crear_arista,
    actualizar_arista,
    eliminar_arista,
)
from grafos.dijkstra import DijkstraCalculator
from grafos.flujo_maximo import FlujoMaximo
from models.arista import costo_total_segun_estado
from models.grafo import GrafoRed
from models.nodo import TipoNodo
from sensibilidad.escenarios import AnalizadorSensibilidad
from utils.helpers import (
    calcular_metricas_resultado,
    construir_red_acuicola,
    merma_desde_calidad,
)
from utils.logger import get_logger


logger = get_logger(__name__)
router = APIRouter()


# ── Serialización segura ──────────────────────────────────────────────────────

def _es_finito(valor) -> bool:
    """Retorna True si el valor numérico puede convertirse a JSON."""
    try:
        return math.isfinite(float(valor))
    except (TypeError, ValueError):
        return False


def _contiene_no_finito(obj) -> bool:
    """
    Detecta si un objeto contiene NaN, Infinity o -Infinity.
    Esos valores rompen JSONResponse de FastAPI.
    """
    if isinstance(obj, dict):
        return any(_contiene_no_finito(v) for v in obj.values())

    if isinstance(obj, (list, tuple, set)):
        return any(_contiene_no_finito(v) for v in obj)

    if isinstance(obj, np.ndarray):
        return _contiene_no_finito(obj.tolist())

    if isinstance(obj, np.floating):
        return not math.isfinite(float(obj))

    if isinstance(obj, float):
        return not math.isfinite(obj)

    return False


def _to_native(obj):
    """
    Convierte recursivamente tipos numpy a tipos nativos de Python y elimina
    valores no serializables como NaN, Infinity o -Infinity.
    """
    if isinstance(obj, dict):
        return {k: _to_native(v) for k, v in obj.items()}

    if isinstance(obj, (list, tuple, set)):
        return [_to_native(v) for v in obj]

    if isinstance(obj, np.bool_):
        return bool(obj)

    if isinstance(obj, np.integer):
        return int(obj)

    if isinstance(obj, np.floating):
        valor = float(obj)
        return valor if math.isfinite(valor) else None

    if isinstance(obj, np.ndarray):
        return _to_native(obj.tolist())

    if isinstance(obj, float):
        return obj if math.isfinite(obj) else None

    return obj


def _obtener_ruta_desde_resultado(resultado: dict) -> list:
    """
    Intenta encontrar la lista de nodos de la ruta sin depender de un único
    nombre de clave.
    """
    if not isinstance(resultado, dict):
        return []

    for clave in ("ruta", "camino", "nodos", "path"):
        valor = resultado.get(clave)
        if isinstance(valor, list):
            return valor

    return []


# ── Estado global de la aplicación ────────────────────────────────────────────
# La red ya no se mantiene en memoria: se reconstruye desde Supabase en cada
# operación que la necesita. Solo conservamos el último resultado de la
# optimización (para /api/resultados y el análisis de sensibilidad).

resultado_optimizacion: Optional[dict] = None
ganancia_base: float = 0.0
# Flujos de la última optimización, indexados por "origen→destino".
# Se superponen sobre el grafo recargado para que el mapa coloree las rutas.
flujos_ultimos: Dict[str, float] = {}


# ── Modelos Pydantic ──────────────────────────────────────────────────────────

class NodoInputDTO(BaseModel):
    """Nodo en el formato que envía el frontend (lat/lng)."""
    id: Optional[str] = None
    tipo: str
    nombre: str
    municipio: str = ""
    departamento: str = ""
    lat: float = 0.0
    lng: float = 0.0
    capacidad: float = 0.0
    oferta: float = 0.0
    demanda: float = 0.0
    tasa_merma: float = 0.0
    tasa_calidad: float = 1.0
    costo_operacion: float = 0.0
    precio_venta: float = 250.0


class AristaInputDTO(BaseModel):
    """Arista en el formato que envía el frontend (origen/destino/costo)."""
    origen: str
    destino: str
    costo: float = 0.0
    capacidad: float = 0.0
    distancia: float = 0.0
    estado: str = "activa"
    umbral_calidad: float = 0.0
    factor_costo: float = 1.0
    penalizacion: float = 0.0


class SensibilidadCombustibleDTO(BaseModel):
    porcentaje_aumento: float = 15.0


class SensibilidadViaDTO(BaseModel):
    id_origen: str
    id_destino: str


class SensibilidadCalidadDTO(BaseModel):
    id_acopio: str
    tasa_calidad_nueva: float = 0.2


class EscenarioCombinadoDTO(BaseModel):
    nombre: str = "Escenario personalizado"
    combustible_activo: bool = False
    combustible_pct: float = 15.0
    combustible_departamento: str = "Meta"
    vias_cerradas: list = []     # [{"id_origen": "X", "id_destino": "Y"}]
    fallos_calidad: list = []    # [{"id_acopio": "X", "tasa_calidad_nueva": 0.2}]


class RutasCacheDTO(BaseModel):
    rutas: Dict[str, list]


# ── Helpers internos ──────────────────────────────────────────────────────────

def _cargar_grafo() -> GrafoRed:
    """Reconstruye el grafo desde Supabase en cada petición (datos en vivo)."""
    grafo = construir_red_acuicola()
    if grafo is None or len(grafo.nodos) == 0:
        raise HTTPException(
            status_code=400,
            detail="No hay nodos en la base de datos. Crea nodos primero; las rutas se generan automaticamente.",
        )
    return grafo


def _nodo_a_fila(d: NodoInputDTO) -> dict:
    """Convierte el DTO del frontend a una fila de la tabla `nodos`."""
    tipo = d.tipo.lower()
    merma = merma_desde_calidad(d.tasa_calidad) if tipo == "acopio" else d.tasa_merma
    fila = {
        "tipo": tipo,
        "nombre": d.nombre,
        "municipio": d.municipio,
        "departamento": d.departamento,
        "latitud": d.lat,
        "longitud": d.lng,
        "capacidad": d.capacidad,
        "oferta": d.oferta,
        "demanda": d.demanda,
        "tasa_merma": merma,
        "tasa_calidad": d.tasa_calidad,
        "costo_operacion": d.costo_operacion,
        "precio_venta": d.precio_venta,
    }
    if d.id:
        fila["id"] = d.id
    return fila


def _fila_a_nodo(row: dict) -> dict:
    """Convierte una fila de la tabla `nodos` al formato del frontend."""
    return {
        "id": row.get("id"),
        "tipo": row.get("tipo"),
        "nombre": row.get("nombre"),
        "municipio": row.get("municipio", ""),
        "departamento": row.get("departamento", ""),
        "lat": row.get("latitud", 0.0),
        "lng": row.get("longitud", 0.0),
        "capacidad": row.get("capacidad", 0.0),
        "oferta": row.get("oferta", 0.0),
        "demanda": row.get("demanda", 0.0),
        "tasa_merma": row.get("tasa_merma", 0.0),
        "tasa_calidad": row.get("tasa_calidad", 1.0),
        "costo_operacion": row.get("costo_operacion", 0.0),
        "precio_venta": row.get("precio_venta", 250.0),
    }


def _arista_a_fila(d: AristaInputDTO) -> dict:
    """Convierte el DTO del frontend a una fila de la tabla `aristas`."""
    return {
        "id_origen": d.origen,
        "id_destino": d.destino,
        "costo_transporte": d.costo,
        "capacidad": d.capacidad,
        "distancia": d.distancia,
        "estado": d.estado,
        "umbral_calidad": d.umbral_calidad,
        "factor_costo": d.factor_costo,
        "penalizacion": d.penalizacion,
        "fuente_distancia": "manual",
        "generada_automaticamente": False,
    }


def _fila_a_arista(row: dict) -> dict:
    """Convierte una fila de la tabla `aristas` al formato del frontend."""
    costo_base = row.get("costo_transporte", 0.0)
    estado = row.get("estado", "activa")
    factor_costo = row.get("factor_costo", 1.0) or 1.0
    penalizacion = row.get("penalizacion", 0.0) or 0.0
    costo_ajustado = costo_base * factor_costo + penalizacion
    return {
        "id": row.get("id"),
        "origen": row.get("id_origen"),
        "destino": row.get("id_destino"),
        "costo": costo_base,  # costo base (editable)
        "costo_total": costo_total_segun_estado(costo_ajustado, estado),  # ajustado por estado (no editable)
        "capacidad": row.get("capacidad", 0.0),
        "distancia": row.get("distancia", 0.0),
        "estado": estado,
        "umbral_calidad": row.get("umbral_calidad", 0.0),
        "factor_costo": factor_costo,
        "penalizacion": penalizacion,
        "fuente_distancia": row.get("fuente_distancia", "manual"),
        "generada_automaticamente": row.get("generada_automaticamente", False),
    }


def _resultado_requerido() -> dict:
    if resultado_optimizacion is None:
        raise HTTPException(
            status_code=400,
            detail="No hay optimización ejecutada. Llama primero a POST /api/optimizar.",
        )
    return resultado_optimizacion


def _guardar_solucion_bd(resultado: dict) -> None:
    guardar_solucion(resultado)


def _persistir_escenario(tipo: str, params: dict, resultado: dict) -> None:
    guardar_escenario(tipo, params, resultado)


def _invalidar_optimizacion() -> None:
    """Tras modificar la red, el último resultado de optimización queda obsoleto."""
    global resultado_optimizacion, ganancia_base, flujos_ultimos
    resultado_optimizacion = None
    ganancia_base = 0.0
    flujos_ultimos = {}


def _aplicar_flujos(grafo: GrafoRed) -> None:
    """Superpone los flujos de la última optimización sobre el grafo recargado,
    para que /api/grafo_json devuelva flujo y utilización por arista."""
    for (u, v), arista in grafo.aristas.items():
        arista.flujo_actual = flujos_ultimos.get(f"{u}\u2192{v}", 0.0)


# ── Endpoints base ────────────────────────────────────────────────────────────

@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "version": "1.0",
        "proyecto": "Acuícola Real del Meta",
    }


# ── CRUD de nodos ─────────────────────────────────────────────────────────────

@router.get("/api/nodos")
def get_nodos():
    """Lista todos los nodos desde Supabase."""
    try:
        return _to_native([_fila_a_nodo(r) for r in listar_nodos()])
    except Exception as e:
        logger.error(f"Error al listar nodos: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/nodos")
def post_nodo(datos: NodoInputDTO):
    """Crea un nodo en Supabase."""
    try:
        TipoNodo(datos.tipo.lower())
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de nodo inválido: '{datos.tipo}'. Usa 'origen', 'acopio' o 'destino'.",
        )

    try:
        creado = crear_nodo(_nodo_a_fila(datos))
        _invalidar_optimizacion()
        return _to_native(_fila_a_nodo(creado))
    except Exception as e:
        logger.error(f"Error al crear nodo: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/api/nodos/{nodo_id}")
def put_nodo(nodo_id: str, datos: NodoInputDTO):
    """Actualiza un nodo existente en Supabase."""
    fila = _nodo_a_fila(datos)
    fila.pop("id", None)  # el id no se cambia en una actualización
    try:
        actualizado = actualizar_nodo(nodo_id, fila)
        if not actualizado:
            raise HTTPException(status_code=404, detail=f"Nodo '{nodo_id}' no existe.")
        _invalidar_optimizacion()
        return _to_native(_fila_a_nodo(actualizado))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al actualizar nodo: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/api/nodos/{nodo_id}")
def delete_nodo(nodo_id: str):
    """Elimina un nodo y sus aristas asociadas de Supabase."""
    try:
        eliminar_nodo(nodo_id)
        _invalidar_optimizacion()
        return {"estado": "éxito", "eliminado": nodo_id}
    except Exception as e:
        logger.error(f"Error al eliminar nodo: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ── CRUD de aristas ───────────────────────────────────────────────────────────

@router.get("/api/aristas")
def get_aristas():
    """Lista todas las aristas desde Supabase."""
    try:
        return _to_native([_fila_a_arista(r) for r in listar_aristas()])
    except Exception as e:
        logger.error(f"Error al listar aristas: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/aristas")
def post_arista(datos: AristaInputDTO):
    """Crea una arista en Supabase."""
    if datos.origen == datos.destino:
        raise HTTPException(status_code=400, detail="Origen y destino deben ser distintos.")
    try:
        creada = crear_arista(_arista_a_fila(datos))
        _invalidar_optimizacion()
        return _to_native(_fila_a_arista(creada))
    except Exception as e:
        logger.error(f"Error al crear arista: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/api/aristas/{arista_id}")
def put_arista(arista_id: int, datos: AristaInputDTO):
    """Actualiza una arista existente en Supabase."""
    try:
        actualizada = actualizar_arista(arista_id, _arista_a_fila(datos))
        if not actualizada:
            raise HTTPException(status_code=404, detail=f"Arista '{arista_id}' no existe.")
        _invalidar_optimizacion()
        return _to_native(_fila_a_arista(actualizada))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al actualizar arista: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/api/aristas/{arista_id}")
def delete_arista(arista_id: int):
    """Elimina una arista de Supabase."""
    try:
        eliminar_arista(arista_id)
        _invalidar_optimizacion()
        return {"estado": "éxito", "eliminado": arista_id}
    except Exception as e:
        logger.error(f"Error al eliminar arista: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ── Optimización ──────────────────────────────────────────────────────────────

@router.post("/api/optimizar")
def optimizar():
    """
    Ejecuta la optimización por grafos:
      1. Flujo de Mínimo Costo (max_flow_min_cost)
      2. Validación de restricciones
      3. Cálculo de métricas finales
    """
    global resultado_optimizacion, ganancia_base, flujos_ultimos

    grafo = _cargar_grafo()

    try:
        logger.info("=== Iniciando optimización por grafos ===")

        opt = OptimizadorGrafo(grafo)
        resultado_grafo = opt.ejecutar()

        # Guardar los flujos para superponerlos al recargar el grafo en el mapa.
        flujos_ultimos = {
            f"{a.id_origen}\u2192{a.id_destino}": a.flujo_actual
            for a in grafo.aristas.values()
        }

        flujos_dict = {
            (a.id_origen, a.id_destino): a.flujo_actual
            for a in grafo.aristas.values()
        }

        stock_dict = resultado_grafo.get("stocks", {})

        validador = ValidadorRestricciones(grafo)
        validacion = validador.validar_completo(flujos_dict, stock_dict)

        origenes = grafo.obtener_nodos_por_tipo(TipoNodo.ORIGEN)
        destinos = grafo.obtener_nodos_por_tipo(TipoNodo.DESTINO)

        dijkstra = DijkstraCalculator(grafo)
        ruta_representativa = {}

        if origenes and destinos:
            try:
                ruta_tmp = dijkstra.ruta_con_detalle(origenes[0].id, destinos[0].id)
                if not _contiene_no_finito(ruta_tmp):
                    ruta_representativa = _to_native(ruta_tmp)
            except Exception as e:
                logger.warning(f"No se pudo calcular ruta representativa: {e}")

        flujo_max_calc = FlujoMaximo(grafo)
        capacidad_red = flujo_max_calc.capacidad_red_completa()

        metricas = calcular_metricas_resultado(grafo, resultado_grafo)

        ganancia = resultado_grafo["ganancia"]
        ganancia_base = ganancia

        resultado_optimizacion = {
            "ganancia": ganancia,
            "grafo": resultado_grafo,
            "validacion": validacion,
            "metricas": metricas,
            "ruta_representativa": ruta_representativa,
            "capacidad_red": round(capacidad_red, 2) if _es_finito(capacidad_red) else 0.0,
            "aristas_criticas": dijkstra.aristas_criticas(5),
        }

        resultado_optimizacion = _to_native(resultado_optimizacion)

        _guardar_solucion_bd(resultado_optimizacion)

        logger.info(f"Optimización completada. Ganancia={ganancia:.2f}")

        return _to_native({
            "estado": "éxito",
            "ganancia": round(ganancia, 2) if _es_finito(ganancia) else 0.0,
            "costo_total": resultado_grafo.get("costo_minimo", 0.0),
            "rutas_activas": resultado_grafo["num_rutas_activas"],
            "demanda_cumplida_pct": metricas["porcentaje_demanda_cumplida"],
            "restricciones_validas": validacion["valido"],
            "mensaje": "Optimización por grafos completada.",
        })

    except Exception as e:
        logger.error(f"Error en optimizar: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/resultados")
def obtener_resultados():
    """Retorna el resultado completo de la última optimización."""
    resultado = _resultado_requerido()

    return _to_native({
        "grafo": resultado["grafo"],
        "validacion": resultado["validacion"],
        "metricas": resultado["metricas"],
        "ruta_representativa": resultado["ruta_representativa"],
        "capacidad_red": resultado["capacidad_red"],
        "aristas_criticas": resultado["aristas_criticas"],
    })


# ── Consultas de red ──────────────────────────────────────────────────────────

@router.get("/api/metricas")
def obtener_metricas():
    """KPIs de la red actual."""
    grafo = _cargar_grafo()

    return _to_native({
        "nodos_totales": len(grafo.nodos),
        "aristas_totales": len(grafo.aristas),
        "num_origenes": len(grafo.obtener_nodos_por_tipo(TipoNodo.ORIGEN)),
        "num_acopios": len(grafo.obtener_nodos_por_tipo(TipoNodo.ACOPIO)),
        "num_destinos": len(grafo.obtener_nodos_por_tipo(TipoNodo.DESTINO)),
        "oferta_total": grafo.oferta_total(),
        "demanda_total": grafo.demanda_total(),
        "conexo": grafo.validar_conectividad(),
        **(resultado_optimizacion["metricas"] if resultado_optimizacion else {}),
    })


@router.get("/api/grafo_json")
def obtener_grafo_json():
    """Retorna nodos y aristas en formato JSON para visualización en el mapa.
    Incluye los flujos de la última optimización si existe."""
    grafo = _cargar_grafo()
    _aplicar_flujos(grafo)
    return _to_native(grafo.to_dict())


@router.get("/api/ruta_optima")
def ruta_optima(destino: str, origen: Optional[str] = None):
    """
    Calcula la ruta óptima.
      - Si solo se da 'destino': encuentra la cadena completa O→A→D más económica.
      - Si se dan 'origen' y 'destino': Dijkstra directo entre los dos nodos (legacy).
    """
    grafo = _cargar_grafo()

    if destino not in grafo.nodos:
        raise HTTPException(
            status_code=404,
            detail=f"Nodo destino '{destino}' no existe.",
        )

    calc = DijkstraCalculator(grafo)

    if origen is None:
        # Modo nuevo: solo destino → mejor cadena O→A→D.
        resultado = calc.mejor_cadena_hacia_destino(destino)
    else:
        # Modo legacy: origen + destino → Dijkstra directo.
        if origen not in grafo.nodos:
            raise HTTPException(
                status_code=404,
                detail=f"Nodo origen '{origen}' no existe.",
            )
        resultado = calc.ruta_con_detalle(origen, destino)

    if not isinstance(resultado, dict) or not resultado.get("existe", False):
        detalle = (
            resultado.get("error", f"No existe ruta hacia '{destino}'.")
            if isinstance(resultado, dict)
            else "El cálculo de ruta óptima no retornó un resultado válido."
        )
        raise HTTPException(status_code=404, detail=detalle)

    ruta = _obtener_ruta_desde_resultado(resultado)
    if not ruta or len(ruta) < 2:
        raise HTTPException(
            status_code=404,
            detail=f"No existe una ruta disponible hacia '{destino}'.",
        )

    if _contiene_no_finito(resultado):
        raise HTTPException(
            status_code=404,
            detail=f"La ruta encontrada hacia '{destino}' contiene costos inválidos.",
        )

    return _to_native(resultado)


@router.get("/api/flujo_maximo")
def flujo_maximo(fuente: str, sumidero: str):
    """Calcula el flujo máximo entre dos nodos usando Edmonds-Karp."""
    grafo = _cargar_grafo()

    if fuente not in grafo.nodos:
        raise HTTPException(
            status_code=404,
            detail=f"Nodo fuente '{fuente}' no existe.",
        )

    if sumidero not in grafo.nodos:
        raise HTTPException(
            status_code=404,
            detail=f"Nodo sumidero '{sumidero}' no existe.",
        )

    calc = FlujoMaximo(grafo)
    resultado = calc.reporte(fuente, sumidero)

    return _to_native(resultado)


# ── Sensibilidad ──────────────────────────────────────────────────────────────

@router.post("/api/sensibilidad/combustible")
def sensibilidad_combustible(params: SensibilidadCombustibleDTO):
    """
    Escenario 1: aumento del costo de combustible en rutas del Meta.
    """
    grafo = _cargar_grafo()
    analizador = AnalizadorSensibilidad(grafo, ganancia_base)

    resultado = analizador.escenario_combustible(params.porcentaje_aumento)

    _persistir_escenario("combustible", params.dict(), resultado)

    return _to_native(resultado)


@router.post("/api/sensibilidad/via_cerrada")
def sensibilidad_via_cerrada(params: SensibilidadViaDTO):
    """
    Escenario 2: cierre de una vía principal.
    """
    grafo = _cargar_grafo()
    analizador = AnalizadorSensibilidad(grafo, ganancia_base)

    resultado = analizador.escenario_via_cerrada(
        params.id_origen,
        params.id_destino,
    )

    _persistir_escenario("via_cerrada", params.dict(), resultado)

    return _to_native(resultado)


@router.post("/api/sensibilidad/calidad")
def sensibilidad_calidad(params: SensibilidadCalidadDTO):
    """
    Escenario 3: pérdida de calidad en un centro de acopio.
    """
    grafo = _cargar_grafo()
    analizador = AnalizadorSensibilidad(grafo, ganancia_base)

    resultado = analizador.escenario_fallo_calidad(
        params.id_acopio,
        params.tasa_calidad_nueva,
    )

    _persistir_escenario("calidad", params.dict(), resultado)

    return _to_native(resultado)


@router.post("/api/sensibilidad/todos")
def sensibilidad_todos():
    """
    Ejecuta los 3 escenarios de análisis de sensibilidad automáticamente.
    """
    grafo = _cargar_grafo()
    analizador = AnalizadorSensibilidad(grafo, ganancia_base)

    return _to_native(analizador.ejecutar_todos())


@router.post("/api/sensibilidad/combinado")
def sensibilidad_combinado(params: EscenarioCombinadoDTO):
    """
    Escenario What-If con múltiples condiciones simultáneas (combustible +
    vías cerradas + fallos de calidad). Retorna el grafo con problemas y el
    grafo optimizado.
    """
    grafo = _cargar_grafo()
    analizador = AnalizadorSensibilidad(grafo, ganancia_base)

    from sensibilidad.escenarios import ParametrosEscenario

    p = ParametrosEscenario(
        nombre=params.nombre,
        combustible_activo=params.combustible_activo,
        combustible_pct=params.combustible_pct,
        combustible_departamento=params.combustible_departamento,
        vias_cerradas=params.vias_cerradas,
        fallos_calidad=params.fallos_calidad,
    )
    resultado = analizador.ejecutar_escenario_combinado(p)
    _persistir_escenario("combinado", params.dict(), resultado)

    return _to_native(resultado)


@router.post("/api/sensibilidad/analisis_ia")
def analisis_ia_escenario(resultado: dict):
    """
    Recibe el resultado de un escenario y retorna un análisis narrativo
    generado con Google Gemini.
    """
    try:
        from utils.ia_analista import analizar_escenario_con_ia

        interpretacion = analizar_escenario_con_ia(resultado)
    except Exception as e:
        logger.error(f"Error en análisis IA: {e}")
        interpretacion = f"Error en análisis de IA: {str(e)}"

    return _to_native({
        "interpretacion": interpretacion,
        "modelo": config.GOOGLE_AI_MODEL,
    })


# ── Caché de rutas OSRM ───────────────────────────────────────────────────────

@router.get("/api/rutas_cache")
def get_rutas_cache():
    """Devuelve las rutas OSRM cacheadas en Supabase."""
    return _to_native(obtener_rutas_cache())


@router.post("/api/rutas_cache")
def post_rutas_cache(datos: RutasCacheDTO):
    """Guarda rutas OSRM calculadas en Supabase para no recalcularlas."""
    guardar_rutas_cache(datos.rutas)

    return {
        "estado": "éxito",
        "guardadas": len(datos.rutas),
    }
