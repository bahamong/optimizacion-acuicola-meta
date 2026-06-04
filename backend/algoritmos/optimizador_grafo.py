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

        rutas_activas = []
        flujos_optimos: Dict[str, float] = {}
        costo_total = 0.0

        for (u, v), arista in self.grafo.aristas.items():
            flujo = float(flujo_dict.get(u, {}).get(v, 0.0))
            arista.flujo_actual = max(0.0, flujo)

            if flujo > 1e-6:
                flujos_optimos[f"{u}→{v}"] = round(flujo, 4)
                # Costo ajustado por el estado de la vía (costo base * multiplicador).
                costo_total += flujo * arista.costo_total_unitario
                rutas_activas.append({
                    "origen": u,
                    "destino": v,
                    "flujo": round(flujo, 4),
                    "costo": round(arista.costo_base, 4),
                    "costo_total": round(arista.costo_total_unitario, 4),
                    "capacidad": arista.capacidad,
                    "utilizacion": round(arista.utilizacion, 4),
                })

        # Cambio 2: merma total estimada por el producto que pasa por acopios.
        merma_total_estimada = 0.0
        for (u, v), arista in self.grafo.aristas.items():
            nodo_u = self.grafo.obtener_nodo(u)
            if (
                nodo_u is not None
                and nodo_u.tipo == TipoNodo.ACOPIO
                and arista.flujo_actual > 1e-6
            ):
                merma_total_estimada += arista.flujo_actual * nodo_u.tasa_merma

        # Cambio 3: costo de operación de los acopios activos (con flujo entrante).
        costo_operacion_total = 0.0
        acopios_activos = []
        for acopio in self.acopios:
            flujo_entrante = sum(
                self.grafo.obtener_arista(u, acopio.id).flujo_actual
                for u in self.grafo.vecinos_entrada(acopio.id)
                if self.grafo.obtener_arista(u, acopio.id)
            )
            if flujo_entrante > 1e-6:
                costo_operacion_total += acopio.costo_operacion
                acopios_activos.append(acopio.id)

        ganancia = self._calcular_ganancia(costo_operacion_total)

        logger.info(
            f"Optimización por grafos: {len(rutas_activas)} rutas activas, "
            f"costo={costo_total:.2f}, ganancia={ganancia:.2f}, "
            f"acopios_penalizados={self.acopios_penalizados}"
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
            # Cambios 1-3 y 5: trazabilidad de los ajustes del optimizador.
            "acopios_penalizados": self.acopios_penalizados,
            "merma_total_estimada": round(merma_total_estimada, 4),
            "costo_operacion_acopios": round(costo_operacion_total, 4),
            "acopios_activos": acopios_activos,
            "cadena_valida": True,
            "restriccion": "Origen → Acopio → Destino (obligatorio)",
        }

    def _calcular_ganancia(self, costo_operacion_total: float = 0.0) -> float:
        """Ingreso por demanda cubierta − costo de transporte − costo de
        operación de acopios − penalización por demanda no satisfecha.
        Usa los flujos ya asignados en el grafo.

        Cambio 4a: el ingreso usa el precio_venta individual de cada destino
        (cae al precio global solo si el nodo no define uno positivo).
        Cambio 3B: descuenta el costo de operación de los acopios activos.
        """
        ingreso = 0.0
        penalizacion = 0.0

        for destino in self.destinos:
            recibido = sum(
                self.grafo.obtener_arista(u, destino.id).flujo_actual
                for u in self.grafo.vecinos_entrada(destino.id)
            )
            cubierto = min(recibido, destino.demanda)
            precio = (
                destino.precio_venta
                if getattr(destino, "precio_venta", 0.0) > 0
                else config.PRECIO_VENTA_TON
            )
            ingreso += cubierto * precio
            penalizacion += max(0.0, destino.demanda - recibido) * config.PENALIZACION_INCUMPLIMIENTO

        costo = sum(a.flujo_actual * a.costo_transporte for a in self.grafo.aristas.values())

        return ingreso - costo - costo_operacion_total - penalizacion
