# Archivo: backend/models/grafo.py
from __future__ import annotations
import copy
from typing import Dict, List, Optional, Tuple

import networkx as nx

from models.nodo import Nodo, TipoNodo
from models.arista import Arista


class GrafoRed:
    """
    Grafo dirigido ponderado G = (V, E) que modela la red logística.

    V = Orígenes ∪ Acopios ∪ Destinos
    E = Rutas de transporte con costos dinámicos
    """

    def __init__(self) -> None:
        self.nodos: Dict[str, Nodo] = {}
        self.aristas: Dict[Tuple[str, str], Arista] = {}
        self._nx: nx.DiGraph = nx.DiGraph()

    # ── Construcción ──────────────────────────────────────────────────────────

    def agregar_nodo(self, nodo: Nodo) -> None:
        nodo.validar()
        self.nodos[nodo.id] = nodo
        self._nx.add_node(
            nodo.id,
            tipo=nodo.tipo.value,
            nombre=nodo.nombre,
            lat=nodo.latitud,
            lng=nodo.longitud,
        )

    def agregar_arista(self, arista: Arista) -> None:
        arista.validar()
        if arista.id_origen not in self.nodos:
            raise ValueError(f"Nodo origen '{arista.id_origen}' no existe en el grafo")
        if arista.id_destino not in self.nodos:
            raise ValueError(f"Nodo destino '{arista.id_destino}' no existe en el grafo")
        if arista.estado == "bloqueada":
            return  # Rutas bloqueadas no se agregan al grafo
        clave = (arista.id_origen, arista.id_destino)
        self.aristas[clave] = arista
        self._nx.add_edge(
            arista.id_origen,
            arista.id_destino,
            weight=arista.costo_total_unitario,  # costo ajustado por el estado de la vía
            capacidad=arista.capacidad,
            distancia=arista.distancia,
        )

    # ── Consultas ─────────────────────────────────────────────────────────────

    def obtener_nodo(self, nodo_id: str) -> Optional[Nodo]:
        return self.nodos.get(nodo_id)

    def obtener_arista(self, origen: str, destino: str) -> Optional[Arista]:
        return self.aristas.get((origen, destino))

    def obtener_nodos_por_tipo(self, tipo: TipoNodo) -> List[Nodo]:
        return [n for n in self.nodos.values() if n.tipo == tipo]

    def lista_aristas(self) -> List[Arista]:
        return list(self.aristas.values())

    def vecinos_salida(self, nodo_id: str) -> List[str]:
        return list(self._nx.successors(nodo_id))

    def vecinos_entrada(self, nodo_id: str) -> List[str]:
        return list(self._nx.predecessors(nodo_id))

    # ── Métricas globales ─────────────────────────────────────────────────────

    def oferta_total(self) -> float:
        return sum(n.oferta for n in self.obtener_nodos_por_tipo(TipoNodo.ORIGEN))

    def demanda_total(self) -> float:
        return sum(n.demanda for n in self.obtener_nodos_por_tipo(TipoNodo.DESTINO))

    def costo_transporte_total(self) -> float:
        return sum(a.costo_total for a in self.aristas.values())

    # ── Validaciones ──────────────────────────────────────────────────────────

    def validar_conectividad(self) -> bool:
        """El grafo es débilmente conexo si se puede llegar a todos los nodos."""
        return nx.is_weakly_connected(self._nx) if self._nx.number_of_nodes() > 0 else False

    def calcular_merma(self, nodo_id: str, inventario: float, dias: float = 1.0) -> float:
        """Pérdida por deterioro en un nodo de acopio."""
        nodo = self.obtener_nodo(nodo_id)
        if nodo and nodo.tipo == TipoNodo.ACOPIO:
            return min(inventario * nodo.tasa_merma * dias, inventario)
        return 0.0

    # ── Utilidades ────────────────────────────────────────────────────────────

    def copia(self) -> "GrafoRed":
        return copy.deepcopy(self)

    def to_dict(self) -> dict:
        """Serializa el grafo a dict para respuestas JSON de la API."""
        return {
            "nodos": [
                {
                    "id": n.id,
                    "tipo": n.tipo.value,
                    "nombre": n.nombre,
                    "municipio": n.municipio,
                    "departamento": n.departamento,
                    "lat": n.latitud,
                    "lng": n.longitud,
                    "capacidad": n.capacidad,
                    "oferta": n.oferta,
                    "demanda": n.demanda,
                    "tasa_merma": n.tasa_merma,
                    "tasa_calidad": n.tasa_calidad,
                    "costo_operacion": n.costo_operacion,
                }
                for n in self.nodos.values()
            ],
            "aristas": [
                {
                    "origen": a.id_origen,
                    "destino": a.id_destino,
                    "costo": a.costo_transporte,        # costo base (editable)
                    "costo_total": a.costo_total_unitario,  # ajustado por estado (no editable)
                    "capacidad": a.capacidad,
                    "distancia": a.distancia,
                    "flujo": a.flujo_actual,
                    "utilizacion": round(a.utilizacion, 4),
                    "estado": a.estado,
                    "umbral_calidad": a.umbral_calidad,
                }
                for a in self.aristas.values()
            ],
        }

    def __repr__(self) -> str:
        return f"GrafoRed(nodos={len(self.nodos)}, aristas={len(self.aristas)})"
