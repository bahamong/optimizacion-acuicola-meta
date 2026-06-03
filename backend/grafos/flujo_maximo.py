# Archivo: backend/grafos/flujo_maximo.py
from typing import Dict, List, Optional, Tuple

import networkx as nx

from models.grafo import GrafoRed
from models.nodo import TipoNodo


class FlujoMaximo:
    """
    Calcula el flujo máximo en la red usando el algoritmo de Edmonds-Karp
    (implementación BFS de Ford-Fulkerson), identificando cuellos de botella.

    Permite determinar si la red tiene suficiente capacidad para satisfacer
    la demanda total y dónde están los cuellos de botella.
    """

    def __init__(self, grafo: GrafoRed) -> None:
        self.grafo = grafo

    def _construir_grafo_capacidades(self) -> nx.DiGraph:
        """Construye un DiGraph con capacidades para los algoritmos de NetworkX."""
        G = nx.DiGraph()
        for nodo_id in self.grafo.nodos:
            G.add_node(nodo_id)
        for (u, v), arista in self.grafo.aristas.items():
            G.add_edge(u, v, capacity=arista.capacidad)
        return G

    def calcular(
        self, fuente: str, sumidero: str
    ) -> Tuple[float, Dict[str, Dict[str, float]]]:
        """
        Calcula el flujo máximo entre fuente y sumidero.

        Retorna:
            (valor_flujo, dict de flujos por arista)
        """
        G = self._construir_grafo_capacidades()
        try:
            valor, flujo_dict = nx.maximum_flow(
                G, fuente, sumidero, capacity="capacity", flow_func=nx.algorithms.flow.edmonds_karp
            )
            return valor, flujo_dict
        except (nx.NetworkXError, nx.NodeNotFound, nx.NetworkXUnfeasible):
            return 0.0, {}

    def cuello_de_botella(self, fuente: str, sumidero: str) -> Optional[Tuple[str, str]]:
        """
        Identifica la arista del corte mínimo que limita el flujo total.
        Esta arista es el cuello de botella de la red.
        """
        G = self._construir_grafo_capacidades()
        try:
            _, (alcanzable, _) = nx.minimum_cut(G, fuente, sumidero, capacity="capacity")
            for u in alcanzable:
                for v in self.grafo.vecinos_salida(u):
                    if v not in alcanzable:
                        return (u, v)
            return None
        except (nx.NetworkXError, nx.NodeNotFound):
            return None

    def capacidad_red_completa(self) -> float:
        """
        Flujo máximo total de la red: desde super-fuente (todos los orígenes)
        hacia super-sumidero (todos los destinos).
        Mide si la capacidad instalada puede satisfacer la demanda total.
        """
        G = self._construir_grafo_capacidades()
        G.add_node("__S__")
        G.add_node("__T__")

        for nodo in self.grafo.obtener_nodos_por_tipo(TipoNodo.ORIGEN):
            G.add_edge("__S__", nodo.id, capacity=nodo.oferta)

        for nodo in self.grafo.obtener_nodos_por_tipo(TipoNodo.DESTINO):
            G.add_edge(nodo.id, "__T__", capacity=nodo.demanda)

        try:
            valor, _ = nx.maximum_flow(
                G, "__S__", "__T__", capacity="capacity",
                flow_func=nx.algorithms.flow.edmonds_karp
            )
            return valor
        except Exception:
            return 0.0

    def reporte(self, fuente: str, sumidero: str) -> dict:
        """Genera un reporte completo de flujo máximo entre dos nodos."""
        valor, flujo_dict = self.calcular(fuente, sumidero)
        cuello = self.cuello_de_botella(fuente, sumidero)

        nodo_c_u = self.grafo.obtener_nodo(cuello[0]) if cuello else None
        nodo_c_v = self.grafo.obtener_nodo(cuello[1]) if cuello else None

        detalle_flujos = []
        for (u, v), arista in self.grafo.aristas.items():
            f = flujo_dict.get(u, {}).get(v, 0.0)
            detalle_flujos.append({
                "origen": u,
                "destino": v,
                "flujo": round(f, 4),
                "capacidad": arista.capacidad,
                "utilizacion": round(f / arista.capacidad, 4) if arista.capacidad > 0 else 0,
            })

        return {
            "fuente": fuente,
            "sumidero": sumidero,
            "flujo_maximo": round(valor, 4),
            "cuello_botella": {
                "origen": cuello[0] if cuello else None,
                "destino": cuello[1] if cuello else None,
                "nombre_origen": nodo_c_u.nombre if nodo_c_u else None,
                "nombre_destino": nodo_c_v.nombre if nodo_c_v else None,
            },
            "detalle_flujos": detalle_flujos,
        }

    def nodos_desabastecidos(self, flujo_dict: Dict) -> List[str]:
        """Identifica destinos que no recibirían suficiente flujo."""
        desabastecidos = []
        for nodo in self.grafo.obtener_nodos_por_tipo(TipoNodo.DESTINO):
            flujo_recibido = sum(
                flujo_dict.get(origen, {}).get(nodo.id, 0.0)
                for origen in self.grafo.vecinos_entrada(nodo.id)
            )
            if flujo_recibido < nodo.demanda - 1e-6:
                desabastecidos.append(nodo.id)
        return desabastecidos
