from typing import Dict, List, Optional, Tuple

import networkx as nx

from models.grafo import GrafoRed
from models.nodo import TipoNodo


class FlujoMaximo:
    """
    Calcula flujo maximo con Edmonds-Karp.

    Para representar capacidad maxima de centros de acopio, cada acopio se
    modela internamente como acopio__in -> acopio__out con capacidad del nodo.
    """

    def __init__(self, grafo: GrafoRed) -> None:
        self.grafo = grafo

    def _es_acopio(self, nodo_id: str) -> bool:
        nodo = self.grafo.obtener_nodo(nodo_id)
        return bool(nodo and nodo.tipo == TipoNodo.ACOPIO)

    def _entrada(self, nodo_id: str) -> str:
        return f"{nodo_id}__in" if self._es_acopio(nodo_id) else nodo_id

    def _salida(self, nodo_id: str) -> str:
        return f"{nodo_id}__out" if self._es_acopio(nodo_id) else nodo_id

    @staticmethod
    def _base(nodo_flujo: str) -> str:
        if nodo_flujo.endswith("__in"):
            return nodo_flujo[:-4]
        if nodo_flujo.endswith("__out"):
            return nodo_flujo[:-5]
        return nodo_flujo

    def _construir_grafo_capacidades(self) -> nx.DiGraph:
        G = nx.DiGraph()

        for nodo in self.grafo.nodos.values():
            if nodo.tipo == TipoNodo.ACOPIO:
                G.add_edge(
                    self._entrada(nodo.id),
                    self._salida(nodo.id),
                    capacity=max(float(nodo.capacidad), 0.0),
                )
            else:
                G.add_node(nodo.id)

        for (u, v), arista in self.grafo.aristas.items():
            nodo_u = self.grafo.obtener_nodo(u)
            nodo_v = self.grafo.obtener_nodo(v)
            if (
                nodo_u
                and nodo_v
                and nodo_u.tipo == TipoNodo.ORIGEN
                and nodo_v.tipo == TipoNodo.DESTINO
            ):
                continue
            G.add_edge(
                self._salida(u),
                self._entrada(v),
                capacity=max(float(arista.capacidad), 0.0),
            )

        return G

    def _mapear_fuente(self, nodo_id: str) -> str:
        return self._salida(nodo_id) if self._es_acopio(nodo_id) else nodo_id

    def _mapear_sumidero(self, nodo_id: str) -> str:
        return self._entrada(nodo_id) if self._es_acopio(nodo_id) else nodo_id

    def _flujo_arista_original(self, flujo_dict: dict, u: str, v: str) -> float:
        return float(
            flujo_dict.get(self._salida(u), {}).get(self._entrada(v), 0.0)
        )

    def calcular(
        self, fuente: str, sumidero: str
    ) -> Tuple[float, Dict[str, Dict[str, float]]]:
        G = self._construir_grafo_capacidades()
        try:
            valor, flujo_dict = nx.maximum_flow(
                G,
                self._mapear_fuente(fuente),
                self._mapear_sumidero(sumidero),
                capacity="capacity",
                flow_func=nx.algorithms.flow.edmonds_karp,
            )
            return valor, flujo_dict
        except (nx.NetworkXError, nx.NodeNotFound, nx.NetworkXUnfeasible):
            return 0.0, {}

    def cuello_de_botella(self, fuente: str, sumidero: str) -> Optional[Tuple[str, str]]:
        G = self._construir_grafo_capacidades()
        try:
            _, (alcanzable, _) = nx.minimum_cut(
                G,
                self._mapear_fuente(fuente),
                self._mapear_sumidero(sumidero),
                capacity="capacity",
            )
            for u in alcanzable:
                for v in G.successors(u):
                    if v not in alcanzable:
                        return (self._base(u), self._base(v))
            return None
        except (nx.NetworkXError, nx.NodeNotFound):
            return None

    def capacidad_red_completa(self) -> float:
        G = self._construir_grafo_capacidades()
        G.add_node("__S__")
        G.add_node("__T__")

        for nodo in self.grafo.obtener_nodos_por_tipo(TipoNodo.ORIGEN):
            G.add_edge("__S__", nodo.id, capacity=max(float(nodo.oferta), 0.0))

        for nodo in self.grafo.obtener_nodos_por_tipo(TipoNodo.DESTINO):
            G.add_edge(nodo.id, "__T__", capacity=max(float(nodo.demanda), 0.0))

        try:
            valor, _ = nx.maximum_flow(
                G,
                "__S__",
                "__T__",
                capacity="capacity",
                flow_func=nx.algorithms.flow.edmonds_karp,
            )
            return valor
        except Exception:
            return 0.0

    def reporte(self, fuente: str, sumidero: str) -> dict:
        valor, flujo_dict = self.calcular(fuente, sumidero)
        cuello = self.cuello_de_botella(fuente, sumidero)

        nodo_c_u = self.grafo.obtener_nodo(cuello[0]) if cuello else None
        nodo_c_v = self.grafo.obtener_nodo(cuello[1]) if cuello else None

        detalle_flujos = []
        for (u, v), arista in self.grafo.aristas.items():
            f = self._flujo_arista_original(flujo_dict, u, v)
            detalle_flujos.append({
                "origen": u,
                "destino": v,
                "flujo": round(f, 4),
                "capacidad": arista.capacidad,
                "utilizacion": round(f / arista.capacidad, 4) if arista.capacidad > 0 else 0,
                "fuente_distancia": arista.fuente_distancia,
                "generada_automaticamente": arista.generada_automaticamente,
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
            "modelo_capacidad_acopio": "nodo partido: acopio__in -> acopio__out",
            "detalle_flujos": detalle_flujos,
        }

    def nodos_desabastecidos(self, flujo_dict: Dict) -> List[str]:
        desabastecidos = []
        for nodo in self.grafo.obtener_nodos_por_tipo(TipoNodo.DESTINO):
            flujo_recibido = sum(
                self._flujo_arista_original(flujo_dict, origen, nodo.id)
                for origen in self.grafo.vecinos_entrada(nodo.id)
            )
            if flujo_recibido < nodo.demanda - 1e-6:
                desabastecidos.append(nodo.id)
        return desabastecidos
