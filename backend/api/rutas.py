"""
Endpoints REST de la API de Optimización — Acuícola Real del Meta.

Rutas disponibles:
  POST /api/cargar_datos          → carga nodos y aristas en la red
  POST /api/cargar_red_defecto    → carga la red predeterminada de Colombia
  POST /api/optimizar             → ejecuta AG + Gradiente
  GET  /api/resultados            → retorna la última solución
  GET  /api/metricas              → KPIs de la solución actual
  GET  /api/grafo_json            → datos del grafo para visualizar en mapa
  GET  /api/ruta_optima           → Dijkstra entre dos nodos
  GET  /api/flujo_maximo          → Ford-Fulkerson entre dos nodos
  POST /api/sensibilidad/{escenario} → análisis What-If
  POST /api/sensibilidad/todos    → ejecuta los 3 escenarios
  GET  /health                    → health check
"""

import json
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from algoritmos.genetico import AlgoritmoGenetico
from algoritmos.gradiente import MetodoGradiente
from algoritmos.validador import ValidadorRestricciones
from database.db import crear_tablas, get_db
from database.modelos_sql import EscenarioHistorialSQL, SolucionSQL
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
    flujos_a_dict,
    merma_desde_calidad,
)
from utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()

# ── Estado global de la aplicación ───────────────────────────────────────────
# (Para esta app académica un singleton es suficiente)
grafo_actual: Optional[GrafoRed] = None
resultado_optimizacion: Optional[dict] = None
ganancia_base: float = 0.0

# ── Modelos Pydantic (DTO) ────────────────────────────────────────────────────

class NodoDTO(BaseModel):
    id: str
    tipo: str              # "origen" | "acopio" | "destino"
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
    try:
        with get_db() as db:
            sol = SolucionSQL(
                tipo_escenario="base",
                ganancia_total=resultado.get("ganancia", 0.0),
                costo_total=resultado.get("gradiente", {}).get("costo_minimo", 0.0),
                num_rutas_activas=resultado.get("ag", {}).get("num_rutas_activas", 0),
                porcentaje_demanda_cumplida=resultado.get("metricas", {}).get(
                    "porcentaje_demanda_cumplida", 0.0
                ),
            )
            sol.set_flujos(resultado.get("gradiente", {}).get("flujos", {}))
            sol.set_stocks(resultado.get("gradiente", {}).get("stocks", {}))
            sol.set_metricas(resultado.get("metricas", {}))
            db.add(sol)
    except Exception as e:
        logger.warning(f"No se pudo persistir la solución en BD: {e}")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/health")
def health_check():
    return {"status": "ok", "version": "1.0", "proyecto": "Acuícola Real del Meta"}


