# Archivo: backend/grafos/dijkstra.py
from typing import Dict, List, Optional, Tuple

import networkx as nx

from models.grafo import GrafoRed


class DijkstraCalculator:
    """
    Calcula rutas de mínimo costo en la red logística usando el algoritmo de Dijkstra.

    El peso de cada arista es el costo de transporte ($/ton), que puede incluir
    distancia × costo_km × factor_combustible + penalizaciones de calidad.
    """

    def __init__(self, grafo: GrafoRed) -> None:
        self.grafo = grafo

    def ruta_minimo_costo(
        self, origen: str, destino: str
    ) -> Tuple[Optional[List[str]], float]:
        """
        Retorna la ruta de menor costo y su costo total.
        Si no existe camino, retorna (None, inf).
        """
        try:
            path = nx.dijkstra_path(self.grafo._nx, origen, destino, weight="weight")
            costo = nx.dijkstra_path_length(self.grafo._nx, origen, destino, weight="weight")
            return path, costo
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return None, float("inf")

    def todas_rutas_desde(self, origen: str) -> Dict[str, Tuple[List[str], float]]:
        """Calcula el camino más corto desde un nodo origen a todos los demás."""
        try:
            lengths, paths = nx.single_source_dijkstra(
                self.grafo._nx, origen, weight="weight"
            )
            return {dest: (paths[dest], lengths[dest]) for dest in paths}
        except nx.NodeNotFound:
            return {}

    def ruta_con_detalle(self, origen: str, destino: str) -> dict:
        """
        Retorna la ruta óptima con información detallada por cada tramo.
        Útil para respuestas de la API.
        """
        path, costo_total = self.ruta_minimo_costo(origen, destino)
        if path is None:
            return {
                "existe": False,
                "origen": origen,
                "destino": destino,
                "ruta": [],
                "costo_total": float("inf"),
                "saltos": 0,
                "detalle": [],
            }
        detalle = []
        for i in range(len(path) - 1):
            arista = self.grafo.obtener_arista(path[i], path[i + 1])
            nodo_de = self.grafo.obtener_nodo(path[i])
            nodo_a = self.grafo.obtener_nodo(path[i + 1])
            detalle.append({
                "de": path[i],
                "nombre_de": nodo_de.nombre if nodo_de else path[i],
                "a": path[i + 1],
                "nombre_a": nodo_a.nombre if nodo_a else path[i + 1],
                "costo_unitario": arista.costo_transporte if arista else 0.0,
                "distancia_km": arista.distancia if arista else 0.0,
                "capacidad": arista.capacidad if arista else 0.0,
            })
        return {
            "existe": True,
            "origen": origen,
            "destino": destino,
            "ruta": path,
            "costo_total": round(costo_total, 4),
            "saltos": len(path) - 1,
            "detalle": detalle,
        }

    def aristas_criticas(self, top_n: int = 5) -> List[dict]:
        """
        Retorna las aristas con mayor saturación (flujo_actual / capacidad).
        Identifica cuellos de botella potenciales.
        """
        saturaciones = []
        for (u, v), arista in self.grafo.aristas.items():
            nodo_u = self.grafo.obtener_nodo(u)
            nodo_v = self.grafo.obtener_nodo(v)
            saturaciones.append({
                "origen": u,
                "destino": v,
                "nombre_origen": nodo_u.nombre if nodo_u else u,
                "nombre_destino": nodo_v.nombre if nodo_v else v,
                "flujo_actual": arista.flujo_actual,
                "capacidad": arista.capacidad,
                "utilizacion": round(arista.utilizacion, 4),
                "costo": arista.costo_transporte,
            })
        return sorted(saturaciones, key=lambda x: x["utilizacion"], reverse=True)[:top_n]

    def matriz_costos(self) -> Dict[str, Dict[str, float]]:
        """Matriz de costos de camino mínimo entre todos los pares de nodos."""
        matriz: Dict[str, Dict[str, float]] = {}
        for nodo_id in self.grafo.nodos:
            rutas = self.todas_rutas_desde(nodo_id)
            matriz[nodo_id] = {dest: costo for dest, (_, costo) in rutas.items()}
        return matriz
