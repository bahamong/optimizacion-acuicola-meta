# Archivo: backend/api/rutas.py
"""
Endpoints REST de la API de Optimización — Acuícola Real del Meta.

Rutas disponibles:
  POST /api/cargar_datos              → carga nodos y aristas en la red
  POST /api/cargar_red_defecto        → carga la red predeterminada desde Supabase
  POST /api/optimizar                 → ejecuta AG + Gradiente
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

import math
from typing import Dict, List, Optional

import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from algoritmos.genetico import AlgoritmoGenetico
from algoritmos.gradiente import MetodoGradiente
from algoritmos.validador import ValidadorRestricciones
from database.supabase_client import (
    guardar_solucion,
    guardar_escenario,
    obtener_rutas_cache,
    guardar_rutas_cache,
)
from grafos.dijkstra import DijkstraCalculator
from grafos.flujo_maximo import FlujoMaximo
from models.arista import Arista
from models.grafo import GrafoRed
from models.nodo import Nodo, TipoNodo
from sensibilidad.escenarios import AnalizadorSensibilidad
from utils.helpers import (
    calcular_metricas_resultado,
    construir_red_acuicola,
    distancia_vial,
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

grafo_actual: Optional[GrafoRed] = None
resultado_optimizacion: Optional[dict] = None
ganancia_base: float = 0.0


# ── Modelos Pydantic ──────────────────────────────────────────────────────────

class NodoDTO(BaseModel):
    id: str
    tipo: str
    nombre: str
    municipio: str = ""
    departamento: str = ""
    latitud: float
    longitud: float
    capacidad: float
    oferta: float = 0.0
    demanda: float = 0.0
    tasa_merma: float = 0.0
    tasa_calidad: float = 1.0
    costo_operacion: float = 0.0


class AristaDTO(BaseModel):
    id_origen: str
    id_destino: str
    costo_transporte: float
    capacidad: float
    distancia: float
    estado: str = "activa"
    umbral_calidad: float = 0.0


class CargaDatosDTO(BaseModel):
    nodos: List[NodoDTO]
    aristas: List[AristaDTO]


class SensibilidadCombustibleDTO(BaseModel):
    porcentaje_aumento: float = 15.0


class SensibilidadViaDTO(BaseModel):
    id_origen: str
    id_destino: str


class SensibilidadCalidadDTO(BaseModel):
    id_acopio: str
    tasa_calidad_nueva: float = 0.2


class RutasCacheDTO(BaseModel):
    rutas: Dict[str, list]


# ── Helpers internos ──────────────────────────────────────────────────────────

def _grafo_requerido() -> GrafoRed:
    if grafo_actual is None:
        raise HTTPException(
            status_code=400,
            detail="No hay datos cargados. Llama primero a POST /api/cargar_datos o /api/cargar_red_defecto.",
        )
    return grafo_actual


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


# ── Endpoints base ────────────────────────────────────────────────────────────

@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "version": "1.0",
        "proyecto": "Acuícola Real del Meta",
    }


@router.post("/api/cargar_red_defecto")
def cargar_red_defecto():
    """Carga la red predeterminada desde Supabase."""
    global grafo_actual, resultado_optimizacion, ganancia_base

    try:
        grafo_actual = construir_red_acuicola()
        resultado_optimizacion = None
        ganancia_base = 0.0

        return _to_native({
            "estado": "éxito",
            "nodos_cargados": len(grafo_actual.nodos),
            "aristas_cargadas": len(grafo_actual.aristas),
            "oferta_total": grafo_actual.oferta_total(),
            "demanda_total": grafo_actual.demanda_total(),
            "mensaje": "Red 'Acuícola Real del Meta' cargada correctamente.",
        })

    except Exception as e:
        logger.error(f"Error cargando red defecto: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/cargar_datos")
def cargar_datos(datos: CargaDatosDTO):
    """Carga nodos y aristas desde JSON externo."""
    global grafo_actual, resultado_optimizacion, ganancia_base

    try:
        grafo_actual = GrafoRed()

        for nd in datos.nodos:
            try:
                tipo = TipoNodo(nd.tipo.lower())
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Tipo de nodo inválido: '{nd.tipo}'. Usa 'origen', 'acopio' o 'destino'.",
                )

            merma = (
                merma_desde_calidad(nd.tasa_calidad)
                if tipo == TipoNodo.ACOPIO
                else nd.tasa_merma
            )

            nodo = Nodo(
                id=nd.id,
                tipo=tipo,
                nombre=nd.nombre,
                municipio=nd.municipio,
                departamento=nd.departamento,
                latitud=nd.latitud,
                longitud=nd.longitud,
                capacidad=nd.capacidad,
                oferta=nd.oferta,
                demanda=nd.demanda,
                tasa_merma=merma,
                tasa_calidad=nd.tasa_calidad,
                costo_operacion=nd.costo_operacion,
            )

            grafo_actual.agregar_nodo(nodo)

        vistas = set()

        for ad in datos.aristas:
            clave = (ad.id_origen, ad.id_destino)

            if clave in vistas:
                continue

            vistas.add(clave)

            dist = ad.distancia

            if not dist or dist <= 0:
                nodo_origen = grafo_actual.obtener_nodo(ad.id_origen)
                nodo_destino = grafo_actual.obtener_nodo(ad.id_destino)

                if nodo_origen and nodo_destino:
                    dist = distancia_vial(
                        nodo_origen.latitud,
                        nodo_origen.longitud,
                        nodo_destino.latitud,
                        nodo_destino.longitud,
                    )

            arista = Arista(
                id_origen=ad.id_origen,
                id_destino=ad.id_destino,
                costo_transporte=ad.costo_transporte,
                capacidad=ad.capacidad,
                distancia=dist,
                estado=ad.estado,
                umbral_calidad=ad.umbral_calidad,
            )

            grafo_actual.agregar_arista(arista)

        resultado_optimizacion = None
        ganancia_base = 0.0

        if not grafo_actual.validar_conectividad():
            logger.warning("El grafo cargado no es débilmente conexo.")

        return _to_native({
            "estado": "éxito",
            "nodos_cargados": len(grafo_actual.nodos),
            "aristas_cargadas": len(grafo_actual.aristas),
            "oferta_total": grafo_actual.oferta_total(),
            "demanda_total": grafo_actual.demanda_total(),
            "conexo": grafo_actual.validar_conectividad(),
        })

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Error en cargar_datos: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ── Optimización ──────────────────────────────────────────────────────────────

@router.post("/api/optimizar")
def optimizar():
    """
    Ejecuta la optimización híbrida:
      1. Algoritmo Genético
      2. Método de Gradiente
      3. Validación de restricciones
      4. Cálculo de métricas finales
    """
    global resultado_optimizacion, ganancia_base

    grafo = _grafo_requerido()

    try:
        logger.info("=== Iniciando optimización híbrida AG + Gradiente ===")

        ag = AlgoritmoGenetico(grafo)
        resultado_ag = ag.ejecutar()
        rutas_activas = ag.rutas_activas_del_mejor()

        grad = MetodoGradiente(grafo, rutas_activas)
        resultado_grad = grad.ejecutar()

        flujos_dict = {
            (a.id_origen, a.id_destino): a.flujo_actual
            for a in grafo.aristas.values()
        }

        stock_dict = resultado_grad.get("stocks", {})
        stock_tuples = {k: v for k, v in stock_dict.items()}

        validador = ValidadorRestricciones(grafo)
        validacion = validador.validar_completo(flujos_dict, stock_tuples)

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

        metricas = calcular_metricas_resultado(grafo, resultado_grad)

        ganancia = resultado_grad.get("ganancia", resultado_ag["mejor_fitness"])
        ganancia_base = ganancia

        resultado_optimizacion = {
            "ganancia": ganancia,
            "ag": resultado_ag,
            "gradiente": resultado_grad,
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
            "costo_total": resultado_grad.get("costo_minimo", 0.0),
            "rutas_activas": resultado_ag["num_rutas_activas"],
            "demanda_cumplida_pct": metricas["porcentaje_demanda_cumplida"],
            "restricciones_validas": validacion["valido"],
            "mensaje": "Optimización híbrida AG + Gradiente completada.",
        })

    except Exception as e:
        logger.error(f"Error en optimizar: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/resultados")
def obtener_resultados():
    """Retorna el resultado completo de la última optimización."""
    resultado = _resultado_requerido()

    return _to_native({
        "ag": {
            "mejor_fitness": resultado["ag"]["mejor_fitness"],
            "num_rutas_activas": resultado["ag"]["num_rutas_activas"],
            "num_rutas_total": resultado["ag"]["num_rutas_total"],
            "rutas_activas": resultado["ag"]["rutas_activas"],
            "historial_fitness": resultado["ag"]["historial_fitness"],
        },
        "gradiente": resultado["gradiente"],
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
    grafo = _grafo_requerido()

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
    """Retorna nodos y aristas en formato JSON para visualización en el mapa."""
    grafo = _grafo_requerido()
    return _to_native(grafo.to_dict())


@router.get("/api/ruta_optima")
def ruta_optima(origen: str, destino: str):
    """Calcula la ruta de mínimo costo entre dos nodos usando Dijkstra."""
    grafo = _grafo_requerido()

    if origen not in grafo.nodos:
        raise HTTPException(
            status_code=404,
            detail=f"Nodo origen '{origen}' no existe.",
        )

    if destino not in grafo.nodos:
        raise HTTPException(
            status_code=404,
            detail=f"Nodo destino '{destino}' no existe.",
        )

    calc = DijkstraCalculator(grafo)
    resultado = calc.ruta_con_detalle(origen, destino)

    if not isinstance(resultado, dict):
        raise HTTPException(
            status_code=500,
            detail="El cálculo de ruta óptima no retornó un resultado válido.",
        )

    ruta = _obtener_ruta_desde_resultado(resultado)

    if not ruta or len(ruta) < 2:
        raise HTTPException(
            status_code=404,
            detail=f"No existe una ruta disponible entre {origen} y {destino}.",
        )

    if _contiene_no_finito(resultado):
        raise HTTPException(
            status_code=404,
            detail=f"No existe una ruta con costo válido entre {origen} y {destino}.",
        )

    return _to_native(resultado)


@router.get("/api/flujo_maximo")
def flujo_maximo(fuente: str, sumidero: str):
    """Calcula el flujo máximo entre dos nodos usando Edmonds-Karp."""
    grafo = _grafo_requerido()

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
    grafo = _grafo_requerido()
    analizador = AnalizadorSensibilidad(grafo, ganancia_base)

    resultado = analizador.escenario_combustible(params.porcentaje_aumento)

    _persistir_escenario("combustible", params.dict(), resultado)

    return _to_native(resultado)


@router.post("/api/sensibilidad/via_cerrada")
def sensibilidad_via_cerrada(params: SensibilidadViaDTO):
    """
    Escenario 2: cierre de una vía principal.
    """
    grafo = _grafo_requerido()
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
    grafo = _grafo_requerido()
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
    grafo = _grafo_requerido()
    analizador = AnalizadorSensibilidad(grafo, ganancia_base)

    return _to_native(analizador.ejecutar_todos())


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