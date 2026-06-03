# Archivo: backend/algoritmos/optimizador_grafo.py
"""
Optimización por Flujo de Mínimo Costo (algoritmo de grafos puro).

Usa max_flow_min_cost de NetworkX: maximiza el flujo entregado
al menor costo de transporte posible, respetando oferta, demanda
y capacidad de cada arista.
"""

from typing import Dict

import networkx as nx

import config
from models.grafo import GrafoRed
from models.nodo import TipoNodo
from utils.logger import get_logger

logger = get_logger(__name__)


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
        G = nx.DiGraph()
        G.add_node("__S__")
        G.add_node("__T__")

        for origen in self.origenes:
            G.add_edge("__S__", origen.id, capacity=origen.oferta, weight=0)

        for destino in self.destinos:
            G.add_edge(destino.id, "__T__", capacity=destino.demanda, weight=0)

        for (u, v), arista in self.grafo.aristas.items():
            G.add_edge(u, v, capacity=arista.capacidad, weight=arista.costo_transporte)

        return G

    def ejecutar(self) -> dict:
        G = self._construir_red()
        flujo_dict: dict = {}

        try:
            flujo_dict = nx.max_flow_min_cost(
                G, "__S__", "__T__", capacity="capacity", weight="weight"
            )
        except Exception as e:
            logger.warning(f"max_flow_min_cost falló ({e}), usando maximum_flow como fallback")
            try:
                _, flujo_dict = nx.maximum_flow(G, "__S__", "__T__", capacity="capacity")
            except Exception:
                flujo_dict = {}

        rutas_activas = []
        flujos_optimos: Dict[str, float] = {}
        costo_total = 0.0

        for (u, v), arista in self.grafo.aristas.items():
            flujo = flujo_dict.get(u, {}).get(v, 0.0)
            arista.flujo_actual = max(0.0, flujo)
            if flujo > 1e-6:
                rutas_activas.append(arista)
                flujos_optimos[f"{u}→{v}"] = round(flujo, 4)
                costo_total += flujo * arista.costo_transporte

        ganancia = self._calcular_ganancia(flujo_dict)

        logger.info(
            f"Optimización por grafos: {len(rutas_activas)} rutas activas, ganancia={ganancia:.2f}"
        )

        return {
            "exito": True,
            "ganancia": round(ganancia, 4),
            "costo_minimo": round(costo_total, 4),
            "flujos": flujos_optimos,
            "stocks": {},
            "num_rutas_activas": len(rutas_activas),
            "num_rutas_total": len(self.grafo.aristas),
            "rutas_activas": [
                {
                    "origen": a.id_origen,
                    "destino": a.id_destino,
                    "flujo": round(a.flujo_actual, 4),
                }
                for a in rutas_activas
            ],
        }

    def _calcular_ganancia(self, flujo_dict: dict) -> float:
        ingreso = sum(
            min(
                sum(
                    flujo_dict.get(u, {}).get(destino.id, 0.0)
                    for u in self.grafo.vecinos_entrada(destino.id)
                ),
                destino.demanda,
            ) * config.PRECIO_VENTA_TON
            for destino in self.destinos
        )

        costo = sum(
            flujo_dict.get(u, {}).get(v, 0.0) * arista.costo_transporte
            for (u, v), arista in self.grafo.aristas.items()
        )

        penalizacion = sum(
            max(
                0.0,
                destino.demanda - sum(
                    flujo_dict.get(u, {}).get(destino.id, 0.0)
                    for u in self.grafo.vecinos_entrada(destino.id)
                ),
            ) * config.PENALIZACION_INCUMPLIMIENTO
            for destino in self.destinos
        )

        return ingreso - costo - penalizacion
