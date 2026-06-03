# Archivo: backend/algoritmos/optimizador_grafo.py
"""
Optimización por Flujo de Mínimo Costo (algoritmo de grafos puro).

Usa max_flow_min_cost de NetworkX: maximiza el flujo entregado
al menor costo de transporte posible, respetando oferta, demanda
y capacidad de cada arista.

Las capacidades y los costos se escalan a enteros antes de invocar
el algoritmo: NetworkX resuelve el flujo de mínimo costo de forma
exacta y rápida con datos enteros (con flotantes puede volverse
extremadamente lento).
"""

from typing import Dict

import networkx as nx

import config
from models.grafo import GrafoRed
from models.nodo import TipoNodo
from utils.logger import get_logger

logger = get_logger(__name__)

# Factor para convertir costos ($/ton, flotante) a enteros sin perder precisión.
ESCALA_COSTO = 100


class OptimizadorGrafo:
    """
    Asigna flujos óptimos usando Flujo de Mínimo Costo (max_flow_min_cost).
    """

    def __init__(self, grafo: GrafoRed) -> None:
        self.grafo = grafo
        self.origenes = grafo.obtener_nodos_por_tipo(TipoNodo.ORIGEN)
        self.acopios = grafo.obtener_nodos_por_tipo(TipoNodo.ACOPIO)
        self.destinos = grafo.obtener_nodos_por_tipo(TipoNodo.DESTINO)

    def _construir_red(self) -> nx.DiGraph:
        """Red dirigida con super-fuente (__S__) y super-sumidero (__T__),
        con capacidades y pesos enteros para max_flow_min_cost."""
        G = nx.DiGraph()
        G.add_node("__S__")
        G.add_node("__T__")

        for origen in self.origenes:
            G.add_edge("__S__", origen.id, capacity=int(round(origen.oferta)), weight=0)

        for destino in self.destinos:
            G.add_edge(destino.id, "__T__", capacity=int(round(destino.demanda)), weight=0)

        for (u, v), arista in self.grafo.aristas.items():
            G.add_edge(
                u,
                v,
                capacity=int(round(arista.capacidad)),
                weight=int(round(arista.costo_transporte * ESCALA_COSTO)),
            )

        return G

    def ejecutar(self) -> dict:
        G = self._construir_red()
        flujo_dict: dict = {}

        try:
            flujo_dict = nx.max_flow_min_cost(
                G, "__S__", "__T__", capacity="capacity", weight="weight"
            )
        except Exception as e:
            logger.warning(
                f"max_flow_min_cost falló ({e}), usando maximum_flow como fallback"
            )
            try:
                _, flujo_dict = nx.maximum_flow(G, "__S__", "__T__", capacity="capacity")
            except Exception:
                flujo_dict = {}

        rutas_activas = []
        flujos_optimos: Dict[str, float] = {}
        costo_total = 0.0

        for (u, v), arista in self.grafo.aristas.items():
            flujo = float(flujo_dict.get(u, {}).get(v, 0.0))
            arista.flujo_actual = max(0.0, flujo)

            if flujo > 1e-6:
                flujos_optimos[f"{u}→{v}"] = round(flujo, 4)
                costo_total += flujo * arista.costo_transporte
                rutas_activas.append({
                    "origen": u,
                    "destino": v,
                    "flujo": round(flujo, 4),
                    "costo": round(arista.costo_transporte, 4),
                    "capacidad": arista.capacidad,
                    "utilizacion": round(arista.utilizacion, 4),
                })

        ganancia = self._calcular_ganancia()

        logger.info(
            f"Optimización por grafos: {len(rutas_activas)} rutas activas, "
            f"costo={costo_total:.2f}, ganancia={ganancia:.2f}"
        )

        return {
            "exito": True,
            "ganancia": round(ganancia, 4),
            "costo_minimo": round(costo_total, 4),
            "flujos": flujos_optimos,
            "stocks": {},
            "num_rutas_activas": len(rutas_activas),
            "num_rutas_total": len(self.grafo.aristas),
            "rutas_activas": rutas_activas,
        }

    def _calcular_ganancia(self) -> float:
        """Ingreso por demanda cubierta − costo de transporte − penalización
        por demanda no satisfecha. Usa los flujos ya asignados en el grafo."""
        ingreso = 0.0
        penalizacion = 0.0

        for destino in self.destinos:
            recibido = sum(
                self.grafo.obtener_arista(u, destino.id).flujo_actual
                for u in self.grafo.vecinos_entrada(destino.id)
            )
            cubierto = min(recibido, destino.demanda)
            ingreso += cubierto * config.PRECIO_VENTA_TON
            penalizacion += max(0.0, destino.demanda - recibido) * config.PENALIZACION_INCUMPLIMIENTO

        costo = sum(a.flujo_actual * a.costo_transporte for a in self.grafo.aristas.values())

        return ingreso - costo - penalizacion
