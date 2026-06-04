# Archivo: backend/grafos/bellman_ford.py
"""
Bellman-Ford para rutas óptimas en redes con costos negativos.
Misma interfaz que DijkstraCalculator para que sea intercambiable.
Usado automáticamente cuando hay aristas con costo < 0 (subsidios, bonificaciones).
"""
from typing import List, Optional, Tuple

import networkx as nx

from models.grafo import GrafoRed


class BellmanFordCalculator:
    """
    Calcula rutas de mínimo costo con el algoritmo de Bellman-Ford.
    Soporta pesos negativos. Detecta ciclos negativos y los reporta.
    """

    def __init__(self, grafo: GrafoRed) -> None:
        self.grafo = grafo

    def ruta_minimo_costo(
        self, origen: str, destino: str
    ) -> Tuple[Optional[List[str]], float]:
        try:
            path = nx.bellman_ford_path(self.grafo._nx, origen, destino, weight="weight")
            costo = nx.bellman_ford_path_length(
                self.grafo._nx, origen, destino, weight="weight"
            )
            return path, costo
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return None, float("inf")
        except nx.NetworkXUnbounded:
            return None, float("-inf")  # ciclo negativo detectado

    def mejor_cadena_hacia_destino(self, id_destino: str) -> dict:
        """Misma lógica que DijkstraCalculator.mejor_cadena_hacia_destino()
        pero garantizando el uso de Bellman-Ford. Delega en la lógica compartida
        de Dijkstra, que auto-selecciona Bellman-Ford cuando hay costos negativos.
        """
        from grafos.dijkstra import DijkstraCalculator

        calc = DijkstraCalculator(self.grafo)
        return calc.mejor_cadena_hacia_destino(id_destino)

    def tiene_ciclo_negativo(self) -> bool:
        try:
            return bool(nx.negative_edge_cycle(self.grafo._nx, weight="weight"))
        except nx.NetworkXUnbounded:
            return True
        except Exception:
            return False
