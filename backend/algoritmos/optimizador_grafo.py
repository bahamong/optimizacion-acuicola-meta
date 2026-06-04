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

import networkx as nx

import config
from algoritmos.resultado import construir_resultado
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
        # IDs de acopios penalizados por baja calidad (se llena en _construir_red).
        self.acopios_penalizados: list = []

    def _construir_red(self) -> nx.DiGraph:
        """Red dirigida con super-fuente (__S__) y super-sumidero (__T__),
        con capacidades y pesos enteros para max_flow_min_cost.

        Los ajustes de calidad (Cambio 1), merma (Cambio 2) y costo de
        operación (Cambio 3A) se aplican SOLO sobre este grafo temporal de
        NetworkX. El objeto GrafoRed/Arista permanece intacto.
        """
        G = nx.DiGraph()
        G.add_node("__S__")
        G.add_node("__T__")

        ids_origen = {o.id for o in self.origenes}
        ids_destino = {d.id for d in self.destinos}

        for origen in self.origenes:
            G.add_edge("__S__", origen.id, capacity=int(round(origen.oferta)), weight=0)

        for destino in self.destinos:
            G.add_edge(destino.id, "__T__", capacity=int(round(destino.demanda)), weight=0)

        # Cambio 1: acopios con calidad bajo el umbral se penalizan en sus
        # aristas de salida para que el optimizador prefiera rutas alternativas.
        acopios_penalizados = [
            a.id for a in self.acopios if a.tasa_calidad < config.UMBRAL_CALIDAD
        ]
        set_penalizados = set(acopios_penalizados)
        self.acopios_penalizados = acopios_penalizados

        for (u, v), arista in self.grafo.aristas.items():
            # Cambio 5: defender la cadena Origen → Acopio → Destino. Cualquier
            # arista directa Origen→Destino se omite del grafo de optimización.
            if u in ids_origen and v in ids_destino:
                logger.warning(
                    f"Arista directa Origen→Destino detectada y omitida del optimizador: "
                    f"{u}→{v}. La cadena debe ser Origen→Acopio→Destino."
                )
                continue

            nodo_u = self.grafo.obtener_nodo(u)
            nodo_v = self.grafo.obtener_nodo(v)

            costo_unitario = arista.costo_transporte
            capacidad = float(arista.capacidad)

            # Cambio 2: la merma del acopio reduce la capacidad efectiva de sus
            # aristas de salida (para entregar X, hay que enviar X/(1-merma)).
            if nodo_u is not None and nodo_u.tipo == TipoNodo.ACOPIO:
                factor_merma = max(0.0, 1.0 - nodo_u.tasa_merma)
                capacidad = capacidad * factor_merma

            # Cambio 1: penalización de calidad en la salida de acopios malos.
            if u in set_penalizados:
                costo_unitario += config.PENALIZACION_CALIDAD

            # Cambio 3A: costo de operación distribuido en las aristas de entrada
            # al acopio (estimación conservadora a ~50% de capacidad).
            if (
                nodo_v is not None
                and nodo_v.tipo == TipoNodo.ACOPIO
                and nodo_v.costo_operacion > 0
            ):
                capacidad_promedio = max(nodo_v.capacidad * 0.5, 1.0)
                costo_unitario += nodo_v.costo_operacion / capacidad_promedio

            G.add_edge(
                u,
                v,
                capacity=max(int(round(capacidad)), 0),
                weight=max(int(round(costo_unitario * ESCALA_COSTO)), 0),
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

        # Volcar los flujos del algoritmo sobre las aristas de la red real.
        for (u, v), arista in self.grafo.aristas.items():
            arista.flujo_actual = max(0.0, float(flujo_dict.get(u, {}).get(v, 0.0)))

        resultado = construir_resultado(
            self.grafo,
            self.acopios_penalizados,
            algoritmo="Flujo de Mínimo Costo",
        )

        logger.info(
            f"Optimización por grafos: {resultado['num_rutas_activas']} rutas activas, "
            f"costo={resultado['costo_minimo']:.2f}, ganancia={resultado['ganancia']:.2f}, "
            f"acopios_penalizados={self.acopios_penalizados}"
        )

        return resultado