@router.post("/api/cargar_red_defecto")
def cargar_red_defecto():
    """Carga la red predeterminada de Colombia (41 nodos, ~54 aristas)."""
    global grafo_actual, resultado_optimizacion, ganancia_base
    try:
        grafo_actual = construir_red_acuicola()
        resultado_optimizacion = None
        ganancia_base = 0.0
        return {
            "estado": "éxito",
            "nodos_cargados": len(grafo_actual.nodos),
            "aristas_cargadas": len(grafo_actual.aristas),
            "oferta_total": grafo_actual.oferta_total(),
            "demanda_total": grafo_actual.demanda_total(),
            "mensaje": "Red 'Acuícola Real del Meta' cargada correctamente.",
        }
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
            # La merma de un acopio se deriva de su calidad (no se edita aparte)
            merma = (
                merma_desde_calidad(nd.tasa_calidad)
                if tipo == TipoNodo.ACOPIO else nd.tasa_merma
            )
            nodo = Nodo(
                id=nd.id, tipo=tipo, nombre=nd.nombre,
                municipio=nd.municipio, departamento=nd.departamento,
                latitud=nd.latitud, longitud=nd.longitud,
                capacidad=nd.capacidad, oferta=nd.oferta, demanda=nd.demanda,
                tasa_merma=merma, tasa_calidad=nd.tasa_calidad,
                costo_operacion=nd.costo_operacion,
            )
            grafo_actual.agregar_nodo(nodo)

        # Dedup: solo una arista por par (origen, destino)
        vistas = set()
        for ad in datos.aristas:
            clave = (ad.id_origen, ad.id_destino)
            if clave in vistas:
                continue  # ruta duplicada — se ignora
            vistas.add(clave)

            # Distancia automática si no viene (o viene en 0) desde coordenadas
            dist = ad.distancia
            if not dist or dist <= 0:
                no = grafo_actual.obtener_nodo(ad.id_origen)
                nd_ = grafo_actual.obtener_nodo(ad.id_destino)
                if no and nd_:
                    dist = distancia_vial(no.latitud, no.longitud, nd_.latitud, nd_.longitud)

            arista = Arista(
                id_origen=ad.id_origen, id_destino=ad.id_destino,
                costo_transporte=ad.costo_transporte, capacidad=ad.capacidad,
                distancia=dist, estado=ad.estado,
                umbral_calidad=ad.umbral_calidad,
            )
            grafo_actual.agregar_arista(arista)

        resultado_optimizacion = None
        ganancia_base = 0.0

        if not grafo_actual.validar_conectividad():
            logger.warning("El grafo cargado no es débilmente conexo.")

        return {
            "estado": "éxito",
            "nodos_cargados": len(grafo_actual.nodos),
            "aristas_cargadas": len(grafo_actual.aristas),
            "oferta_total": grafo_actual.oferta_total(),
            "demanda_total": grafo_actual.demanda_total(),
            "conexo": grafo_actual.validar_conectividad(),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error en cargar_datos: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/api/optimizar")
def optimizar():
    """
    Ejecuta la optimización híbrida:
      1. Algoritmo Genético → selecciona rutas activas (variables binarias y_ij)
      2. Método de Gradiente → optimiza flujos exactos (variables continuas x_ij, s_j)
      3. Validación de restricciones
      4. Cálculo de métricas finales (Dijkstra, Flujo Máximo)
    """
    global resultado_optimizacion, ganancia_base
    grafo = _grafo_requerido()

    try:
        logger.info("=== Iniciando optimización híbrida AG + Gradiente ===")

        # Paso 1: Algoritmo Genético
        ag = AlgoritmoGenetico(grafo)
        resultado_ag = ag.ejecutar()
        rutas_activas = ag.rutas_activas_del_mejor()

        # Paso 2: Método de Gradiente
        grad = MetodoGradiente(grafo, rutas_activas)
        resultado_grad = grad.ejecutar()

        # Paso 3: Validación de restricciones
        flujos_dict = {
            (a.id_origen, a.id_destino): a.flujo_actual
            for a in grafo.aristas.values()
        }
        stock_dict = resultado_grad.get("stocks", {})
        stock_tuples = {k: v for k, v in stock_dict.items()}
        validador = ValidadorRestricciones(grafo)
        validacion = validador.validar_completo(flujos_dict, stock_tuples)

        # Paso 4: Dijkstra — ruta de mínimo costo en la red
        origenes = grafo.obtener_nodos_por_tipo(TipoNodo.ORIGEN)
        destinos = grafo.obtener_nodos_por_tipo(TipoNodo.DESTINO)
        dijkstra = DijkstraCalculator(grafo)
        ruta_representativa = {}
        if origenes and destinos:
            ruta_representativa = dijkstra.ruta_con_detalle(
                origenes[0].id, destinos[0].id
            )

        # Paso 5: Flujo máximo global
        flujo_max_calc = FlujoMaximo(grafo)
        capacidad_red = flujo_max_calc.capacidad_red_completa()

        # Métricas finales
        metricas = calcular_metricas_resultado(grafo, resultado_grad)

        ganancia = resultado_grad.get("ganancia", resultado_ag["mejor_fitness"])
        ganancia_base = ganancia

        resultado_optimizacion = {
            "ag": resultado_ag,
            "gradiente": resultado_grad,
            "validacion": validacion,
            "metricas": metricas,
            "ruta_representativa": ruta_representativa,
            "capacidad_red": round(capacidad_red, 2),
            "aristas_criticas": dijkstra.aristas_criticas(5),
        }

        _guardar_solucion_bd(resultado_optimizacion)
        logger.info(f"Optimización completada. Ganancia={ganancia:.2f}")

        return {
            "estado": "éxito",
            "ganancia": round(ganancia, 2),
            "costo_total": resultado_grad.get("costo_minimo", 0.0),
            "rutas_activas": resultado_ag["num_rutas_activas"],
            "demanda_cumplida_pct": metricas["porcentaje_demanda_cumplida"],
            "restricciones_validas": validacion["valido"],
            "mensaje": "Optimización híbrida AG + Gradiente completada.",
        }

    except Exception as e:
        logger.error(f"Error en optimizar: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/resultados")
def obtener_resultados():
    """Retorna el resultado completo de la última optimización."""
    resultado = _resultado_requerido()
    # Serialización segura (eliminar objetos no-JSON-serializables)
    return {
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
    }


@router.get("/api/metricas")
def obtener_metricas():
    """KPIs de la red actual (sin necesidad de optimización previa)."""
    grafo = _grafo_requerido()
    return {
        "nodos_totales": len(grafo.nodos),
        "aristas_totales": len(grafo.aristas),
        "num_origenes": len(grafo.obtener_nodos_por_tipo(TipoNodo.ORIGEN)),
        "num_acopios": len(grafo.obtener_nodos_por_tipo(TipoNodo.ACOPIO)),
        "num_destinos": len(grafo.obtener_nodos_por_tipo(TipoNodo.DESTINO)),
        "oferta_total": grafo.oferta_total(),
        "demanda_total": grafo.demanda_total(),
        "conexo": grafo.validar_conectividad(),
        **(resultado_optimizacion["metricas"] if resultado_optimizacion else {}),
    }


@router.get("/api/grafo_json")
def obtener_grafo_json():
    """Retorna nodos y aristas en formato JSON para visualización en el mapa."""
    grafo = _grafo_requerido()
    return grafo.to_dict()


@router.get("/api/ruta_optima")
def ruta_optima(origen: str, destino: str):
    """Calcula la ruta de mínimo costo entre dos nodos usando Dijkstra."""
    grafo = _grafo_requerido()
    if origen not in grafo.nodos:
        raise HTTPException(status_code=404, detail=f"Nodo origen '{origen}' no existe")
    if destino not in grafo.nodos:
        raise HTTPException(status_code=404, detail=f"Nodo destino '{destino}' no existe")
    calc = DijkstraCalculator(grafo)
    return calc.ruta_con_detalle(origen, destino)


@router.get("/api/flujo_maximo")
def flujo_maximo(fuente: str, sumidero: str):
    """Calcula el flujo máximo entre dos nodos usando Edmonds-Karp."""
    grafo = _grafo_requerido()
    if fuente not in grafo.nodos:
        raise HTTPException(status_code=404, detail=f"Nodo fuente '{fuente}' no existe")
    if sumidero not in grafo.nodos:
        raise HTTPException(status_code=404, detail=f"Nodo sumidero '{sumidero}' no existe")
    calc = FlujoMaximo(grafo)
    return calc.reporte(fuente, sumidero)


@router.post("/api/sensibilidad/combustible")
def sensibilidad_combustible(params: SensibilidadCombustibleDTO):
    """
    Escenario 1: Aumento del costo de combustible en rutas del Meta.
    Modifica los costos y re-optimiza para medir el impacto en la ganancia.
    """
    grafo = _grafo_requerido()
    analizador = AnalizadorSensibilidad(grafo, ganancia_base)
    resultado = analizador.escenario_combustible(params.porcentaje_aumento)
    _persistir_escenario("combustible", params.dict(), resultado)
    return resultado


@router.post("/api/sensibilidad/via_cerrada")
def sensibilidad_via_cerrada(params: SensibilidadViaDTO):
    """
    Escenario 2: Cierre de una vía principal.
    Elimina la arista indicada y re-optimiza para medir el impacto.
    """
    grafo = _grafo_requerido()
    analizador = AnalizadorSensibilidad(grafo, ganancia_base)
    resultado = analizador.escenario_via_cerrada(params.id_origen, params.id_destino)
    _persistir_escenario("via_cerrada", params.dict(), resultado)
    return resultado


@router.post("/api/sensibilidad/calidad")
def sensibilidad_calidad(params: SensibilidadCalidadDTO):
    """
    Escenario 3: Pérdida de calidad en un centro de acopio.
    Degrada la tasa de calidad y re-optimiza para medir el impacto.
    """
    grafo = _grafo_requerido()
    analizador = AnalizadorSensibilidad(grafo, ganancia_base)
    resultado = analizador.escenario_fallo_calidad(params.id_acopio, params.tasa_calidad_nueva)
    _persistir_escenario("calidad", params.dict(), resultado)
    return resultado


@router.post("/api/sensibilidad/todos")
def sensibilidad_todos():
    """
    Ejecuta los 3 escenarios de análisis de sensibilidad automáticamente
    y retorna el comparativo completo.
    """
    grafo = _grafo_requerido()
    analizador = AnalizadorSensibilidad(grafo, ganancia_base)
    return analizador.ejecutar_todos()


def _persistir_escenario(tipo: str, params: dict, resultado: dict) -> None:
    try:
        with get_db() as db:
            esc = EscenarioHistorialSQL(
                tipo=tipo,
                ganancia_base=resultado.get("ganancia_base", 0.0),
                ganancia_escenario=resultado.get("ganancia_escenario", 0.0),
                impacto_absoluto=resultado.get("impacto_absoluto", 0.0),
                impacto_porcentual=resultado.get("impacto_porcentual", 0.0),
            )
            esc.set_parametros(params)
            db.add(esc)
    except Exception as e:
        logger.warning(f"No se pudo persistir escenario en BD: {e}")
