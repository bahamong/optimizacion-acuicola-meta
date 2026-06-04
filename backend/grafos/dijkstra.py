# Archivo: backend/grafos/dijkstra.py
from typing import Dict, List, Optional, Tuple

import networkx as nx

from models.grafo import GrafoRed
from models.nodo import TipoNodo


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

    def _hay_costos_negativos(self) -> bool:
        """Retorna True si alguna arista del grafo tiene peso negativo."""
        return any(
            data.get("weight", 0) < 0
            for _, _, data in self.grafo._nx.edges(data=True)
        )

    def mejor_cadena_hacia_destino(self, id_destino: str) -> dict:
        """
        Encuentra la cadena óptima O→A→D para el destino dado.

        El usuario solo provee el ID del supermercado destino; el sistema
        elige automáticamente el mejor origen y el mejor acopio intermedio
        minimizando el costo total de la cadena completa.

        Algoritmo:
          1. Verificar que id_destino sea un nodo tipo DESTINO.
          2. Encontrar los acopios con arista directa hacia id_destino.
          3. Para cada acopio candidato y cada origen, calcular
             costo(origen → acopio) + costo(acopio → destino).
          4. Retornar la cadena de menor costo total.
        """
        nodo_destino = self.grafo.obtener_nodo(id_destino)
        if not nodo_destino:
            return {"existe": False, "error": f"Nodo '{id_destino}' no existe", "ruta": []}
        if nodo_destino.tipo != TipoNodo.DESTINO:
            return {
                "existe": False,
                "error": f"'{id_destino}' no es un destino (es {nodo_destino.tipo.value})",
                "ruta": [],
            }

        origenes = self.grafo.obtener_nodos_por_tipo(TipoNodo.ORIGEN)

        # Acopios que tienen arista directa al destino.
        acopios_conectados_al_destino = [
            uid
            for uid in self.grafo.vecinos_entrada(id_destino)
            if self.grafo.obtener_nodo(uid)
            and self.grafo.obtener_nodo(uid).tipo == TipoNodo.ACOPIO
        ]

        if not acopios_conectados_al_destino:
            return {
                "existe": False,
                "error": f"Ningún acopio conecta directamente con '{id_destino}'",
                "ruta": [],
            }

        usa_bellman = self._hay_costos_negativos()
        mejor_costo = float("inf")
        mejor_ruta = None
        mejor_acopio = None
        mejor_origen = None

        for id_acopio in acopios_conectados_al_destino:
            arista_ad = self.grafo.obtener_arista(id_acopio, id_destino)
            costo_ultima_milla = arista_ad.costo_total_unitario if arista_ad else float("inf")
            if costo_ultima_milla == float("inf"):
                continue

            for origen in origenes:
                try:
                    if usa_bellman:
                        path_oa = nx.bellman_ford_path(
                            self.grafo._nx, origen.id, id_acopio, weight="weight")
                        costo_oa = nx.bellman_ford_path_length(
                            self.grafo._nx, origen.id, id_acopio, weight="weight")
                    else:
                        path_oa = nx.dijkstra_path(
                            self.grafo._nx, origen.id, id_acopio, weight="weight")
                        costo_oa = nx.dijkstra_path_length(
                            self.grafo._nx, origen.id, id_acopio, weight="weight")

                    costo_total = costo_oa + costo_ultima_milla
                    if costo_total < mejor_costo:
                        mejor_costo = costo_total
                        mejor_ruta = path_oa + [id_destino]
                        mejor_acopio = id_acopio
                        mejor_origen = origen.id
                except (nx.NetworkXNoPath, nx.NodeNotFound, nx.NetworkXUnbounded):
                    continue

        if mejor_ruta is None:
            return {
                "existe": False,
                "error": f"No se encontró cadena O→A→D válida hacia '{id_destino}'",
                "ruta": [],
            }

        # Construir detalle tramo por tramo.
        detalle = []
        distancia_total = 0.0
        aristas_generadas = 0
        for i in range(len(mejor_ruta) - 1):
            u, v = mejor_ruta[i], mejor_ruta[i + 1]
            arista = self.grafo.obtener_arista(u, v)
            nodo_u = self.grafo.obtener_nodo(u)
            nodo_v = self.grafo.obtener_nodo(v)
            if arista:
                distancia_total += arista.distancia
                if arista.generada_automaticamente:
                    aristas_generadas += 1
            detalle.append({
                "de": u,
                "nombre_de": nodo_u.nombre if nodo_u else u,
                "tipo_de": nodo_u.tipo.value if nodo_u else "?",
                "a": v,
                "nombre_a": nodo_v.nombre if nodo_v else v,
                "tipo_a": nodo_v.tipo.value if nodo_v else "?",
                "costo_unitario": round(arista.costo_transporte, 4) if arista else 0.0,
                "costo_total_unitario": round(arista.costo_total_unitario, 4) if arista else 0.0,
                "distancia_km": round(arista.distancia, 2) if arista else 0.0,
                "capacidad": arista.capacidad if arista else 0.0,
                "estado": arista.estado if arista else "activa",
                "fuente_distancia": arista.fuente_distancia if arista else None,
                "generada_automaticamente": arista.generada_automaticamente if arista else False,
                "fuente_arista": arista.fuente_arista if arista else None,
            })

        return {
            "existe": True,
            "destino": id_destino,
            "nombre_destino": nodo_destino.nombre,
            "origen_optimo": mejor_origen,
            "acopio_intermedio": mejor_acopio,
            "ruta": mejor_ruta,
            "distancia_total": round(distancia_total, 2),
            "costo_total": round(mejor_costo, 4),
            "costo_por_tramo": detalle,
            "saltos": len(mejor_ruta) - 1,
            "algoritmo": "bellman_ford" if usa_bellman else "dijkstra",
            "cadena": f"{mejor_origen} → {mejor_acopio} → {id_destino}",
            "justificacion": (
                "Se evaluaron todas las cadenas validas Origen->Acopio->Destino "
                "y se selecciono la de menor costo total ajustado."
            ),
            "aristas_generadas_automaticamente": aristas_generadas,
            "aristas_desde_base_datos": (len(mejor_ruta) - 1) - aristas_generadas,
            "detalle": detalle,
        }

    def ruta_con_detalle(self, origen: str, destino: str) -> dict:
        """
        [_legacy] Retorna la ruta óptima entre un origen y un destino
        explícitos, con detalle por tramo. Se mantiene para la ruta
        representativa post-optimización y el modo legacy de la API.
        El modo nuevo de la API usa mejor_cadena_hacia_destino().
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
        distancia_total = 0.0
        for i in range(len(path) - 1):
            arista = self.grafo.obtener_arista(path[i], path[i + 1])
            nodo_de = self.grafo.obtener_nodo(path[i])
            nodo_a = self.grafo.obtener_nodo(path[i + 1])
            if arista:
                distancia_total += arista.distancia
            detalle.append({
                "de": path[i],
                "nombre_de": nodo_de.nombre if nodo_de else path[i],
                "a": path[i + 1],
                "nombre_a": nodo_a.nombre if nodo_a else path[i + 1],
                "costo_unitario": arista.costo_transporte if arista else 0.0,
                "costo_total_unitario": arista.costo_total_unitario if arista else 0.0,
                "distancia_km": arista.distancia if arista else 0.0,
                "capacidad": arista.capacidad if arista else 0.0,
                "fuente_distancia": arista.fuente_distancia if arista else None,
                "generada_automaticamente": arista.generada_automaticamente if arista else False,
                "fuente_arista": arista.fuente_arista if arista else None,
            })
        return {
            "existe": True,
            "origen": origen,
            "destino": destino,
            "ruta": path,
            "distancia_total": round(distancia_total, 2),
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
                "costo_total": arista.costo_total_unitario,
                "fuente_distancia": arista.fuente_distancia,
                "generada_automaticamente": arista.generada_automaticamente,
            })
        return sorted(saturaciones, key=lambda x: x["utilizacion"], reverse=True)[:top_n]

    def matriz_costos(self) -> Dict[str, Dict[str, float]]:
        """Matriz de costos de camino mínimo entre todos los pares de nodos."""
        matriz: Dict[str, Dict[str, float]] = {}
        for nodo_id in self.grafo.nodos:
            rutas = self.todas_rutas_desde(nodo_id)
            matriz[nodo_id] = {dest: costo for dest, (_, costo) in rutas.items()}
        return matriz
